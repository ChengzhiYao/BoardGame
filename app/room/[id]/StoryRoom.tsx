'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { STORY_GENRES, STORY_HORROR_SUB, STORY_TONES } from '@/lib/story/prompt';
import type { ShellProps } from './RoomShell';

export default function StoryRoom(props: ShellProps) {
  const router = useRouter();
  const supabase = useRef(createClient()).current;
  const st: any = props.storyState;
  const en = (props.room.language || 'zh') === 'en';
  const isHost = props.room.host_user_id === props.userId;
  const phase: string = st?.phase || props.room.story_phase || 'setup';
  const generating = props.room.modules_generating || props.room.story_phase === 'generating';
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);

  // setup form
  const [genres, setGenres] = useState<string[]>([]);
  const [tone, setTone] = useState('');
  const [hero, setHero] = useState('');
  const [theme, setTheme] = useState('');
  const [world, setWorld] = useState('');
  const [special, setSpecial] = useState('');
  const [forbidden, setForbidden] = useState('');
  const [showCustom, setShowCustom] = useState(false);
  const [horrorSub, setHorrorSub] = useState<string[]>([]);
  const [reviseNote, setReviseNote] = useState('');
  const [deepMsg, setDeepMsg] = useState('');
  const [showCompare, setShowCompare] = useState(false);
  const [onlyUp, setOnlyUp] = useState(false);
  const autoGen = useRef(false);

  useEffect(() => {
    const ch = supabase.channel(`story-${props.room.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'story_state', filter: `room_id=eq.${props.room.id}` }, () => router.refresh())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms', filter: `id=eq.${props.room.id}` }, () => router.refresh())
      .subscribe();
    const id = setInterval(() => { if (typeof document !== 'undefined' && !document.hidden) router.refresh(); }, 4000);
    return () => { clearInterval(id); supabase.removeChannel(ch); };
  }, [props.room.id, supabase, router]);

  // 一进来先自动生成 3 个推荐故事（房主，仅一次）；定制藏在按钮后面
  useEffect(() => {
    if (isHost && !generating && (phase === 'setup' || !st) && !autoGen.current) { autoGen.current = true; generate(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHost, generating, phase, st]);

  async function call(url: string, body: any) {
    if (inFlight.current) return null;
    inFlight.current = true; setBusy(true);
    try {
      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { alert(d?.error || (en ? 'Error' : '出错了')); return null; }
      router.refresh(); return d;
    } catch (e: any) { alert((en ? 'Failed: ' : '失败：') + e.message); return null; }
    finally { inFlight.current = false; setBusy(false); }
  }
  const genParams = () => ({ genres, horror_sub: genres.includes('horror') ? horrorSub : [], tone, hero, theme, world, special, forbidden });
  function generate() { call('/api/story/options', { roomId: props.room.id, params: genParams() }); }
  function write(id: number) { call('/api/story/write', { roomId: props.room.id, optionId: id }); }
  async function revise(intensity: 'light' | 'medium' | 'deep') {
    const d = await call('/api/story/revise', { roomId: props.room.id, mode: 'revise', note: reviseNote, intensity });
    if (d && d.improved === false) {
      alert(en ? `Tried 2 rewrites but none beat the current score (${d.from}). Kept the current version.` : `试了 2 个改写都没超过当前分数（${d.from}），已保留当前版本，没有变差。${intensity !== 'deep' ? '可以试更高强度的「深改冲90」，或' : '可'}在输入框写明要提升哪里再试。`);
    }
  }
  function rerate() { call('/api/story/revise', { roomId: props.room.id, mode: 'rerate' }); }
  function genNarration() { call('/api/story/tts', { roomId: props.room.id }); }
  function nextStory() { call('/api/story/next', { roomId: props.room.id }); }
  async function deepRevise() {
    const target = 90, maxRounds = 4;
    let last = 0, stalled = false;
    for (let i = 0; i < maxRounds; i++) {
      setDeepMsg(en ? `Deep revise — round ${i + 1}/${maxRounds}…` : `深度改稿中 · 第 ${i + 1}/${maxRounds} 轮…`);
      const d = await call('/api/story/revise', { roomId: props.room.id, mode: 'revise', note: reviseNote, intensity: 'deep' });
      if (!d) break;
      last = Number(d.to) || last;
      if (d.improved === false) { stalled = true; break; }
      if (last >= target) break;
    }
    setDeepMsg(en ? (last >= target ? `Reached ${last} 🎉` : stalled ? `Topped out at ${last}` : `Now ${last}`) : (last >= target ? `已冲到 ${last} 🎉` : stalled ? `已到瓶颈 ${last}，无法再提升` : `已提升到 ${last}`));
    setTimeout(() => setDeepMsg(''), 4000);
  }
  async function replay() { await fetch('/api/rooms/replay', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ roomId: props.room.id }) }); if (typeof window !== 'undefined') window.location.reload(); }

  const Header = (
    <header className="px-4 py-3 border-b border-eldritch/20 flex items-center justify-between">
      <span className="font-serif text-parchment">📖 {en ? 'Storyteller' : '讲故事'} · {props.room.name}</span>
      {isHost && (phase === 'reading' || phase === 'select') && <button onClick={replay} className="text-xs px-3 py-1.5 rounded bg-fog border border-eldritch/30 text-parchment/70">{en ? '↻ New story' : '↻ 重新开始'}</button>}
    </header>
  );

  if (generating) {
    return (<main className="h-[100svh] flex flex-col">{Header}<div className="flex-1 flex flex-col items-center justify-center gap-3 text-center px-6"><div className="w-8 h-8 border-2 border-eldritch/30 border-t-eldritch rounded-full animate-spin" /><p className="text-parchment/60">{en ? 'Weaving the story…' : '正在编织故事……'}</p></div></main>);
  }

  // ---------------- SETUP → 自动生成 3 个推荐 ----------------
  if (phase === 'setup' || !st) {
    if (!isHost) return (<main className="h-[100svh] flex flex-col">{Header}<div className="flex-1 flex items-center justify-center text-parchment/50">{en ? 'Waiting for the host…' : '等待房主…'}</div></main>);
    return (<main className="h-[100svh] flex flex-col">{Header}<div className="flex-1 flex flex-col items-center justify-center gap-3 text-center px-6"><div className="w-8 h-8 border-2 border-eldritch/30 border-t-eldritch rounded-full animate-spin" /><p className="text-parchment/60">{en ? 'Picking 3 stories for you…' : '正在为你挑选 3 个推荐故事……'}</p></div></main>);
  }

  // ---------------- SELECT ----------------
  if (phase === 'select') {
    return (
      <main className="h-[100svh] flex flex-col">{Header}
        <div className="flex-1 overflow-y-auto px-5 py-6">
          <div className="max-w-2xl mx-auto space-y-4">
            <h1 className="text-xl font-serif text-parchment text-center">{en ? 'Pick a story' : '选一个故事'}</h1>
            {!isHost && <p className="text-center text-parchment/50 text-sm">{en ? 'The host is choosing…' : '由房主挑选…'}</p>}
            <div className="grid gap-3">
              {(st.options || []).map((o: any) => (
                <div key={o.id} className="rounded-xl bg-fog/70 border border-eldritch/30 p-4 space-y-1.5">
                  <div className="flex items-start justify-between gap-2"><div className="font-serif text-parchment">{o.title}</div>{o.fromLibrary ? <span className="text-amber-400 text-sm shrink-0" title={en ? 'Saved high-scorer (precise rating)' : '精选库 · 真实精确评分'}>★ {o.appeal} <span className="text-[10px]">{en ? 'saved' : '精选'}</span></span> : <span className="text-parchment/40 text-[11px] shrink-0" title={en ? 'Premise appeal — not the final precise rating' : '开场卖相分，非成稿精确评分'}>{en ? 'appeal' : '卖相'} {o.appeal}</span>}</div>
                  <div className="text-[11px] text-eldritch/80">{o.genre} · {o.mood} · ~{o.est_minutes}min</div>
                  <div className="text-sm text-parchment/75">🪝 {o.logline}</div>
                  {isHost && <button onClick={() => write(o.id)} disabled={busy} className="mt-1 w-full py-2 rounded bg-blood/80 hover:bg-blood text-parchment text-sm border border-blood disabled:opacity-50">{en ? 'Write this story →' : '写这个故事 →'}</button>}
                </div>
              ))}
            </div>
            {isHost && (
              <div className="space-y-3">
                <div className="flex gap-2">
                  <button onClick={generate} disabled={busy} className="flex-1 py-2 rounded bg-fog border border-eldritch/30 text-parchment/70 text-sm">↻ {en ? 'Regenerate 3' : '换一批'}</button>
                  <button onClick={() => setShowCustom((v) => !v)} className="flex-1 py-2 rounded bg-fog border border-eldritch/30 text-parchment/70 text-sm">🎨 {en ? 'Customize' : '定制方向'}</button>
                </div>
                {showCustom && (
                  <div className="rounded-xl bg-fog/50 border border-eldritch/25 p-4 space-y-4 text-left">
                    <div>
                      <div className="text-sm text-parchment/70 mb-2">{en ? 'Genres (multi-select)' : '题材风格（可多选）'}</div>
                      <div className="flex flex-wrap gap-2">{STORY_GENRES.map((g) => { const on = genres.includes(g.key); return <button key={g.key} onClick={() => setGenres((v) => on ? v.filter((x) => x !== g.key) : [...v, g.key])} className={`px-3 py-1.5 rounded-full text-sm border ${on ? 'bg-blood/30 border-blood text-parchment' : 'bg-fog border-eldritch/30 text-parchment/60'}`}>{en ? g.en : g.cn}</button>; })}</div>
                      {genres.includes('horror') && (
                        <div className="mt-3">
                          <div className="text-[12px] text-parchment/55 mb-1.5">{en ? 'Horror subtype (multi-select)' : '恐怖体系细分（可多选）'}</div>
                          <div className="flex flex-wrap gap-2">{STORY_HORROR_SUB.map((h) => { const on = horrorSub.includes(h.key); return <button key={h.key} onClick={() => setHorrorSub((v) => on ? v.filter((x) => x !== h.key) : [...v, h.key])} className={`px-2.5 py-1 rounded-full text-xs border ${on ? 'bg-blood/30 border-blood text-parchment' : 'bg-fog border-eldritch/25 text-parchment/55'}`}>{en ? h.en : h.cn}</button>; })}</div>
                        </div>
                      )}
                    </div>
                    <label className="block"><div className="text-sm text-parchment/70 mb-1">{en ? 'Tone' : '基调'}</div>
                      <select value={tone} onChange={(e) => setTone(e.target.value)} className="w-full px-3 py-2 rounded bg-fog border border-eldritch/30 text-parchment text-sm"><option value="">{en ? '— any —' : '— 不限 —'}</option>{STORY_TONES.map((t) => <option key={t.key} value={t.key}>{en ? t.en : t.cn}</option>)}</select>
                    </label>
                    <Field label={en ? 'Main character / name' : '主角 / 称呼'} value={hero} onChange={setHero} ph={en ? 'e.g. her name, “you”…' : '例如：她的名字、"你"…'} />
                    <Field label={en ? 'Theme / feeling' : '想表达的主题 / 情绪'} value={theme} onChange={setTheme} ph={en ? 'e.g. the long wait of love apart' : '例如：异地恋的等待、重逢、守护'} />
                    <Field label={en ? 'Setting / world' : '背景 / 世界'} value={world} onChange={setWorld} ph={en ? 'e.g. a snowy little town' : '例如：雪夜小镇、现代都市、古风江湖'} />
                    <Field label={en ? 'Special requests' : '特别要求'} value={special} onChange={setSpecial} ph={en ? 'e.g. include our inside joke…' : '例如：写进我们的小默契…'} />
                    <Field label={en ? 'Avoid' : '必须避免'} value={forbidden} onChange={setForbidden} ph={en ? 'e.g. nothing too sad' : '例如：不要太悲伤、不要血腥'} />
                    <button onClick={generate} disabled={busy} className="w-full py-2.5 rounded bg-blood/80 hover:bg-blood text-parchment border border-blood text-sm disabled:opacity-50">{en ? 'Generate in this direction →' : '按这个方向生成 →'}</button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </main>
    );
  }

  // ---------------- READING ----------------
  const story = st?.full;
  const r = st?.rating;
  return (
    <main className="h-[100svh] flex flex-col">{Header}
      <div className="flex-1 overflow-y-auto px-5 py-6">
        <div className="max-w-2xl mx-auto space-y-6">
          {st?.narration?.url && <StoryPlayer url={st.narration.url} playback={st?.playback} roomId={props.room.id} en={en} />}
          {isHost && (
            <div className="flex justify-center">
              <button onClick={genNarration} disabled={busy} className="text-xs px-4 py-2 rounded-full bg-fog border border-eldritch/30 text-parchment/75 disabled:opacity-50">{busy ? (en ? 'Synthesizing…' : '合成中…') : (st?.narration?.url ? (en ? '🔁 Regenerate narration' : '🔁 重新生成朗读') : (en ? '🔊 Generate narration (Azure voice)' : '🔊 生成朗读（Azure 语音）'))}</button>
            </div>
          )}
          {!isHost && !st?.narration?.url && <p className="text-center text-[12px] text-parchment/40">{en ? 'Waiting for the host to generate narration…' : '等房主生成朗读…'}</p>}
          <article className="space-y-4">
            <h1 className="text-2xl font-serif text-parchment text-center">{story?.title}</h1>
            <div className="text-[15px] leading-[1.9] text-parchment/90 whitespace-pre-wrap font-serif">{story?.story}</div>
          </article>

          {r && <Scorecard r={r} en={en} />}
          {isHost && (
            <button onClick={nextStory} disabled={busy} className="w-full py-3 rounded-xl bg-eldritch/20 hover:bg-eldritch/30 text-parchment border border-eldritch/40 text-sm disabled:opacity-50">{en ? '→ Next story' : '→ 听下一个故事'}</button>
          )}
          {typeof st?.revisedFrom === 'number' && r && (
            <div className="text-center text-[12px] text-parchment/50">{en ? 'Revised from ' : '改稿前 '}{st.revisedFrom}{en ? ' → now ' : ' → 现在 '}{Number(r.overall)} {Number(r.overall) > st.revisedFrom ? '↑' : ''}</div>
          )}
          {isHost && story?.story && (
            <div className="space-y-2 pt-1">
              <textarea value={reviseNote} onChange={(e) => setReviseNote(e.target.value)} rows={2} placeholder={en ? 'Optional: what to improve, e.g. “the ending feels lazy, make it land harder”…' : '可选：想重点提升的地方，例如"结尾太敷衍，重点加强结尾的力度和余味"…'} className="w-full px-3 py-2 rounded bg-fog border border-eldritch/30 text-parchment placeholder:text-parchment/30 text-sm outline-none focus:border-eldritch resize-none" />
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => revise('light')} disabled={busy} className="py-2.5 rounded bg-fog hover:bg-eldritch/15 text-parchment/85 border border-eldritch/30 text-sm disabled:opacity-50" title={en ? 'Polish only — keep structure' : '只改语言/节奏/细节，不动结构。约 +1~3'}>{en ? '🪶 Light polish' : '🪶 轻改润色'}</button>
                <button onClick={() => revise('medium')} disabled={busy} className="py-2.5 rounded bg-fog hover:bg-eldritch/15 text-parchment/85 border border-eldritch/30 text-sm disabled:opacity-50" title={en ? 'Keep mainline, add scenes / cut exposition' : '保留主线，加强场景、删解释、强化人物关系。约 +3~6'}>{en ? '🛠 Medium boost' : '🛠 中改增强'}</button>
              </div>
              <button onClick={deepRevise} disabled={busy} className="w-full py-2.5 rounded bg-blood/80 hover:bg-blood text-parchment border border-blood text-sm disabled:opacity-50" title={en ? 'Allow structural changes; multi-round' : '允许改结构/人物功能/结尾回扣，自动多轮'}>{busy ? (en ? 'Working…' : '改写中…') : (en ? '🔥 Deep revise — aim 90 (structural, multi-round)' : '🔥 深改冲90（允许改结构 · 自动多轮）')}</button>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={rerate} disabled={busy} className="py-2 rounded bg-fog border border-eldritch/30 text-parchment/70 text-sm disabled:opacity-50">{en ? '↻ Re-rate' : '↻ 重新评分'}</button>
                {st?.prevRating && <button onClick={() => setShowCompare((v) => !v)} className="py-2 rounded bg-fog border border-eldritch/30 text-parchment/70 text-sm">{showCompare ? (en ? '✕ Hide compare' : '✕ 收起对比') : (en ? '📊 Before/After' : '📊 改前改后对比')}</button>}
              </div>
              {showCompare && st?.prevRating && st?.rating && <Comparison prev={st.prevRating} cur={st.rating} en={en} onlyUp={onlyUp} setOnlyUp={setOnlyUp} />}
              {deepMsg && <p className="text-[12px] text-eldritch text-center animate-pulse">{deepMsg}</p>}
              <p className="text-[11px] text-parchment/40 text-center">{en ? 'Each pass writes 2 candidates and keeps the best only if it beats the current score — never worse. Reaching 90 usually needs structural (deep) changes, not just polish.' : '每次写 2 稿、只保留分更高的一版——只升不降。要破 88/90 通常得靠「深改」动结构，光润色到不了。满 85 自动入库。'}</p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

function Comparison({ prev, cur, en, onlyUp, setOnlyUp }: { prev: any; cur: any; en: boolean; onlyUp: boolean; setOnlyUp: (v: boolean) => void }) {
  const prevBy: Record<string, any> = Object.fromEntries((prev?.dimensions || []).map((d: any) => [d.key, d]));
  let rows = (cur?.dimensions || []).map((d: any) => { const o = prevBy[d.key]; const old = o ? Number(o.score) : null; const cu = Number(d.score) || 0; return { label: d.label, old, cu, delta: old == null ? null : cu - old }; });
  if (onlyUp) rows = rows.filter((r: any) => (r.delta || 0) > 0);
  const od = Number(prev?.overall) || 0, nd = Number(cur?.overall) || 0; const od2 = Math.round((nd - od) * 10) / 10;
  return (
    <div className="rounded-xl bg-fog/60 border border-eldritch/30 p-4 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm text-parchment/70">{en ? 'Before → After' : '改前 → 改后'}</span>
        <span className="text-sm"><span className="text-parchment/45">{od}</span> <span className="text-parchment/40">→</span> <b className={nd >= od ? 'text-green-400' : 'text-blood'}>{nd}</b>{od2 !== 0 && <span className={`ml-1 text-[11px] ${od2 > 0 ? 'text-green-400' : 'text-blood'}`}>({od2 > 0 ? '+' : ''}{od2})</span>}</span>
      </div>
      <button onClick={() => setOnlyUp(!onlyUp)} className={`text-[11px] px-2 py-0.5 rounded-full border ${onlyUp ? 'bg-green-500/20 border-green-500/50 text-green-300' : 'bg-fog border-eldritch/30 text-parchment/55'}`}>{onlyUp ? (en ? '✓ Only improved' : '✓ 只看提升项') : (en ? 'Show only improved' : '只看提升项')}</button>
      <div className="space-y-0.5 pt-1">
        {rows.length === 0 && <div className="text-[12px] text-parchment/40">{en ? 'No dimension improved this pass.' : '这一版没有任何维度提升。'}</div>}
        {rows.map((r: any, i: number) => {
          const col = r.delta == null ? 'text-parchment/50' : r.delta > 0 ? 'text-green-400' : r.delta < 0 ? 'text-blood' : 'text-parchment/40';
          return (
            <div key={i} className={`flex items-center justify-between text-[12px] px-1.5 py-0.5 rounded ${r.delta && r.delta > 0 ? 'bg-green-500/10' : r.delta && r.delta < 0 ? 'bg-blood/10' : ''}`}>
              <span className="text-parchment/65">{r.label}</span>
              <span className={col}>{r.old != null ? `${r.old} → ` : ''}{r.cu}{r.delta ? ` ${r.delta > 0 ? '▲+' : '▼'}${r.delta > 0 ? r.delta : r.delta}` : ''}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StoryPlayer({ url, playback, roomId, en }: { url: string; playback: any; roomId: string; en: boolean }) {
  const aRef = useRef<HTMLAudioElement | null>(null);
  const [cur, setCur] = useState(0);
  const [dur, setDur] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [needGesture, setNeedGesture] = useState(false);
  const seeking = useRef(false);

  function post(playing: boolean, position: number) {
    fetch('/api/story/playback', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ roomId, playing, position }) }).catch(() => {});
  }
  // 应用远端播放状态（对方按了播放/暂停/拖动 → 本地跟随）
  useEffect(() => {
    const a = aRef.current; if (!a || !playback) return;
    const drift = playback.playing ? Math.max(0, (Date.now() - (Number(playback.ts) || Date.now())) / 1000) : 0;
    const target = (Number(playback.position) || 0) + drift;
    if (isFinite(target) && Math.abs(a.currentTime - target) > 1.2 && !seeking.current) { try { a.currentTime = target; } catch {} }
    if (playback.playing) { if (a.paused) a.play().then(() => setNeedGesture(false)).catch(() => setNeedGesture(true)); }
    else { if (!a.paused) a.pause(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playback?.playing, playback?.position, playback?.ts]);

  function toggle() {
    const a = aRef.current; if (!a) return;
    if (a.paused) { a.play().then(() => setNeedGesture(false)).catch(() => setNeedGesture(true)); post(true, a.currentTime); }
    else { a.pause(); post(false, a.currentTime); }
  }
  const fmt = (s: number) => { s = Math.max(0, Math.floor(s || 0)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
  return (
    <div className="sticky top-0 z-10 rounded-xl bg-fog/95 backdrop-blur border border-eldritch/30 p-3 flex items-center gap-3 shadow-lg">
      <audio ref={aRef} src={url} preload="auto"
        onLoadedMetadata={(e) => setDur(e.currentTarget.duration || 0)}
        onPlay={() => setIsPlaying(true)} onPause={() => setIsPlaying(false)}
        onTimeUpdate={(e) => { if (!seeking.current) setCur(e.currentTarget.currentTime || 0); }}
        onEnded={() => post(false, 0)} />
      <button onClick={toggle} className="w-10 h-10 rounded-full bg-blood/80 hover:bg-blood text-parchment flex items-center justify-center shrink-0 text-lg">{isPlaying ? '⏸' : '▶'}</button>
      <input type="range" min={0} max={dur || 0} step={0.1} value={Math.min(cur, dur || 0)}
        onChange={(e) => { const a = aRef.current; if (!a) return; seeking.current = true; const t = Number(e.target.value); setCur(t); a.currentTime = t; }}
        onMouseUp={(e) => { const a = aRef.current; seeking.current = false; post(!!a && !a.paused, Number((e.target as HTMLInputElement).value)); }}
        onTouchEnd={(e) => { const a = aRef.current; seeking.current = false; post(!!a && !a.paused, Number((e.target as HTMLInputElement).value)); }}
        className="flex-1 accent-blood cursor-pointer" />
      <span className="text-[11px] text-parchment/60 tabular-nums shrink-0">{fmt(cur)} / {fmt(dur)}</span>
      {needGesture && <button onClick={toggle} className="text-[11px] text-amber-300 shrink-0">{en ? 'tap ▶' : '点▶继续'}</button>}
    </div>
  );
}

function Field({ label, value, onChange, ph }: { label: string; value: string; onChange: (v: string) => void; ph: string }) {
  return (
    <label className="block"><div className="text-sm text-parchment/70 mb-1">{label}</div>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={ph} className="w-full px-3 py-2 rounded bg-fog border border-eldritch/30 text-parchment placeholder:text-parchment/30 text-sm outline-none focus:border-eldritch" />
    </label>
  );
}

function Bar({ label, score }: { label: string; score: number; note?: string }) {
  const s = Math.max(0, Math.min(10, Number(score) || 0));
  const col = s >= 8.5 ? 'bg-green-500' : s >= 7 ? 'bg-eldritch' : s >= 5 ? 'bg-amber-500' : 'bg-blood';
  return (
    <div className="flex items-center gap-2">
      <span className="w-20 text-[11px] text-parchment/60 shrink-0">{label}</span>
      <div className="flex-1 h-1.5 rounded bg-ink overflow-hidden"><div className={`h-full ${col}`} style={{ width: `${s * 10}%` }} /></div>
      <span className="w-10 text-right text-[11px] text-parchment/70">{s}<span className="text-parchment/30">/10</span></span>
    </div>
  );
}

function Scorecard({ r, en }: { r: any; en: boolean }) {
  const dims: any[] = Array.isArray(r.dimensions) ? r.dimensions : [];
  const overall = Number(r.overall) || 0;
  const col = overall >= 85 ? 'text-green-400' : overall >= 70 ? 'text-eldritch' : overall >= 50 ? 'text-amber-400' : 'text-blood';
  return (
    <div className="rounded-xl bg-fog/60 border border-eldritch/30 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm text-parchment/70">{en ? 'Precise rating' : '精确评分'}</span>
        <span className={`text-3xl font-serif ${col}`}>{overall}<span className="text-xs text-parchment/40"> /100</span></span>
      </div>
      {Array.isArray(r.tags) && r.tags.length > 0 && <div className="flex flex-wrap gap-1.5">{r.tags.map((t: string, i: number) => <span key={i} className="text-[11px] px-2 py-0.5 rounded-full bg-eldritch/20 text-parchment/70">{t}</span>)}</div>}
      <div className="space-y-1.5">
        {dims.map((d: any, i: number) => <Bar key={i} label={d.label} score={d.score} />)}
        {r.flavor && <Bar label={`✦ ${r.flavor.label}`} score={r.flavor.score} />}
      </div>
      {Array.isArray(dims) && dims.some((d: any) => d.note) && (
        <div className="text-[11px] text-parchment/45 space-y-0.5 pt-1 border-t border-eldritch/15">
          {dims.filter((d: any) => d.note).map((d: any, i: number) => <div key={i}>{d.label}：{d.note}</div>)}
        </div>
      )}
      {r.verdict && <div className="text-sm text-parchment/85 italic pt-1">“{r.verdict}”</div>}
      {Array.isArray(r.highlights) && r.highlights.length > 0 && <div className="text-[12px] text-green-300/80">✦ {r.highlights.join(' · ')}</div>}
      {r.improve && <div className="text-[12px] text-amber-300/70">{en ? 'To improve: ' : '可改进：'}{r.improve}</div>}
      {(r.cap || r.potential) && (
        <div className="mt-1 pt-2 border-t border-eldritch/15 space-y-1.5">
          <div className="text-[11px] text-parchment/55 font-medium">{en ? 'Revision potential' : '改稿潜力诊断'}</div>
          {r.cap && (
            <div className="text-[11px] text-blood/90">{en ? `Structurally capped at ${r.cap}` : `结构性封顶 ${r.cap} 分`}{Array.isArray(r.capReasons) && r.capReasons.length ? `（${r.capReasons.join('、')}）` : ''}{en ? ' — only structural changes break this.' : '——光润色破不了，得动结构。'}</div>
          )}
          {r.potential && (
            <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-parchment/60">
              {Number(r.potential.light_max) > 0 && <span>{en ? 'Light→' : '轻改→'}<b className="text-parchment/80">{r.potential.light_max}</b></span>}
              {Number(r.potential.medium_max) > 0 && <span>{en ? 'Medium→' : '中改→'}<b className="text-parchment/80">{r.potential.medium_max}</b></span>}
              {Number(r.potential.deep_max) > 0 && <span>{en ? 'Deep→' : '深改→'}<b className="text-green-300/90">{r.potential.deep_max}</b></span>}
            </div>
          )}
          {Array.isArray(r.potential?.blockers) && r.potential.blockers.length > 0 && (
            <div className="text-[11px] text-parchment/50">{en ? 'Blockers: ' : '卡分主因：'}{r.potential.blockers.join('；')}</div>
          )}
          {r.potential?.best_fix && <div className="text-[11px] text-eldritch/90">{en ? 'Best fix: ' : '最优改法：'}{r.potential.best_fix}</div>}
        </div>
      )}
    </div>
  );
}
