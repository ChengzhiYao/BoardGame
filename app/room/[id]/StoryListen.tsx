'use client';
// 一起听故事：沉浸式朗读 + 弹幕 + 表情。每个人（真人或 Linger 伴侣）的头像浮在屏幕边上，可以拖；
// 发表情时从 TA 的头像上冒出气泡，发文字时像 B 站弹幕一样飘过。背景音和音效跟着情节走。
import { useEffect, useMemo, useRef, useState } from 'react';
import Beat, { BEAT_CSS } from '@/components/Beat';
import StageText, { STAGE_CSS, splitSentences, locate } from '@/components/StageText';
import Icon from '@/components/Icon';
import Sticker, { STICKERS } from '@/components/Sticker';
import BadgeCheck from '@/components/BadgeCheck';
import { createClient } from '@/lib/supabase/client';
import { STORY_MOODS } from '@/lib/story/prompt';
import { setStoryBgm, pauseStoryBgm, resumeStoryBgm, stopStoryBgm, storyStinger, storySfx, setStoryVol } from '@/lib/audio/storyCue';

type Who = { pid: string; name: string; avatar?: string | null; me?: boolean; ai?: boolean };
type Live = { id: string; pid: string; kind: 'text' | 'sticker'; value: string; at: number };

export default function StoryListen({ roomId, en, title, text, url, segs, playback, cues, rating, genre, people, myPid, aiPid, isHost, onTools, narrating }: {
  roomId: string; segs?: { i: number; a: number; b: number }[]; en: boolean; title: string; text: string; url?: string | null; playback?: any; cues?: any[]; rating?: any; genre?: string;
  people: Who[]; myPid?: string | null; aiPid?: string | null; isHost: boolean; onTools?: () => void; narrating?: boolean;
}) {
  const L = (zh: string, e: string) => (en ? e : zh);
  const supabase = useRef(createClient()).current;
  const paras = useMemo(() => (text || '').split(/\n+/).map((p) => p.trim()).filter(Boolean), [text]);
  const total = paras.reduce((a, p) => a + p.length, 0) || 1;
  const ends = useMemo(() => { let acc = 0; return paras.map((p) => (acc += p.length)); }, [paras]);

  // ---------- 播放（大家同步：谁按播放/暂停/拖动，别人跟着） ----------
  const aRef = useRef<HTMLAudioElement | null>(null);
  const [cur, setCur] = useState(0);
  const [dur, setDur] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [needTap, setNeedTap] = useState(false);
  const [sound, setSound] = useState(true);
  const seeking = useRef(false);
  const post = (playing: boolean, position: number) => fetch('/api/story/playback', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ roomId, playing, position }) }).catch(() => {});
  useEffect(() => { const a = aRef.current; if (a) { try { a.load(); } catch {} setCur(0); } }, [url]);
  useEffect(() => {
    const a = aRef.current; if (!a || !playback) return;
    const drift = playback.playing ? Math.max(0, (Date.now() - (Number(playback.ts) || Date.now())) / 1000) : 0;
    const target = (Number(playback.position) || 0) + drift;
    if (isFinite(target) && Math.abs(a.currentTime - target) > 1.2 && !seeking.current) { try { a.currentTime = target; } catch {} }
    if (playback.playing) { if (a.paused) a.play().then(() => setNeedTap(false)).catch(() => setNeedTap(true)); }
    else if (!a.paused) a.pause();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playback?.playing, playback?.position, playback?.ts]);
  function toggle() {
    const a = aRef.current; if (!a) return;
    if (a.paused) { a.play().then(() => setNeedTap(false)).catch(() => setNeedTap(true)); post(true, a.currentTime); }
    else { a.pause(); post(false, a.currentTime); }
  }
  const fmt = (s: number) => { s = Math.max(0, Math.floor(s || 0)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
  // 播放时每帧读一次进度，字才能一个一个顺滑地冒出来
  const [t, setT] = useState(0);
  useEffect(() => {
    if (!isPlaying) return; let raf = 0, last = 0;
    const loop = (now: number) => { if (now - last > 40) { last = now; const a = aRef.current; if (a) setT(a.currentTime || 0); } raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop); return () => cancelAnimationFrame(raf);
  }, [isPlaying]);
  const tt = isPlaying ? t : cur;
  const frac = dur > 0 ? Math.min(1, tt / dur) : 0;
  let activeIdx = -1, paraP = 0;
  if (url && tt > 0.15) {
    const sg = Array.isArray(segs) && segs.length === paras.length ? segs.find((x) => frac >= x.a && frac < x.b) || segs[segs.length - 1] : null;
    if (sg) { activeIdx = sg.i; paraP = (frac - sg.a) / Math.max(0.0001, sg.b - sg.a); }
    else { activeIdx = Math.max(0, ends.findIndex((e) => frac * total < e)); const st0 = activeIdx > 0 ? ends[activeIdx - 1] : 0; paraP = (frac * total - st0) / Math.max(1, ends[activeIdx] - st0); }
  }
  const sentences = useMemo(() => (activeIdx >= 0 ? splitSentences(paras[activeIdx]) : []), [activeIdx, paras]);
  const loc = activeIdx >= 0 ? locate(sentences, paraP) : { si: -1, sp: 0 };
  const curSentence = activeIdx >= 0 ? sentences[loc.si] : '';
  const prevSentence = activeIdx >= 0 ? (loc.si > 0 ? sentences[loc.si - 1] : activeIdx > 0 ? splitSentences(paras[activeIdx - 1]).slice(-1)[0] : '') : '';
  const curCue = activeIdx >= 0 && Array.isArray(cues) ? cues[activeIdx] : null;
  const calm = ['calm', 'tender', 'happy', 'sad'].includes(curCue?.mood);
  const scaryNow = ['scare', 'eerie', 'cosmic', 'chase', 'tension'].includes(curCue?.mood);
  const [fullText, setFullText] = useState(false);
  // 听到 60% 算听完：记一笔（称号用）
  const [listened, setListened] = useState(false);
  useEffect(() => {
    if (listened || frac < 0.6 || !dur) return; setListened(true);
    fetch('/api/me/listened', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ref: `story:${roomId}:${title}`, kind: 'story', genre, real: /真实经历|true/i.test(genre || ''), together: people.length > 1 }) }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frac >= 0.6]);
  const paraRefs = useRef<(HTMLParagraphElement | null)[]>([]);
  useEffect(() => { if (fullText && activeIdx >= 0) paraRefs.current[activeIdx]?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, [activeIdx, fullText]);

  // ---------- 氛围音：跟着段落情绪换背景，字面出现的声音放音效，吓人处来一下 ----------
  const lastCue = useRef(-1);
  useEffect(() => {
    if (!sound || !isPlaying) { pauseStoryBgm(); return; }
    if (activeIdx < 0) return;
    const c = Array.isArray(cues) ? cues[activeIdx] : null;
    setStoryVol(0.24);
    const cat = STORY_MOODS.find((m) => m.word === c?.mood)?.cat || (/恐怖|horror|诡|怪谈/.test(genre || '') ? 'PARANORMAL_EVENT' : 'EXPLORATION_SAFE');
    setStoryBgm(cat, 0.24); resumeStoryBgm();
    if (activeIdx !== lastCue.current) {
      lastCue.current = activeIdx;
      if (c?.stinger) storyStinger();
      (Array.isArray(c?.sfx) ? c.sfx : []).forEach((k: string, n: number) => setTimeout(() => storySfx(k), 300 + n * 900));
      // 伴侣：吓人 / 动人的段落，或者每隔几段，自己冒一句
      if (isHost && aiPid) {
        const scary = c?.stinger || ['scare', 'cosmic', 'chase'].includes(c?.mood);
        const moving = ['sad', 'happy', 'tender', 'reveal'].includes(c?.mood);
        if (scary || moving || activeIdx % 6 === 5) fetch('/api/story/live', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ roomId, ask: scary ? 'scary' : moving ? 'moving' : 'periodic', para: paras[activeIdx] }) }).catch(() => {});
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIdx, isPlaying, sound, cues]);
  useEffect(() => () => stopStoryBgm(), []);

  // ---------- 弹幕和表情 ----------
  const [danmaku, setDanmaku] = useState<(Live & { lane: number; dur: number })[]>([]);
  const [pops, setPops] = useState<Record<string, Live>>({});
  const lanes = useRef<number[]>([0, 0, 0, 0, 0]);
  const seen = useRef<Set<string>>(new Set());
  const mine = useRef<Record<string, number>>({});
  function show(l: Live) {
    if (seen.current.has(l.id)) return; seen.current.add(l.id);
    // 自己刚发的那条，服务器又推回来一次：不重复显示
    if (l.id.startsWith('tmp-')) mine.current[l.value] = Date.now();
    else if (l.pid === myPid && Date.now() - (mine.current[l.value] || 0) < 8000) return;
    setPops((p) => ({ ...p, [l.pid]: l }));
    setTimeout(() => setPops((p) => (p[l.pid]?.id === l.id ? (() => { const n = { ...p }; delete n[l.pid]; return n; })() : p)), 2800);
    if (l.kind === 'text') {
      const now = Date.now();
      let lane = lanes.current.findIndex((t) => t < now); if (lane < 0) lane = Math.floor(Math.random() * lanes.current.length);
      const d = Math.min(11, 6.5 + l.value.length * 0.12);
      lanes.current[lane] = now + 1800;
      setDanmaku((x) => [...x.slice(-24), { ...l, lane, dur: d }]);
      setTimeout(() => setDanmaku((x) => x.filter((y) => y.id !== l.id)), d * 1000 + 300);
    }
  }
  useEffect(() => {
    const since = new Date().toISOString();
    const ch = supabase.channel(`story-live-${roomId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `room_id=eq.${roomId}` }, (e: any) => {
        const m = e.new; if (m?.payload?.type !== 'story_live') return;
        show({ id: m.id, pid: m.sender_player_id, kind: m.payload.kind, value: m.payload.value, at: Date.now() });
      }).subscribe();
    // 兜底：realtime 收不到时轮询一下新的
    const t = setInterval(async () => {
      if (document.hidden) return;
      const { data } = await supabase.from('messages').select('id, sender_player_id, payload, created_at').eq('room_id', roomId).gte('created_at', since).order('created_at', { ascending: false }).limit(12);
      (data || []).reverse().forEach((m: any) => { if (m.payload?.type === 'story_live' && Date.now() - new Date(m.created_at).getTime() < 15000) show({ id: m.id, pid: m.sender_player_id, kind: m.payload.kind, value: m.payload.value, at: Date.now() }); });
    }, 4000);
    return () => { supabase.removeChannel(ch); clearInterval(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);
  const [txt, setTxt] = useState('');
  const [sending, setSending] = useState(false);
  async function send(kind: 'text' | 'sticker', value: string) {
    if (!value.trim() || !myPid) return;
    const tmp: Live = { id: 'tmp-' + Date.now(), pid: myPid, kind, value: value.trim().slice(0, 40), at: Date.now() };
    show(tmp); try { navigator.vibrate?.(15); } catch {}
    if (kind === 'text') setTxt('');
    setSending(true);
    try { await fetch('/api/story/live', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ roomId, kind, value: tmp.value, para: activeIdx >= 0 ? paras[activeIdx] : paras[0] }) }); } catch {}
    setSending(false);
  }

  // ---------- 浮动头像（可拖动，位置记在本机） ----------
  const [pos, setPos] = useState<Record<string, { x: number; y: number }>>({});
  useEffect(() => {
    let saved: any = {}; try { saved = JSON.parse(localStorage.getItem('sl-pos-' + roomId) || '{}'); } catch {}
    const W = window.innerWidth, H = window.innerHeight; const next: any = {};
    let r = 0;
    people.forEach((p) => { next[p.pid] = saved[p.pid] || (p.me ? { x: 14, y: H - 250 } : { x: W - 70, y: H - 250 - (r++) * 74 }); });
    setPos(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [people.map((p) => p.pid).join(',')]);
  const drag = useRef<{ pid: string; dx: number; dy: number; moved: boolean } | null>(null);
  function onDown(e: React.PointerEvent, pid: string) { const p = pos[pid]; if (!p) return; drag.current = { pid, dx: e.clientX - p.x, dy: e.clientY - p.y, moved: false }; (e.target as any).setPointerCapture?.(e.pointerId); }
  function onMove(e: React.PointerEvent) {
    const d = drag.current; if (!d) return;
    const x = Math.max(4, Math.min(window.innerWidth - 60, e.clientX - d.dx)), y = Math.max(60, Math.min(window.innerHeight - 200, e.clientY - d.dy));
    d.moved = true; setPos((p) => ({ ...p, [d.pid]: { x, y } }));
  }
  function onUp() { if (drag.current?.moved) { try { localStorage.setItem('sl-pos-' + roomId, JSON.stringify(pos)); } catch {} } drag.current = null; }

  const nameOf = (pid: string) => people.find((p) => p.pid === pid)?.name || '';
  const score = Number(rating?.overall) || 0;

  return (
    <main className="h-[100svh] relative overflow-hidden text-parchment" onPointerMove={onMove} onPointerUp={onUp}>
      <style>{BEAT_CSS + STAGE_CSS + `@keyframes dmFly{from{transform:translateX(100vw)}to{transform:translateX(-110%)}}.dm-fly{animation:dmFly linear forwards}@keyframes popIn{0%{opacity:0;transform:translateY(8px) scale(.6)}20%{opacity:1;transform:translateY(0) scale(1.08)}30%{transform:scale(1)}85%{opacity:1}100%{opacity:0;transform:translateY(-10px)}}.pop-in{animation:popIn 2.8s ease forwards}@keyframes avFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}.av-float{animation:avFloat 3.2s ease-in-out infinite}`}</style>
      <div aria-hidden className="absolute inset-0 -z-10 transition-[background] duration-[2500ms]" style={{ background: isPlaying ? 'radial-gradient(90% 55% at 50% 0%, rgba(110,40,40,.22), transparent 65%), #07080a' : 'radial-gradient(90% 55% at 50% 0%, rgba(201,169,110,.14), transparent 65%), #0a0b0e' }} />

      {/* 顶栏 */}
      <header className="absolute top-0 inset-x-0 z-30 bg-gradient-to-b from-[#07080a] via-[#07080a]/85 to-transparent" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="max-w-2xl mx-auto h-12 pl-24 pr-3 flex items-center gap-2">
          <div className="flex-1 min-w-0 text-center truncate font-serif text-[15px] text-[#f2e6d0]">{title}</div>
          <div className="flex -space-x-2 shrink-0">{people.slice(0, 4).map((p) => <Av key={p.pid} p={p} size={26} />)}</div>
          {isHost && onTools && <button onClick={onTools} className="shrink-0 w-9 h-9 rounded-full border border-white/10 flex items-center justify-center text-parchment/70" aria-label="tools"><Icon n="more" size={20} stroke={2.6} /></button>}
        </div>
      </header>

      {/* 舞台：只放正在念的那一句，大字逐字出现 */}
      <div className="absolute inset-0 flex flex-col items-center justify-center px-6 pb-[230px] pt-24">
        {activeIdx < 0 ? (
          <div className="text-center">
            {genre && <div className="text-[10.5px] tracking-[.35em] text-[#c9a96e]/80">{genre}</div>}
            <h1 className="mt-3 font-serif font-semibold text-[34px] leading-tight text-[#f7ecd8] [text-shadow:0_2px_30px_rgba(0,0,0,.9)]">{title}</h1>
            {score > 0 && <button onClick={onTools} className="mt-3 inline-flex items-center gap-1.5 text-[12px] px-2.5 py-0.5 rounded-full border border-[#c9a96e]/35 text-[#e6c76e]"><Icon n="trophy" size={12} />{L(`评分 ${score}`, `Score ${score}`)}</button>}
            <p className="mt-6 text-[13px] text-parchment/45">{url ? L('戴上耳机，按下播放', 'Headphones on, press play') : narrating ? L('正在配上真人声音…', 'Recording the narration…') : ''}</p>
          </div>
        ) : (
          <div className="w-full max-w-2xl">
            <div key={'p' + activeIdx + '-' + loc.si} className="prev-line mb-6 text-center font-serif text-[15px] leading-relaxed text-parchment/30 line-clamp-2">{prevSentence ? prevSentence.replace(/\*\*|!!|\(\(|\)\)|\[\[|\]\]/g, '') : ''}</div>
            <StageText key={activeIdx + '-' + loc.si} text={curSentence} p={loc.sp} calm={calm} scary={scaryNow} />
          </div>
        )}
        {activeIdx >= 0 && <div className="absolute left-1/2 -translate-x-1/2 bottom-[238px] flex gap-1">{paras.map((_, i) => <span key={i} className={`h-[3px] rounded-full transition-all ${i === activeIdx ? 'w-5 bg-[#c9a96e]' : i < activeIdx ? 'w-1.5 bg-[#c9a96e]/45' : 'w-1.5 bg-white/12'}`} />).slice(Math.max(0, activeIdx - 12), activeIdx + 13)}</div>}
      </div>
      <button onClick={() => setFullText(true)} className="absolute z-20 left-3 h-8 px-3 rounded-full border border-white/10 bg-black/40 text-[12px] text-parchment/60 inline-flex items-center gap-1.5" style={{ top: 'calc(env(safe-area-inset-top) + 54px)' }}><Icon n="scroll" size={14} />{L('全文', 'Full text')}</button>
      {fullText && (
        <div className="absolute inset-0 z-40 bg-[#07080a]/96 overflow-y-auto px-5 pb-40" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 60px)' }}>
          <button onClick={() => setFullText(false)} className="fixed right-3 z-50 h-9 px-3.5 rounded-full bg-[#c9a96e] text-[#14110a] text-[13px]" style={{ top: 'calc(env(safe-area-inset-top) + 12px)' }}>{L('回到大字', 'Back')}</button>
          <article className="max-w-2xl mx-auto space-y-4">
            <h2 className="font-serif text-[22px] text-[#f7ecd8] text-center mb-4">{title}</h2>
            {paras.map((p, i) => (
              <p key={i} ref={(el) => { paraRefs.current[i] = el; }} className={`font-serif leading-[1.95] text-[16px] ${i === activeIdx ? 'text-[#fff4e0]' : 'text-parchment/70'}`}><Beat text={p} /></p>
            ))}
          </article>
        </div>
      )}

      {listened && <BadgeCheck en={en} />}
      {/* 弹幕层 */}
      <div className="pointer-events-none absolute inset-x-0 z-20 overflow-hidden" style={{ top: 'calc(env(safe-area-inset-top) + 56px)', height: 200 }}>
        {danmaku.map((d) => {
          const p = people.find((x) => x.pid === d.pid);
          return (
            <div key={d.id} className="dm-fly absolute left-0 whitespace-nowrap flex items-center gap-1.5" style={{ top: d.lane * 38 + 6, animationDuration: `${d.dur}s` }}>
              {p && <Av p={p} size={22} />}
              <span className={`px-3 py-1 rounded-full text-[15px] font-medium [text-shadow:0_1px_6px_rgba(0,0,0,.9)] ${p?.me ? 'border border-[#e6c76e]/60 text-[#fff1c8] bg-black/30' : p?.ai ? 'text-[#ffc6d6] bg-black/25' : 'text-white bg-black/20'}`}>{d.value}</span>
            </div>
          );
        })}
      </div>

      {/* 浮动头像 */}
      {people.map((p) => { const ps = pos[p.pid]; if (!ps) return null; const pop = pops[p.pid]; const left = typeof window === 'undefined' || ps.x < window.innerWidth / 2; return (
        <div key={p.pid} className="absolute z-30 touch-none select-none" style={{ left: ps.x, top: ps.y }} onPointerDown={(e) => onDown(e, p.pid)}>
          {pop && (
            <div className={`pop-in absolute bottom-[62px] flex flex-col ${left ? 'left-0 items-start origin-bottom-left' : 'right-0 items-end origin-bottom-right'}`}>
              <div className={`w-max rounded-2xl px-2.5 py-1.5 shadow-xl ${pop.kind === 'sticker' ? 'bg-[#1a1712]/95 border border-[#e6c76e]/30' : 'bg-[#f6ecd8] text-[#1a1410] text-[13px] max-w-[180px] leading-snug whitespace-normal'}`}>
                {pop.kind === 'sticker' ? <Sticker k={pop.value} size={46} /> : pop.value}
              </div>
              <span className={`w-2.5 h-2.5 -mt-1 rotate-45 ${left ? 'ml-5' : 'mr-5'} ${pop.kind === 'sticker' ? 'bg-[#1a1712] border-r border-b border-[#e6c76e]/30' : 'bg-[#f6ecd8]'}`} />
            </div>
          )}
          <div className="av-float flex flex-col items-center cursor-grab active:cursor-grabbing">
            <Av p={p} size={52} ring />
            <span className="mt-1 max-w-[70px] truncate text-[10.5px] px-1.5 rounded-full bg-black/50 text-parchment/80">{p.me ? L('我', 'me') : p.name}</span>
          </div>
        </div>
      ); })}

      {/* 底部：播放 + 表情 + 弹幕输入 */}
      <div className="absolute bottom-0 inset-x-0 z-30 bg-gradient-to-t from-[#07080a] via-[#07080a]/95 to-transparent pt-8" style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}>
        <div className="max-w-2xl mx-auto px-4 space-y-2.5">
          {url ? (
            <div className="flex items-center gap-3">
              <audio ref={aRef} src={url} preload="auto"
                onLoadedMetadata={(e) => setDur(e.currentTarget.duration || 0)}
                onPlay={() => setIsPlaying(true)} onPause={() => setIsPlaying(false)}
                onTimeUpdate={(e) => { if (!seeking.current) setCur(e.currentTarget.currentTime || 0); }}
                onEnded={() => post(false, 0)} />
              <button onClick={toggle} className={`shrink-0 w-12 h-12 rounded-full flex items-center justify-center ${isPlaying ? 'bg-[#f2e6d0] text-[#0a0b0e]' : 'bg-[#7d1d1d] border border-[#a83232]/60 text-[#f6ecd0] shadow-[0_0_30px_-6px_rgba(192,69,63,.7)]'}`} aria-label="play"><Icon n={isPlaying ? 'pause' : 'play'} size={20} /></button>
              <div className="flex-1 min-w-0">
                <input type="range" min={0} max={dur || 0} step={0.1} value={Math.min(cur, dur || 0)} className="w-full accent-[#c9a96e]"
                  onChange={(e) => { const a = aRef.current; if (!a) return; seeking.current = true; const t = Number(e.target.value); setCur(t); a.currentTime = t; }}
                  onPointerUp={() => { seeking.current = false; const a = aRef.current; if (a) post(!a.paused, a.currentTime); }} />
                <div className="flex justify-between text-[10.5px] text-parchment/40"><span>{fmt(cur)}</span>{needTap ? <span className="text-[#e6c76e]">{L('点一下播放键跟上', 'Tap play to join')}</span> : <span>{people.length > 1 ? L(`${people.length} 人一起在听`, `${people.length} listening`) : ''}</span>}<span>{fmt(dur)}</span></div>
              </div>
              <button onClick={() => setSound((v) => !v)} className={`shrink-0 w-9 h-9 rounded-full border flex items-center justify-center ${sound ? 'border-[#c9a96e]/40 text-[#e6c76e]' : 'border-white/10 text-parchment/35'}`} aria-label="ambience"><Icon n="headphones" size={17} /></button>
            </div>
          ) : (
            <div className="h-12 flex items-center justify-center gap-2 text-[13px] text-parchment/55">{narrating ? <><span className="w-4 h-4 rounded-full border-2 border-white/10 border-t-[#c9a96e] animate-spin" />{L('正在配上真人声音…', 'Recording the narration…')}</> : L('等房主生成朗读', 'Waiting for narration')}</div>
          )}
          <div className="flex items-center gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {STICKERS.map((s) => (
              <button key={s.k} onClick={() => send('sticker', s.k)} className="shrink-0 flex flex-col items-center gap-0.5 px-1.5 py-1 rounded-xl hover:bg-white/[0.05] active:scale-90 transition-transform">
                <Sticker k={s.k} size={34} /><span className="text-[10px] text-parchment/55">{en ? s.en : s.zh}</span>
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <input value={txt} onChange={(e) => setTxt(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send('text', txt)} maxLength={40} placeholder={L('发条弹幕，说说你的感受…', 'Say something…')} className="flex-1 min-w-0 h-11 px-4 rounded-full bg-[#121318] border border-white/10 text-[14px] text-parchment placeholder:text-parchment/30 outline-none focus:border-[#c9a96e]/50" />
            <button onClick={() => send('text', txt)} disabled={!txt.trim() || sending} className="shrink-0 h-11 px-5 rounded-full bg-[#c9a96e] text-[#14110a] text-[14px] font-medium disabled:opacity-40">{L('发送', 'Send')}</button>
          </div>
        </div>
      </div>
    </main>
  );
}

function Av({ p, size, ring }: { p: Who; size: number; ring?: boolean }) {
  const st = { width: size, height: size, fontSize: size * 0.42 };
  const cls = `rounded-full shrink-0 ${ring ? (p.ai ? 'border-2 border-[#ff9db8]/70 shadow-[0_0_24px_-4px_rgba(255,157,184,.6)]' : p.me ? 'border-2 border-[#e6c76e]/70 shadow-[0_0_24px_-4px_rgba(230,199,110,.55)]' : 'border-2 border-white/40') : 'border border-[#07080a]'}`;
  // eslint-disable-next-line @next/next/no-img-element
  return p.avatar ? <img src={p.avatar} alt="" draggable={false} style={st} className={`${cls} object-cover pointer-events-none`} /> : <span style={st} className={`${cls} bg-[#1c1d22] flex items-center justify-center font-serif text-parchment/80 pointer-events-none`}>{String(p.name || '?').slice(0, 1)}</span>;
}
