'use client';
// 今夜怪谈播放器：一句一句播（讲述人和每个角色是不同的声音），字幕跟着走，背景有很轻的夜声。
import { useEffect, useRef, useState } from 'react';
import { getClientLang } from '@/lib/i18n';
import Icon from '@/components/Icon';
import { parseBeat } from '@/lib/narrate';
import BadgeCheck from '@/components/BadgeCheck';
import Sticker, { STICKERS } from '@/components/Sticker';
import StageText, { STAGE_CSS, splitSentences, locate } from '@/components/StageText';
import { setStoryBgm, pauseStoryBgm, resumeStoryBgm, stopStoryBgm, storySfx, storyStinger, setStoryVol } from '@/lib/audio/storyCue';
import { STORY_MOODS } from '@/lib/story/prompt';

// 每种故事风格一套卡片配色
const STY: Record<string, { c: string; zh: string; en: string; icon: string }> = {
  city: { c: '#8c9bff', zh: '城市夜晚', en: 'City night', icon: 'lantern' }, home: { c: '#e8a87c', zh: '住处', en: 'At home', icon: 'key' },
  hospital: { c: '#8fd3b8', zh: '医院', en: 'Hospital', icon: 'scroll' }, school: { c: '#c9b8ff', zh: '学校', en: 'School', icon: 'clock' },
  village: { c: '#c9a96e', zh: '乡下老家', en: 'Back home', icon: 'candle' }, water: { c: '#6fb7d9', zh: '水边', en: 'By the water', icon: 'moon' },
  road: { c: '#f0a35a', zh: '路上', en: 'On the road', icon: 'eye' }, old: { c: '#b89a7a', zh: '旧物', en: 'Old things', icon: 'ghost' },
  cosmic: { c: '#a48cff', zh: '不可名状', en: 'Cosmic', icon: 'spiral' },
};
const sty = (k?: string) => STY[k || 'city'] || STY.city;
function Fear({ n, c }: { n: number; c: string }) {
  return <span className="inline-flex items-end gap-[3px]">{[1, 2, 3, 4, 5].map((i) => <span key={i} className="w-[4px] rounded-sm" style={{ height: 5 + i * 2.5, background: i <= n ? c : 'rgba(255,255,255,.12)' }} />)}</span>;
}
// 一句话里的排版标记 → 夸张的视觉：动作加粗发光、喊叫放大抖动、低语变小变淡、拟声做成发光的标签
function Beat({ text, cur }: { text: string; cur: boolean }) {
  const segs = parseBeat(text);
  return <>{segs.map((g, i) => {
    if (g.k === 'act') return <b key={i} className="font-semibold text-[#ffd98f] [text-shadow:0_0_14px_rgba(255,190,90,.35)]">{g.t}</b>;
    if (g.k === 'shout') return <span key={i} className={`inline-block mx-0.5 font-black text-[1.55em] leading-none text-[#ff5a4f] [text-shadow:0_0_22px_rgba(255,60,50,.6)] ${cur ? 'gs-shake' : ''}`}>{g.t}</span>;
    if (g.k === 'whisper') return <span key={i} className="italic text-[0.86em] tracking-[.18em] text-[#b9c6dd]/75 [text-shadow:0_0_10px_rgba(150,170,210,.35)]">{g.t}</span>;
    if (g.k === 'sfx') return <span key={i} className={`inline-block mx-1 px-2 py-0.5 rounded-md border border-[#e8a87c]/40 bg-[#e8a87c]/10 text-[0.78em] tracking-[.32em] text-[#f2c09a] align-middle ${cur ? 'gs-pulse' : ''}`}>{g.t}</span>;
    if (g.k === 'say') return <span key={i} className="text-[#fff0dc]">「{g.t}」</span>;
    return <span key={i}>{g.t}</span>;
  })}</>;
}

export default function TonightClient({ initial }: { initial: any }) {
  const [en, setEn] = useState(false);
  const [d, setD] = useState<any>(initial ? { ok: true, story: initial, archive: [] } : null);
  const [idx, setIdx] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const [ended, setEnded] = useState(false);
  const audio = useRef<HTMLAudioElement | null>(null);
  const timer = useRef<any>(null);
  const lineRefs = useRef<(HTMLDivElement | null)[]>([]);
  const L = (zh: string, e: string) => (en ? e : zh);
  const [lp, setLp] = useState(0); // 当前这句念到百分之几
  const lineStart = useRef(0); const idxRef = useRef(-1); const linesRef = useRef<any[]>([]);
  const [showAll, setShowAll] = useState(false);
  const [listened, setListened] = useState<string | null>(null);
  const [sound, setSound] = useState(true);
  const soundRef = useRef(true);
  const [dm, setDm] = useState<{ id: number; v: string; lane: number; dur: number }[]>([]);
  const [pop, setPop] = useState<{ id: number; kind: 'sticker' | 'text'; v: string } | null>(null);
  const [txt, setTxt] = useState('');
  function say(kind: 'sticker' | 'text', v: string) {
    v = v.trim().slice(0, 40); if (!v) return; const id = Date.now();
    try { navigator.vibrate?.(15); } catch {}
    setPop({ id, kind, v }); setTimeout(() => setPop((p) => (p?.id === id ? null : p)), 2800);
    if (kind === 'text') { const dur = Math.min(11, 6.5 + v.length * 0.12); setDm((x) => [...x.slice(-12), { id, v, lane: Math.floor(Math.random() * 4), dur }]); setTimeout(() => setDm((x) => x.filter((y) => y.id !== id)), dur * 1000 + 300); setTxt(''); }
  }
  useEffect(() => {
    if (!playing) return; let raf = 0, last = 0;
    const loop = (now: number) => {
      if (now - last > 40) {
        last = now; const a = audio.current;
        if (a && isFinite(a.duration) && a.duration > 0) setLp(Math.min(1, a.currentTime / a.duration));
        else { // 时长拿不到（或这句没有音频）：按字数估一个语速，字照样一个个出来
          const l = linesRef.current[idxRef.current]; const n = String(l?.text || '').replace(/\*\*|!!|\(\(|\)\)|\[\[|\]\]/g, '').length;
          const el = a && a.src && !a.error ? a.currentTime : (now - lineStart.current) / 1000;
          setLp(Math.min(1, el / Math.max(1.2, a && a.src && !a.error ? n / 4.2 : 1.6)));
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop); return () => cancelAnimationFrame(raf);
  }, [playing]);

  async function load(id?: string) {
    const lang = (() => { try { return getClientLang(); } catch { return 'zh'; } })();
    const r = await fetch(`/api/ghost?lang=${lang}${id ? `&id=${id}` : ''}`).then((x) => x.json()).catch(() => null);
    if (r) { stop(); setIdx(-1); setEnded(false); setD(r); if (id) window.scrollTo({ top: 0, behavior: 'smooth' }); }
  }
  useEffect(() => { try { setEn(getClientLang() === 'en'); } catch {} load(); return () => stop(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const s = d?.story;
  const lines: any[] = s?.lines || [];
  linesRef.current = lines;
  const castOf = (who: string) => (s?.cast || []).find((c: any) => c.name === who);

  function stop() { clearTimeout(timer.current); try { audio.current?.pause(); } catch {} pauseStoryBgm(); setPlaying(false); }
  useEffect(() => () => stopStoryBgm(), []);
  // 每句的氛围：有配好的线索就用；没有就按位置和标记推一个（前面诡异 → 中段紧张 → 喊叫处惊吓 → 结尾揭晓）
  const lastCat = useRef('');
  function cueFor(i: number) {
    const l = lines[i]; if (!l) return null;
    if (l.cue) return l.cue;
    const f = i / Math.max(1, lines.length - 1);
    const shout = /!!.+?!!/.test(l.text);
    return { mood: shout ? 'scare' : f > 0.88 ? 'reveal' : f > 0.55 ? 'tension' : f > 0.2 ? 'eerie' : 'mystery', sfx: /\[\[.*(门|吱呀|creak|door).*\]\]/i.test(l.text) ? ['creaking_door'] : /\[\[.*(脚步|footstep).*\]\]/i.test(l.text) ? ['footsteps_concrete'] : [], stinger: shout };
  }
  function applyCue(i: number) {
    const c = cueFor(i); if (!c || !soundRef.current) return;
    const cat = STORY_MOODS.find((m) => m.word === c.mood)?.cat || 'PARANORMAL_EVENT';
    setStoryVol(0.2);
    if (cat !== lastCat.current) { lastCat.current = cat; setStoryBgm(cat, 0.2); } else resumeStoryBgm();
    (c.sfx || []).forEach((k: string, n: number) => setTimeout(() => storySfx(k), 300 + n * 900));
    if (c.stinger) setTimeout(() => storyStinger(), 150);
  }
  function playAt(i: number) {
    clearTimeout(timer.current);
    if (i >= lines.length) { setPlaying(false); setEnded(true); setShowAll(false); setIdx(lines.length); stopStoryBgm(); lastCat.current = ''; return; }
    setIdx(i); idxRef.current = i; lineStart.current = performance.now(); setLp(0); setEnded(false); setPlaying(true);
    if (s && lines.length && i >= lines.length * 0.6 && listened !== s.id) { setListened(s.id); fetch('/api/me/listened', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ref: 'ghost:' + s.id, kind: 'ghost', genre: '恐怖 怪谈', real: !!s.real }) }).catch(() => {}); }
    applyCue(i);
    const l = lines[i];
    if (!l?.audio) { audio.current = null; timer.current = setTimeout(() => playAt(i + 1), 1800); return; }
    try { audio.current?.pause(); } catch {}
    const a = new Audio(l.audio); audio.current = a;
    a.onended = () => { const next = lines[i + 1]; const gap = next && next.who !== l.who ? 650 : 280; timer.current = setTimeout(() => playAt(i + 1), gap); };
    a.onerror = () => { timer.current = setTimeout(() => playAt(i + 1), 600); };
    a.play().catch(() => setPlaying(false));
    // 预加载下一句
    if (lines[i + 1]?.audio) { const p = new Audio(); p.preload = 'auto'; p.src = lines[i + 1].audio; }
  }
  function toggleSound() { const v = !soundRef.current; soundRef.current = v; setSound(v); if (v) { lastCat.current = ''; if (idx >= 0) applyCue(idx); } else pauseStoryBgm(); }
  function exitStage() { stop(); setIdx(-1); setShowAll(false); window.scrollTo({ top: 0 }); }
  function toggle() {
    if (playing) { stop(); return; }
    if (idx >= 0 && idx < lines.length && audio.current && audio.current.src) { setPlaying(true); audio.current.play().catch(() => {}); if (soundRef.current) resumeStoryBgm(); return; }
    playAt(idx >= 0 && idx < lines.length ? idx : 0);
  }
  useEffect(() => { if (idx >= 0 && showAll) lineRefs.current[idx]?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, [idx, showAll]);

  const mins = s?.seconds ? Math.max(1, Math.round(s.seconds / 60)) : null;
  const voices = 1 + (s?.cast?.length || 0);
  const prog = lines.length ? Math.max(0, Math.min(1, (idx + (ended ? 1 : 0)) / lines.length)) : 0;

  async function share() {
    const t = L(`今夜怪谈《${s?.title}》：${s?.teaser || ''} mystnight.com/tonight`, `Tonight’s ghost story “${s?.title}”: ${s?.teaser || ''} mystnight.com/tonight`);
    try { if ((navigator as any).share) { await (navigator as any).share({ text: t }); return; } } catch { return; }
    try { await navigator.clipboard.writeText(t); } catch {}
  }

  return (
    <main className="min-h-[100svh] text-parchment pb-40">
      <style>{STAGE_CSS + `@keyframes gsFlicker{0%,100%{opacity:.85;transform:scale(1)}40%{opacity:1;transform:scale(1.04)}60%{opacity:.75;transform:scale(.98)}}.gs-flame{animation:gsFlicker 2.6s ease-in-out infinite}@keyframes gsShake{0%,100%{transform:translate(0,0)}20%{transform:translate(-2px,1px) rotate(-1deg)}40%{transform:translate(2px,-1px) rotate(1deg)}60%{transform:translate(-1px,-1px)}80%{transform:translate(1px,1px)}}.gs-shake{animation:gsShake .35s linear 3}@keyframes gsPulse{0%,100%{box-shadow:0 0 0 0 rgba(232,168,124,0)}50%{box-shadow:0 0 18px 2px rgba(232,168,124,.45)}}.gs-pulse{animation:gsPulse 1.4s ease-in-out 2}@keyframes dmFly{from{transform:translateX(100vw)}to{transform:translateX(-110%)}}.dm-fly{animation:dmFly linear forwards}@keyframes popIn{0%{opacity:0;transform:translateY(8px) scale(.6)}20%{opacity:1;transform:translateY(0) scale(1.08)}30%{transform:scale(1)}85%{opacity:1}100%{opacity:0;transform:translateY(-10px)}}.pop-in{animation:popIn 2.8s ease forwards}@keyframes avFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}.av-float{animation:avFloat 3.2s ease-in-out infinite}`}</style>
      <div aria-hidden className="fixed inset-0 -z-10 transition-[background] duration-[2000ms]" style={{ background: playing ? 'radial-gradient(80% 45% at 50% 18%, rgba(120,30,30,.22), transparent 70%), #07080a' : 'radial-gradient(80% 45% at 50% 18%, rgba(201,140,80,.16), transparent 70%), #0a0b0e' }} />
      <a href="/play" className="fixed left-3 z-30 h-8 px-3 rounded-full flex items-center text-[12.5px] text-parchment/70 border border-white/10 bg-black/50 backdrop-blur" style={{ top: 'calc(env(safe-area-inset-top) + 10px)' }}>{L('← 大厅', '← Hall')}</a>

      <div className="max-w-xl mx-auto px-5" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 64px)' }}>
        {!s ? (
          <div className="pt-24 text-center text-parchment/50">{d && !d.ok ? L('今晚的故事还在路上，晚点再来。', 'Tonight’s story is on its way — check back soon.') : '…'}</div>
        ) : (
          <>
            {(() => { const t = sty(s.style); return (
              <div className="relative overflow-hidden rounded-3xl border px-5 pt-6 pb-5 text-center" style={{ borderColor: t.c + '55', background: `radial-gradient(120% 80% at 50% 0%, ${t.c}33, transparent 60%), linear-gradient(180deg, rgba(20,18,16,.92), rgba(8,8,10,.95))` }}>
                <span aria-hidden className="absolute -right-6 -bottom-8 opacity-[0.12]" style={{ color: t.c }}><Icon n={t.icon} size={150} stroke={1} /></span>
                <div className="relative mx-auto w-10 h-14"><span className="gs-flame absolute left-1/2 -translate-x-1/2 top-0 w-5 h-8 rounded-[50%_50%_50%_50%/60%_60%_40%_40%] bg-[radial-gradient(circle_at_50%_70%,#fff3c4,#f0a35a_45%,rgba(192,69,63,0)_75%)] blur-[1px]" /><span className="absolute left-1/2 -translate-x-1/2 bottom-0 w-3 h-6 rounded-sm bg-[#e9dcc2]/80" /></div>
                <div className="relative mt-3 text-[10.5px] tracking-[.45em] pl-[.45em]" style={{ color: t.c }}>{d?.locked ? L('往期怪谈', 'FROM THE ARCHIVE') : s.no ? L(`今夜怪谈 · 第 ${s.no} 夜`, `TONIGHT · NIGHT ${s.no}`) : L('今夜怪谈', 'TONIGHT')}</div>
                <h1 className="relative mt-2 font-serif font-semibold text-[32px] leading-tight text-[#f7ecd8] [text-shadow:0_2px_30px_rgba(0,0,0,.9)]">{s.title}</h1>
                {s.teaser && <p className="relative mt-2 font-serif italic text-[15px] text-parchment/70">{s.teaser}</p>}
                <div className="relative mt-4 flex items-center justify-center gap-3 text-[12px] text-parchment/50 flex-wrap">
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border" style={{ borderColor: t.c + '55', color: t.c }}><Icon n={t.icon} size={12} />{en ? t.en : t.zh}</span>
                  <span className="inline-flex items-center gap-1.5">{L('吓人程度', 'Fear')} <Fear n={s.fear || 3} c={t.c} /></span>
                  <span className="px-2 py-0.5 rounded-full border border-white/15 text-parchment/55">{s.real ? L('真实经历改编 · AI 整理', 'True story · AI-retold') : L('AI 原创', 'AI original')}</span>
                  <span>{L(`讲述：${s.teller?.name || '朋友'}`, `Told by ${s.teller?.name || 'a friend'}`)}{mins ? L(` · 约 ${mins} 分钟`, ` · ~${mins} min`) : ''}{L(` · ${voices} 个 AI 声音`, ` · ${voices} AI voices`)}</span>
                </div>
              </div>
            ); })()}

            {d?.locked ? (
              <div className="mt-8 rounded-2xl border border-[#c9a96e]/30 bg-[#14120d]/80 px-5 py-5 text-center">
                <div className="flex justify-center text-[#c9a96e]"><Icon n="lock" size={24} /></div>
                <div className="mt-1 font-serif text-[17px] text-[#f2e6d0]">{L('往期怪谈是会员专属', 'Past stories are for members')}</div>
                <p className="mt-1.5 text-[13px] text-parchment/55">{L('今晚的那一篇人人免费。会员、畅玩卡、派对夜卡可以听全部往期。', 'Tonight’s story is free for everyone. Members and pass holders can listen to every past night.')}</p>
                <div className="mt-4 flex justify-center gap-2.5"><a href="/upgrade" className="h-10 px-5 rounded-xl bg-[#c9a96e] text-[#14110a] text-[14px] flex items-center">{L('看看会员', 'See membership')}</a><button onClick={() => load()} className="h-10 px-4 rounded-xl border border-white/15 text-[13.5px]">{L('听今晚的', 'Tonight’s story')}</button></div>
              </div>
            ) : (
              <>
                <div className="mt-7 flex justify-center">
                  <button onClick={toggle} className={`w-20 h-20 rounded-full flex items-center justify-center border transition ${playing ? 'border-[#c0453f]/60 bg-[#2a0e0e]/80 shadow-[0_0_50px_-8px_rgba(192,69,63,.7)]' : 'border-[#e8a87c]/50 bg-[#1a140e]/80 shadow-[0_0_50px_-10px_rgba(232,168,124,.6)]'}`} aria-label="play">
                    {playing ? <svg width="26" height="26" viewBox="0 0 24 24" fill="#f2e6d0"><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg> : <svg width="28" height="28" viewBox="0 0 24 24" fill="#f2e6d0"><path d="M8 5l11 7-11 7z" /></svg>}
                  </button>
                </div>
                <p className="mt-3 text-center text-[12px] text-parchment/40">{idx < 0 ? L('戴上耳机，关掉灯', 'Headphones on, lights off') : ended ? L('讲完了', 'The end') : L(`${idx + 1} / ${lines.length}`, `${idx + 1} / ${lines.length}`)}</p>

                {ended && showAll && (
                <div className="mt-8 space-y-4">
                  {lines.map((l, i) => {
                    const c = l.who !== 'teller' ? castOf(l.who) : null;
                    const cur = i === idx, past = idx >= 0 && i < idx;
                    return (
                      <div key={i} ref={(el) => { lineRefs.current[i] = el; }} onClick={() => playAt(i)} className={`cursor-pointer transition-all duration-500 ${cur ? 'opacity-100' : past ? 'opacity-35' : idx < 0 ? 'opacity-80' : 'opacity-50'}`}>
                        {c && <div className={`mb-1 text-[11px] tracking-[.15em] ${c.gender === 'female' ? 'text-[#e8a0b8]' : 'text-[#8fb8e8]'}`}>{c.name}</div>}
                        <p className={`font-serif leading-[1.9] transition-all duration-500 ${c ? 'pl-3 border-l-2 ' + (c.gender === 'female' ? 'border-[#e8a0b8]/50' : 'border-[#8fb8e8]/50') : ''} ${cur ? 'text-[18.5px] text-[#fff4e0]' : 'text-[16px] text-parchment/85'}`}>{c ? <>「<Beat text={l.text} cur={cur} />」</> : <Beat text={l.text} cur={cur} />}</p>
                      </div>
                    );
                  })}
                </div>

                )}
                {ended && (
                  <div className="mt-10 rounded-2xl border border-[#e8a87c]/30 bg-[#14120d]/80 px-5 py-5 text-center">
                    <div className="font-serif text-[18px] text-[#f2e6d0]">{L('今晚的故事讲完了', 'That’s tonight’s story')}</div>
                    <p className="mt-1 text-[13px] text-parchment/55">{L('明晚换一个新的。睡不着的话……', 'A new one tomorrow night. Can’t sleep?')}</p>
                    <div className="mt-4 grid grid-cols-2 gap-2">
                      <a href="/zh/games/cthulhu" className="h-11 rounded-xl bg-[#7d1d1d] border border-[#a83232]/60 text-[13.5px] flex items-center justify-center">{L('自己走进一个怪谈', 'Step into one yourself')}</a>
                      <button onClick={share} className="h-11 rounded-xl border border-white/15 text-[13.5px]">{L('分享给朋友', 'Share')}</button>
                    </div>
                    <button onClick={() => setShowAll((v) => !v)} className="mt-3 text-[12.5px] text-parchment/50 border-b border-white/15">{showAll ? L('收起全文', 'Hide text') : L('回看全文', 'Read the full text')}</button>
                  </div>
                )}
              </>
            )}

            {(d?.archive?.length || 0) > 0 && (
              <section className="mt-12">
                <div className="text-[11px] tracking-[.28em] text-parchment/40 mb-2">{L('往期怪谈', 'PAST NIGHTS')}{!d.canPast && <span className="ml-2 tracking-normal text-[#c9a96e]/70">{L('· 会员可听', '· members')}</span>}</div>
                <div className="grid grid-cols-2 gap-2.5">
                  {d.archive.map((a: any) => { const t = sty(a.style); return (
                    <button key={a.id} onClick={() => load(a.id)} className="relative overflow-hidden text-left rounded-2xl border p-3.5 min-h-[150px] flex flex-col" style={{ borderColor: t.c + '44', background: `radial-gradient(130% 90% at 100% 0%, ${t.c}2e, transparent 60%), #101114` }}>
                      <span aria-hidden className="absolute -right-4 -bottom-5 opacity-[0.12]" style={{ color: t.c }}><Icon n={t.icon} size={84} stroke={1} /></span>
                      <span className="relative flex items-center justify-between text-[10.5px]" style={{ color: t.c }}><span>{a.no ? L(`第 ${a.no} 夜`, `Night ${a.no}`) : ''}</span>{d.canPast ? <Icon n="play" size={13} /> : <Icon n="lock" size={13} />}</span>
                      <span className="relative mt-auto font-serif text-[16px] leading-snug text-[#f7ecd8] line-clamp-2">{a.title}</span>
                      <span className="relative mt-1 text-[11.5px] leading-snug text-parchment/50 line-clamp-2">{a.teaser}</span>
                      <span className="relative mt-2"><Fear n={a.fear || 3} c={t.c} /></span>
                    </button>
                  ); })}
                </div>
              </section>
            )}
          </>
        )}
      </div>

      {listened && ended && <BadgeCheck en={en} />}
      {s && !d?.locked && idx >= 0 && !ended && (() => {
        const l = lines[Math.min(idx, lines.length - 1)]; const c = l && l.who !== 'teller' ? castOf(l.who) : null;
        const sents = l ? splitSentences(l.text) : []; const loc = locate(sents, lp);
        const prev = loc.si > 0 ? sents[loc.si - 1] : idx > 0 ? splitSentences(lines[idx - 1].text).slice(-1)[0] : '';
        const cue = cueFor(idx); const scary = ['scare', 'eerie', 'cosmic', 'chase', 'tension'].includes(cue?.mood);
        const t = sty(s.style);
        return (
        <div className="fixed inset-0 z-[70] overflow-hidden text-parchment">
          <div aria-hidden className="absolute inset-0 transition-[background] duration-[2500ms]" style={{ background: playing ? 'radial-gradient(90% 55% at 50% 0%, rgba(110,40,40,.24), transparent 65%), #07080a' : 'radial-gradient(90% 55% at 50% 0%, rgba(201,169,110,.14), transparent 65%), #0a0b0e' }} />
          {/* 顶栏 */}
          <header className="absolute top-0 inset-x-0 z-30 bg-gradient-to-b from-[#07080a] via-[#07080a]/85 to-transparent" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
            <div className="max-w-2xl mx-auto h-12 px-3 flex items-center gap-2">
              <button onClick={exitStage} className="shrink-0 h-8 px-3 rounded-full border border-white/10 bg-black/40 text-[12.5px] text-parchment/70">{L('← 返回', '← Back')}</button>
              <div className="flex-1 min-w-0 text-center truncate font-serif text-[15px] text-[#f2e6d0]">{s.title}</div>
              <span className="shrink-0 w-[68px] text-right text-[10.5px] tracking-[.2em]" style={{ color: t.c }}>{s.no ? L(`第 ${s.no} 夜`, `NIGHT ${s.no}`) : ''}</span>
            </div>
          </header>
          <button onClick={() => setShowAll(true)} className="absolute z-20 left-3 h-8 px-3 rounded-full border border-white/10 bg-black/40 text-[12px] text-parchment/60 inline-flex items-center gap-1.5" style={{ top: 'calc(env(safe-area-inset-top) + 54px)' }}><Icon n="scroll" size={14} />{L('全文', 'Full text')}</button>
          <a href={en ? '/en/games/storyteller' : '/zh/games/storyteller'} className="absolute z-20 right-3 h-8 px-3 rounded-full border border-[#c9a96e]/35 bg-black/40 text-[12px] text-[#e6c76e] inline-flex items-center gap-1.5 whitespace-nowrap" style={{ top: 'calc(env(safe-area-inset-top) + 54px)' }}><Icon n="user" size={13} />{L('叫朋友一起听', 'Listen with friends')}</a>

          {/* 舞台：只放正在念的那一句 */}
          <div className="absolute inset-0 flex flex-col items-center justify-center px-6 pb-[230px] pt-24">
            <div className="w-full max-w-2xl">
              <div key={'pv' + idx + '-' + loc.si} className="prev-line mb-6 text-center font-serif text-[15px] leading-relaxed text-parchment/30 line-clamp-2">{(prev || '').replace(/\*\*|!!|\(\(|\)\)|\[\[|\]\]/g, '')}</div>
              {sents[loc.si] ? <StageText key={idx + '-' + loc.si} text={sents[loc.si]} p={lp >= 0.999 ? 1 : loc.sp} scary={scary} calm={['calm', 'tender', 'sad'].includes(cue?.mood)} label={c ? String(c.name) : undefined} labelColor={c ? (c.gender === 'female' ? '#e8a0b8' : '#8fb8e8') : undefined} /> : <div className="text-center text-parchment/40 text-[13px]">…</div>}
            </div>
            <div className="absolute left-1/2 -translate-x-1/2 bottom-[238px] flex gap-1">{lines.map((_, i) => <span key={i} className={`h-[3px] rounded-full transition-all ${i === idx ? 'w-5 bg-[#c9a96e]' : i < idx ? 'w-1.5 bg-[#c9a96e]/45' : 'w-1.5 bg-white/12'}`} />).slice(Math.max(0, idx - 12), idx + 13)}</div>
          </div>

          {/* 弹幕 */}
          <div className="pointer-events-none absolute inset-x-0 z-20 overflow-hidden" style={{ top: 'calc(env(safe-area-inset-top) + 96px)', height: 170 }}>
            {dm.map((x) => <div key={x.id} className="dm-fly absolute left-0 whitespace-nowrap" style={{ top: x.lane * 38 + 6, animationDuration: `${x.dur}s` }}><span className="px-3 py-1 rounded-full text-[15px] font-medium border border-[#e6c76e]/60 text-[#fff1c8] bg-black/30 [text-shadow:0_1px_6px_rgba(0,0,0,.9)]">{x.v}</span></div>)}
          </div>
          {/* 自己的头像 + 冒出来的表情 */}
          <div className="absolute z-30 left-3.5 bottom-[250px]">
            {pop && (
              <div key={pop.id} className="pop-in absolute bottom-[50px] left-0 flex flex-col items-start origin-bottom-left">
                <div className={`w-max rounded-2xl px-2.5 py-1.5 shadow-xl ${pop.kind === 'sticker' ? 'bg-[#1a1712]/95 border border-[#e6c76e]/30' : 'bg-[#f6ecd8] text-[#1a1410] text-[13px] max-w-[180px] leading-snug whitespace-normal'}`}>{pop.kind === 'sticker' ? <Sticker k={pop.v} size={46} /> : pop.v}</div>
                <span className={`w-2.5 h-2.5 -mt-1 ml-4 rotate-45 ${pop.kind === 'sticker' ? 'bg-[#1a1712] border-r border-b border-[#e6c76e]/30' : 'bg-[#f6ecd8]'}`} />
              </div>
            )}
            <div className="av-float flex flex-col items-center"><span className="w-11 h-11 rounded-full border-2 border-[#e6c76e]/70 shadow-[0_0_24px_-4px_rgba(230,199,110,.55)] bg-[#1c1d22] flex items-center justify-center font-serif text-[16px] text-parchment/85">{L('我', 'Me')}</span></div>
          </div>

          {showAll && (
            <div className="absolute inset-0 z-40 bg-[#07080a]/96 overflow-y-auto px-5 pb-40" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 60px)' }}>
              <button onClick={() => setShowAll(false)} className="fixed right-3 z-50 h-9 px-3.5 rounded-full bg-[#c9a96e] text-[#14110a] text-[13px]" style={{ top: 'calc(env(safe-area-inset-top) + 12px)' }}>{L('回到大字', 'Back')}</button>
              <article className="max-w-2xl mx-auto space-y-4">
                <h2 className="font-serif text-[22px] text-[#f7ecd8] text-center mb-4">{s.title}</h2>
                {lines.map((ln, i) => { const cc = ln.who !== 'teller' ? castOf(ln.who) : null; return (
                  <div key={i} ref={(el) => { lineRefs.current[i] = el; }} onClick={() => { setShowAll(false); playAt(i); }} className={`cursor-pointer ${i === idx ? 'opacity-100' : 'opacity-60'}`}>
                    {cc && <div className={`mb-1 text-[11px] tracking-[.15em] ${cc.gender === 'female' ? 'text-[#e8a0b8]' : 'text-[#8fb8e8]'}`}>{cc.name}</div>}
                    <p className={`font-serif leading-[1.95] text-[16px] ${cc ? 'pl-3 border-l-2 ' + (cc.gender === 'female' ? 'border-[#e8a0b8]/50' : 'border-[#8fb8e8]/50') : ''} ${i === idx ? 'text-[#fff4e0]' : 'text-parchment/80'}`}>{cc ? <>「<Beat text={ln.text} cur={false} />」</> : <Beat text={ln.text} cur={false} />}</p>
                  </div>
                ); })}
              </article>
            </div>
          )}

          {/* 底部：播放 + 表情 + 弹幕 */}
          <div className="absolute bottom-0 inset-x-0 z-30 bg-gradient-to-t from-[#07080a] via-[#07080a]/95 to-transparent pt-8" style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}>
            <div className="max-w-2xl mx-auto px-4 space-y-2.5">
              <div className="flex items-center gap-2.5">
                <button onClick={() => playAt(Math.max(0, idx - 1))} className="shrink-0 w-8 h-8 flex items-center justify-center text-parchment/60" aria-label="prev"><Icon n="prev" size={18} /></button>
                <button onClick={toggle} className={`shrink-0 w-12 h-12 rounded-full flex items-center justify-center ${playing ? 'bg-[#f2e6d0] text-[#0a0b0e]' : 'bg-[#7d1d1d] border border-[#a83232]/60 text-[#f6ecd0] shadow-[0_0_30px_-6px_rgba(192,69,63,.7)]'}`} aria-label="play"><Icon n={playing ? 'pause' : 'play'} size={20} /></button>
                <button onClick={() => playAt(idx + 1)} className="shrink-0 w-8 h-8 flex items-center justify-center text-parchment/60" aria-label="next"><Icon n="next" size={18} /></button>
                <div className="flex-1 min-w-0">
                  <input type="range" min={0} max={Math.max(0, lines.length - 1)} step={1} value={Math.max(0, idx)} onChange={(e) => playAt(Number(e.target.value))} className="w-full accent-[#c9a96e]" />
                  <div className="flex justify-between text-[10.5px] text-parchment/40"><span>{idx + 1}</span><span>{c ? c.name : L(`讲述：${s.teller?.name || '朋友'}`, s.teller?.name || 'Narrator')}</span><span>{lines.length}</span></div>
                </div>
                <button onClick={toggleSound} className={`shrink-0 h-9 px-2.5 rounded-full border flex flex-col items-center justify-center leading-none ${sound ? 'border-[#c9a96e]/40 text-[#e6c76e]' : 'border-white/10 text-parchment/35'}`} aria-label="ambience"><span className="text-[10.5px]">{L('氛围音', 'Ambience')}</span><span className="mt-0.5 text-[9.5px] opacity-80">{sound ? L('开', 'on') : L('关', 'off')}</span></button>
              </div>
              <div className="flex items-center gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {STICKERS.map((st) => (
                  <button key={st.k} onClick={() => say('sticker', st.k)} className="shrink-0 flex flex-col items-center gap-0.5 px-1.5 py-1 rounded-xl hover:bg-white/[0.05] active:scale-90 transition-transform">
                    <Sticker k={st.k} size={34} /><span className="text-[10px] text-parchment/55">{en ? st.en : st.zh}</span>
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <input value={txt} onChange={(e) => setTxt(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && say('text', txt)} maxLength={40} placeholder={L('发条弹幕，说说你的感受…', 'Say something…')} className="flex-1 min-w-0 h-11 px-4 rounded-full bg-[#121318] border border-white/10 text-[14px] text-parchment placeholder:text-parchment/30 outline-none focus:border-[#c9a96e]/50" />
                <button onClick={() => say('text', txt)} disabled={!txt.trim()} className="shrink-0 h-11 px-5 rounded-full bg-[#c9a96e] text-[#14110a] text-[14px] font-medium disabled:opacity-40">{L('发送', 'Send')}</button>
              </div>
            </div>
          </div>
        </div>
        );
      })()}
    </main>
  );
}
