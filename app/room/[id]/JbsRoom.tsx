'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { ShellProps } from './RoomShell';

const EN = (l?: string) => l === 'en';
const ACTS_ZH = ['', '案件开场', '搜证', '人物关系', '关键证据', '推理讨论', '最终指认', '真相揭晓'];
const ACTS_EN = ['', 'Opening', 'Investigate', 'Relationships', 'Key Evidence', 'Discussion', 'Accusation', 'Reveal'];

export default function JbsRoom(props: ShellProps) {
  const router = useRouter();
  const supabase = useRef(createClient()).current;
  const lang = props.room.language || 'zh';
  const en = EN(lang);
  const [messages, setMessages] = useState<any[]>(props.initialMessages);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [headcount, setHeadcount] = useState(6);
  const [pace, setPace] = useState(9);
  const [now, setNow] = useState(Date.now());
  const [showRole, setShowRole] = useState(false);
  const [showCustom, setShowCustom] = useState(false);
  const [custom, setCustom] = useState<Record<string, string>>({});
  const [showCards, setShowCards] = useState(false);
  const [showClues, setShowClues] = useState(false);
  const [showRes, setShowRes] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const phase = props.room.jbs_phase as string | undefined;
  const act = props.room.jbs_act || 1;
  const generating = props.room.modules_generating;
  const isHost = props.room.host_user_id === props.userId;
  const chars = props.jbsCharacters || [];
  const myChar = chars.find((c: any) => c.assigned_seat === props.mySeat);
  const inviteUrl = `${typeof window !== 'undefined' ? window.location.origin : props.siteUrl}/join/${props.inviteToken}`;
  const roleMsgs = messages.filter((m) => m.payload?.type === 'jbs_role');
  const clueList = messages.filter((m) => m.payload?.type === 'jbs_evidence' || m.payload?.type === 'private');
  const keyFound = messages.some((m: any) => m.payload?.type === 'jbs_evidence' && m.payload?.key && m.turn_no === (props.room.jbs_act || 1));
  const resources: any[] = Array.isArray(props.room.jbs_resources) ? props.room.jbs_resources : [];
  // 本幕倒计时
  const totalActs = props.room.jbs_total_acts || 7;
  const actNames: string[] = Array.isArray(props.room.jbs_act_names) ? props.room.jbs_act_names : [];
  const actName = actNames[act - 1] || (en ? ACTS_EN[act] || '' : ACTS_ZH[act] || '');
  const actMin = props.room.jbs_act_minutes || 6;
  const actStart = props.room.jbs_act_started_at ? new Date(props.room.jbs_act_started_at).getTime() : 0;
  const remainMs = actStart ? Math.max(0, actStart + actMin * 60000 - now) : 0;
  const mmss = `${String(Math.floor(remainMs / 60000)).padStart(2, '0')}:${String(Math.floor((remainMs % 60000) / 1000)).padStart(2, '0')}`;

  useEffect(() => {
    const ch = supabase.channel(`jbs-msgs-${props.room.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `room_id=eq.${props.room.id}` },
        (payload: any) => setMessages((prev) => prev.some((m) => m.id === payload.new.id) ? prev : [...prev, payload.new]))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [props.room.id, supabase]);

  useEffect(() => { setMessages((prev) => { const ids = new Set(prev.map((m) => m.id)); const add = props.initialMessages.filter((m) => !ids.has(m.id)); return add.length ? [...prev, ...add] : prev; }); }, [props.initialMessages]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  // 轮询兜底：被邀请的匿名玩家realtime可能被RLS过滤而收不到推送，这里每隔几秒主动拉一次消息与房间阶段，保证两边同步。
  useEffect(() => {
    const tick = async () => {
      if (typeof document !== 'undefined' && document.hidden) return;
      const { data } = await supabase.from('messages').select('*').eq('room_id', props.room.id).order('created_at', { ascending: true }).limit(300);
      if (data) setMessages((prev) => { const ids = new Set(prev.map((m) => m.id)); const add = data.filter((m: any) => !ids.has(m.id)); return add.length ? [...prev, ...add] : prev; });
      const { data: r } = await supabase.from('rooms').select('jbs_phase, jbs_act, game_state').eq('id', props.room.id).maybeSingle();
      if (r && (r.jbs_phase !== props.room.jbs_phase || r.jbs_act !== props.room.jbs_act || r.game_state !== props.room.game_state)) router.refresh();
    };
    const id = setInterval(tick, 4000);
    return () => clearInterval(id);
  }, [props.room.id, props.room.jbs_phase, props.room.jbs_act, props.room.game_state, supabase, router]);

  // 倒计时每秒走字
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id); }, []);

  // 时间到 → 房主端自动推进本幕（每幕只触发一次）
  const autoAdv = useRef(0);
  useEffect(() => {
    const isHostNow = props.room.host_user_id === props.userId;
    if (!isHostNow || props.room.jbs_phase !== 'playing' || !actStart) return;
    if (remainMs > 0 || busy) return;
    if (autoAdv.current === props.room.jbs_act) return;
    autoAdv.current = props.room.jbs_act;
    advance(false, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remainMs, props.room.jbs_phase, props.room.jbs_act]);

  // 自动生成角色头像：开本后房主端自动出图，无需点击；分批补齐直到全部完成。
  const autoAvatar = useRef(false);
  useEffect(() => {
    const isHostNow = props.room.host_user_id === props.userId;
    const phaseNow = props.room.jbs_phase;
    const list = props.jbsCharacters || [];
    if (!isHostNow || !['playing', 'vote', 'reveal'].includes(phaseNow || '') || list.length === 0) return;
    if (!list.some((c: any) => !c.avatar_url) || autoAvatar.current) return;
    autoAvatar.current = true; // 每次进房只自动出一批，避免反复触发烧额度；剩余可手动补
    genAvatars(false, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.room.jbs_phase, props.jbsCharacters]);

  async function call(url: string, body: any) {
    setBusy(true);
    try {
      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const d = await res.json();
      if (!res.ok) { alert(d.error || (en ? 'Error' : '出错了')); return null; }
      return d;
    } catch (e: any) { alert((en ? 'Failed: ' : '失败：') + e.message); return null; }
    finally { setBusy(false); }
  }

  async function genScripts(dir?: Record<string, string> | null) {
    const r = await call('/api/jbs/scripts', { roomId: props.room.id, headcount, customDirection: dir || null });
    if (r) setShowCustom(false);
  }

  const TYPE_OPTS = en
    ? [['', 'Any'], ['推理', 'Murder Mystery'], ['情感', 'Emotional'], ['欢乐', 'Comedy'], ['阵营', 'Faction'], ['恐怖', 'Horror'], ['还原', 'Reconstruction'], ['机制', 'Mechanism/Economy']]
    : [['', '不限'], ['推理', '推理凶案'], ['情感', '情感'], ['欢乐', '欢乐'], ['阵营', '阵营对抗'], ['恐怖', '恐怖'], ['还原', '还原'], ['机制', '机制/经济']];

  const customPanel = (
    <div className="w-full max-w-xl p-4 rounded-lg bg-fog border border-eldritch/30 flex flex-col gap-3 text-left">
      <p className="text-xs text-parchment/50">{en ? 'Customization only shapes theme, era and mood — it never lets you decide the truth, killer or hidden roles.' : '自定义只影响题材、时代与氛围，不会让你决定真相、凶手或隐藏身份。'}</p>
      <label className="flex flex-col gap-1 text-sm text-parchment/70">{en ? 'Preferred type' : '本型偏好'}
        <select value={custom.type || ''} onChange={(e) => setCustom({ ...custom, type: e.target.value })}
          className="px-2 py-1.5 rounded bg-ink border border-eldritch/30 text-parchment">
          {TYPE_OPTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-sm text-parchment/70">{en ? 'Era' : '时代背景'}
          <input value={custom.era || ''} onChange={(e) => setCustom({ ...custom, era: e.target.value })}
            placeholder={en ? 'e.g. Republic era' : '例如：民国'} className="px-3 py-2 rounded bg-ink border border-eldritch/30 text-parchment placeholder:text-parchment/30" />
        </label>
        <label className="flex flex-col gap-1 text-sm text-parchment/70">{en ? 'Place' : '场景'}
          <input value={custom.place || ''} onChange={(e) => setCustom({ ...custom, place: e.target.value })}
            placeholder={en ? 'e.g. a cruise ship' : '例如：豪华游轮'} className="px-3 py-2 rounded bg-ink border border-eldritch/30 text-parchment placeholder:text-parchment/30" />
        </label>
      </div>
      <label className="flex flex-col gap-1 text-sm text-parchment/70">{en ? 'Your idea / theme' : '你的点子 / 主题'}
        <textarea value={custom.theme || ''} onChange={(e) => setCustom({ ...custom, theme: e.target.value })} rows={2}
          placeholder={en ? 'Describe the story you want — characters, setup, twist…' : '描述你想要的故事——人物、设定、反转……'}
          className="px-3 py-2 rounded bg-ink border border-eldritch/30 text-parchment placeholder:text-parchment/30" />
      </label>
      <label className="flex flex-col gap-1 text-sm text-parchment/70">{en ? 'Avoid (forbidden content)' : '避免内容'}
        <input value={custom.forbidden || ''} onChange={(e) => setCustom({ ...custom, forbidden: e.target.value })}
          placeholder={en ? 'e.g. nothing too gory' : '例如：不要太血腥'} className="px-3 py-2 rounded bg-ink border border-eldritch/30 text-parchment placeholder:text-parchment/30" />
      </label>
      <button onClick={() => genScripts(custom)} disabled={busy || generating}
        className="self-start px-5 py-2 rounded bg-eldritch/60 hover:bg-eldritch text-parchment text-sm disabled:opacity-50">
        {busy || generating ? (en ? 'Writing…' : '生成中…') : (en ? 'Generate in this direction' : '按这个方向生成')}
      </button>
    </div>
  );
  async function startScript(id: string) { await call('/api/jbs/start', { roomId: props.room.id, scriptId: id, actMinutes: pace }); }
  async function act_(content: string) { const c = content.trim(); if (!c) return; setText(''); await call('/api/jbs/act', { roomId: props.room.id, content: c }); }
  async function advance(toVote?: boolean, auto?: boolean) { const r = await call('/api/jbs/advance', { roomId: props.room.id, toVote: !!toVote, auto: !!auto }); if (r) router.refresh(); }
  async function vote(target: string) { if (!confirm((en ? 'Accuse ' : '指认 ') + target + '?')) return; await call('/api/jbs/vote', { roomId: props.room.id, target }); }
  async function genAvatars(force?: boolean, silent?: boolean) {
    const r = silent
      ? await fetch('/api/jbs/avatars', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ roomId: props.room.id, force: !!force }) }).then((x) => x.json()).catch(() => null)
      : await call('/api/jbs/avatars', { roomId: props.room.id, force: !!force });
    if (r?.ok) { router.refresh(); if (!silent && r.remaining > 0) alert(en ? `Generated ${r.done}, ${r.remaining} left — click again to finish.` : `已生成 ${r.done} 张，还剩 ${r.remaining} 张，再点一次补齐。`); }
    return r;
  }
  async function replay() {
    setBusy(true);
    try {
      const res = await fetch('/api/rooms/replay', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ roomId: props.room.id }) });
      if (res.status === 402) { router.push('/upgrade'); return; }
      const d = await res.json();
      if (!res.ok) { alert(d.error || (en ? 'Error' : '出错了')); return; }
      router.refresh();
    } catch (e: any) { alert((en ? 'Failed: ' : '失败：') + e.message); }
    finally { setBusy(false); }
  }

  // ===== 大厅 / 出本 =====
  if (!phase || phase === 'lobby') {
    return (
      <main className="min-h-[100svh] flex flex-col items-center justify-center gap-6 px-6 text-center">
        <h1 className="text-2xl font-serif text-parchment">{en ? 'Murder Mystery' : '剧本杀'} · {props.room.name}</h1>
        <p className="text-parchment/60 max-w-md">{en ? '2 real players + AI-played characters fill the cast. Everyone gets a secret role; investigate, discuss, and finally accuse the killer.' : '2 名真人 + AI 扮演其余角色补满人数。每人一个隐藏身份，搜证、讨论，最后指认真凶。'}</p>
        <div className="flex flex-col items-center gap-3 w-full max-w-md">
          <span className="text-sm text-parchment/50">{en ? 'Invite your partner:' : '把链接发给同伴：'}</span>
          <code className="text-xs px-3 py-2 rounded bg-fog border border-eldritch/30 text-eldritch break-all w-full">{inviteUrl}</code>
          <button onClick={() => { navigator.clipboard.writeText(inviteUrl); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
            className="px-4 py-1.5 rounded bg-eldritch/40 hover:bg-eldritch text-parchment text-sm">{copied ? (en ? 'Copied' : '已复制') : (en ? 'Copy invite link' : '复制邀请链接')}</button>
        </div>
        {isHost ? (
          <div className="flex flex-col items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-sm text-parchment/60">{en ? 'Total cast:' : '总人数：'}</span>
              {[4, 6, 8].map((n) => (
                <button key={n} onClick={() => setHeadcount(n)}
                  className={`px-3 py-1.5 rounded border text-sm ${headcount === n ? 'bg-eldritch/60 border-eldritch text-parchment' : 'bg-fog border-eldritch/30 text-parchment/60'}`}>{n}</button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-parchment/60">{en ? 'Pace / act:' : '每幕时长：'}</span>
              {[[6, en ? 'Fast' : '快'], [9, en ? 'Normal' : '中'], [13, en ? 'Slow' : '慢']].map(([m, l]) => (
                <button key={m as number} onClick={() => setPace(m as number)}
                  className={`px-3 py-1.5 rounded border text-sm ${pace === m ? 'bg-eldritch/60 border-eldritch text-parchment' : 'bg-fog border-eldritch/30 text-parchment/60'}`}>{l}·{m}{en ? 'm' : '分'}</button>
              ))}
            </div>
            <div className="flex items-center gap-3">
              <button onClick={() => genScripts()} disabled={busy || generating}
                className="px-6 py-3 rounded bg-blood/80 hover:bg-blood text-parchment border border-blood disabled:opacity-50">
                {busy || generating ? (en ? 'Writing scripts…' : '正在出本…') : (en ? 'Generate scripts' : '生成剧本')}
              </button>
              <button onClick={() => setShowCustom((v) => !v)} disabled={busy || generating}
                className="px-4 py-3 rounded bg-fog border border-eldritch/40 text-parchment/80 text-sm hover:bg-eldritch/20 disabled:opacity-50">
                {en ? 'Custom script' : '自定义剧本'}
              </button>
            </div>
            {showCustom && customPanel}
          </div>
        ) : <p className="text-parchment/40 text-sm">{en ? 'Waiting for the host to pick a script…' : '等待房主出本……'}</p>}
      </main>
    );
  }

  // ===== 剧本选择 =====
  if (phase === 'script') {
    const opts = props.room.jbs_options || [];
    return (
      <main className="min-h-[100svh] flex flex-col items-center px-4 py-8 gap-6">
        <h1 className="text-xl font-serif text-parchment">{en ? 'Choose a script' : '选择剧本'}</h1>
        {generating && <p className="text-parchment/40 text-sm">{en ? 'Generating…' : '生成中…'}</p>}
        <div className="grid gap-4 w-full max-w-4xl md:grid-cols-3">
          {opts.map((s: any) => (
            <div key={s.id} className="rounded-lg bg-fog border border-eldritch/30 p-4 flex flex-col gap-2">
              <span className="text-xs px-2 py-0.5 rounded-full bg-eldritch/20 text-eldritch self-start">{s.type}</span>
              <h2 className="font-serif text-parchment text-lg">{s.title}</h2>
              <p className="text-parchment/50 text-xs">{s.era} · {s.place} · {s.headcount}{en ? 'P' : '人'} · {s.duration}</p>
              <p className="text-eldritch/80 text-sm italic">{s.tagline}</p>
              <p className="text-parchment/70 text-sm leading-relaxed flex-1">{s.hook}</p>
              <p className="text-parchment/40 text-xs">{en ? 'Difficulty' : '难度'}: {s.difficulty} · {en ? 'Emotion' : '情感'}: {s.emotion}</p>
              {isHost && <button onClick={() => startScript(s.id)} disabled={busy}
                className="mt-1 px-4 py-2 rounded bg-blood/80 hover:bg-blood text-parchment text-sm disabled:opacity-50">{busy ? (en ? 'Opening…' : '开本中…') : (en ? 'Play this' : '选这个')}</button>}
            </div>
          ))}
        </div>
        {isHost && (
          <div className="flex flex-col items-center gap-3">
            <div className="flex items-center gap-4">
              <button onClick={() => genScripts()} disabled={busy || generating} className="text-parchment/40 text-sm underline">{en ? 'Reroll scripts' : '换一批'}</button>
              <button onClick={() => setShowCustom((v) => !v)} disabled={busy || generating} className="text-eldritch/80 text-sm underline">{en ? 'Custom script' : '自定义剧本'}</button>
            </div>
            {showCustom && customPanel}
          </div>
        )}
      </main>
    );
  }

  // ===== 生成中 =====
  if (phase === 'locking' || phase === 'revealing') {
    return (
      <main className="min-h-[100svh] flex flex-col items-center justify-center gap-4 text-center px-6">
        <div className="w-8 h-8 border-2 border-eldritch/30 border-t-eldritch rounded-full animate-spin" />
        <p className="text-parchment/70">{phase === 'locking' ? (en ? 'Building the case & casting roles…' : '正在编排案件、分配角色……') : (en ? 'Tallying votes & revealing the truth…' : '正在统计投票、揭晓真相……')}</p>
      </main>
    );
  }

  // ===== 游戏中 / 投票 / 揭晓 =====
  const voting = phase === 'vote';
  const ended = phase === 'reveal' || props.room.game_state === 'ended';
  const candidates = chars.filter((c: any) => c.name !== myChar?.name);

  return (
    <main className="h-[100svh] flex flex-col overflow-hidden">
      <header className="px-4 py-2.5 border-b border-eldritch/20 flex items-center justify-between gap-2">
        <span className="font-serif text-parchment text-sm truncate">{en ? 'Murder Mystery' : '剧本杀'} · {props.room.name}</span>
        <div className="flex items-center gap-2 shrink-0">
          {!ended && <span className="text-xs text-eldritch/80">{en ? `Act ${act}/${totalActs}${actName ? ' · ' + actName : ''}` : `第${act}/${totalActs}幕${actName ? ' · ' + actName : ''}`}</span>}
          {!ended && phase === 'playing' && actStart > 0 && <span className={`text-xs tabular-nums ${remainMs < 60000 ? 'text-blood' : 'text-parchment/50'}`}>⏱ {mmss}</span>}
          {chars.length > 0 && <button onClick={() => setShowCards((v) => !v)} className="text-xs px-2 py-1 rounded bg-eldritch/30 text-parchment">{en ? 'Cast' : '角色卡'}</button>}
          {clueList.length > 0 && <button onClick={() => setShowClues((v) => !v)} className="text-xs px-2 py-1 rounded bg-amber-600/30 text-parchment">{en ? `Clues ${clueList.length}` : `线索 ${clueList.length}`}</button>}
          {resources.length > 0 && <button onClick={() => setShowRes((v) => !v)} className="text-xs px-2 py-1 rounded bg-eldritch/30 text-parchment">{en ? 'Resources' : '资源'}</button>}
          {myChar && <button onClick={() => setShowRole((v) => !v)} className="text-xs px-2 py-1 rounded bg-eldritch/30 text-parchment">{en ? 'My role' : '我的角色'}</button>}
        </div>
      </header>

      {showClues && (
        <div className="px-4 py-3 bg-amber-950/20 border-b border-amber-700/30 max-w-3xl w-full mx-auto space-y-1.5">
          <div className="text-xs text-amber-300/70 mb-1">{en ? 'Clues you have found' : '你已掌握的线索'}</div>
          {clueList.map((m) => (
            <div key={m.id} className="text-sm text-parchment/85 leading-snug">{m.payload?.type === 'private' ? '🔒 ' : '🔍 '}{m.content.replace(/^🔍\s*/, '')}</div>
          ))}
        </div>
      )}

      {showRes && (
        <div className="px-4 py-3 bg-ink/60 border-b border-eldritch/20 max-w-3xl w-full mx-auto">
          <div className="text-xs text-parchment/50 mb-2">{en ? 'Resource standings (mechanism)' : '资源/分数（机制本）'}</div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {resources.map((r: any, i: number) => (
              <div key={i} className="rounded bg-fog border border-eldritch/30 p-2">
                <div className="text-parchment text-sm truncate">{r.name}</div>
                <div className="text-parchment/60 text-[11px] space-y-0.5 mt-1">
                  {(r.items || []).map((it: any, j: number) => <div key={j} className="flex justify-between gap-2"><span className="truncate">{it.label}</span><span className="text-eldritch shrink-0">{it.value}</span></div>)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {showCards && (
        <div className="px-4 py-3 bg-ink/60 border-b border-eldritch/20 max-w-3xl w-full mx-auto">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {chars.map((c: any) => {
              const isMe = c.assigned_seat && c.assigned_seat === props.mySeat;
              return (
                <div key={c.name} className={`rounded-lg border p-2 flex gap-2 items-start ${isMe ? 'bg-blood/15 border-blood/50' : 'bg-fog border-eldritch/30'}`}>
                  <div className="w-12 h-12 rounded overflow-hidden bg-ink border border-eldritch/30 shrink-0 flex items-center justify-center">
                    {c.avatar_url ? <img src={c.avatar_url} alt={c.name} className="w-full h-full object-cover" /> : <span className="text-parchment/30 text-lg">{(c.name || '?').slice(0, 1)}</span>}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-parchment text-sm truncate">{c.name}{c.assigned_seat ? ` [${c.assigned_seat}]` : (en ? ' ·AI' : ' ·AI')}</div>
                    <div className="text-parchment/50 text-[11px] truncate">{[c.age, c.occupation].filter(Boolean).join(' · ')}</div>
                    <div className="text-parchment/60 text-[11px] leading-snug line-clamp-3">{c.public_info}</div>
                  </div>
                </div>
              );
            })}
          </div>
          {isHost && (
            <button onClick={() => genAvatars(!chars.some((c: any) => !c.avatar_url))} disabled={busy}
              className="mt-3 px-4 py-1.5 rounded bg-eldritch/50 hover:bg-eldritch text-parchment text-xs disabled:opacity-50">
              {busy ? (en ? 'Drawing portraits…' : '正在生成头像…') : chars.some((c: any) => !c.avatar_url) ? (en ? '🎨 Generate cast portraits' : '🎨 生成角色头像') : (en ? '↻ Redraw portraits' : '↻ 重新生成头像')}
            </button>
          )}
        </div>
      )}

      {showRole && (
        <div className="px-4 py-3 bg-blood/10 border-b border-blood/30 max-w-3xl w-full mx-auto text-sm text-parchment/85 whitespace-pre-line">
          {roleMsgs.length ? roleMsgs.map((m) => <div key={m.id} className="mb-2">{m.content}</div>) : (en ? 'Your secret role is private to you.' : '你的隐藏身份只有你能看到。')}
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-3 max-w-3xl w-full mx-auto">
        {messages.map((m) => <JbsMsg key={m.id} m={m} en={en} mine={m.sender_player_id === props.myPlayerId} />)}
        {busy && <div className="text-center text-parchment/40 italic text-sm">{en ? 'The host is narrating…' : '主持人推进中……'}</div>}
        <div ref={bottomRef} />
      </div>

      {ended ? (
        <div className="border-t border-blood/40 px-4 py-3 flex flex-col items-center gap-2 max-w-3xl w-full mx-auto" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
          <span className="text-parchment/70 text-sm">{en ? 'The case is closed.' : '本局结束。'}</span>
          {isHost && (
            <button onClick={replay} disabled={busy}
              className="px-5 py-2 rounded bg-blood/80 hover:bg-blood text-parchment border border-blood text-sm disabled:opacity-50">
              {busy ? (en ? 'Resetting…' : '重置中…') : (en ? '↻ Play again (new script)' : '↻ 再来一局（换新本）')}
            </button>
          )}
        </div>
      ) : voting ? (
        <div className="border-t border-eldritch/20 px-4 py-3 max-w-3xl w-full mx-auto space-y-2" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
          <p className="text-center text-parchment/70 text-sm">{en ? 'Final accusation — who is the culprit?' : '最终指认 —— 谁是真凶？'}</p>
          <div className="flex flex-wrap justify-center gap-2">
            {candidates.map((c: any) => (
              <button key={c.name} onClick={() => vote(c.name)} disabled={busy}
                className="px-3 py-1.5 rounded bg-blood/30 hover:bg-blood/60 border border-blood/50 text-parchment text-sm disabled:opacity-50">
                {c.name}{c.is_ai ? '' : ' ·' + (en ? 'player' : '真人')}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="border-t border-eldritch/20 px-4 py-3 flex flex-col gap-2 max-w-3xl w-full mx-auto" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
          <div className="flex gap-2">
            <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && act_(text)}
              placeholder={en ? 'Investigate, question, accuse, speak…' : '搜证、询问、对质、发言…'} disabled={busy}
              className="flex-1 min-w-0 px-4 py-2 rounded bg-fog border border-eldritch/30 text-parchment placeholder:text-parchment/30 outline-none focus:border-eldritch disabled:opacity-50" />
            <button onClick={() => act_(text)} disabled={busy} className="px-5 py-2 rounded bg-eldritch/60 hover:bg-eldritch text-parchment disabled:opacity-50 shrink-0">{en ? 'Act' : '行动'}</button>
          </div>
          {isHost && (
            <div className="flex items-center justify-center gap-3 text-xs">
              <button onClick={() => advance(false)} disabled={busy || !keyFound} title={!keyFound ? (en ? 'Find this act’s key clue first (or wait for the timer)' : '先找到本幕关键线索（或等倒计时）') : ''} className="px-3 py-1.5 rounded bg-fog border border-eldritch/40 text-parchment/80 hover:bg-eldritch/20 disabled:opacity-40">{keyFound ? (en ? 'Next act ▶' : '进入下一幕 ▶') : (en ? '🔒 Find key clue' : '🔒 需关键线索')}</button>
              <button onClick={() => advance(true)} disabled={busy} className="px-3 py-1.5 rounded bg-blood/40 border border-blood/50 text-parchment/90 hover:bg-blood/60 disabled:opacity-40">{en ? 'Go to accusation ⚖' : '进入最终指认 ⚖'}</button>
            </div>
          )}
        </div>
      )}
    </main>
  );
}

function JbsMsg({ m, en, mine }: { m: any; en: boolean; mine: boolean }) {
  const type = m.payload?.type;
  if (type === 'jbs_roster') {
    return <div className="mx-auto max-w-2xl rounded-lg bg-eldritch/10 border border-eldritch/40 px-4 py-3 text-parchment/85 leading-relaxed whitespace-pre-line text-sm">{m.content}</div>;
  }
  if (type === 'jbs_reveal') {
    return <div className="mx-auto max-w-2xl rounded-lg bg-blood/20 border border-blood/50 px-4 py-3 text-parchment leading-relaxed whitespace-pre-line">{m.content}</div>;
  }
  if (type === 'jbs_dm') {
    return <div className="mx-auto max-w-2xl text-parchment/90 leading-relaxed whitespace-pre-line border-l-2 border-eldritch/50 pl-3">{m.content}</div>;
  }
  if (type === 'jbs_ai') {
    return (
      <div className="flex flex-col items-start">
        <span className="text-xs text-eldritch/80 mb-1">{m.payload?.name}{en ? ' (AI)' : '（AI）'}</span>
        <div className="max-w-[80%] px-4 py-2 rounded-lg bg-fog border border-eldritch/30 text-parchment/90">{m.content}</div>
      </div>
    );
  }
  if (type === 'jbs_evidence') {
    return <div className="mx-auto max-w-2xl rounded bg-amber-500/10 border border-amber-500/30 px-3 py-2 text-amber-200/90 text-sm whitespace-pre-line">{m.content}</div>;
  }
  if (type === 'private') {
    return <div className="mx-auto max-w-2xl rounded bg-blood/10 border border-blood/30 px-3 py-2 text-parchment/70 text-sm italic whitespace-pre-line">🔒 {m.content}</div>;
  }
  if (type === 'jbs_vote') {
    return <div className="text-center text-sm text-parchment/60 whitespace-pre-line">{m.content}</div>;
  }
  if (type === 'jbs_act') {
    return <div className="flex items-center gap-3 my-1"><div className="flex-1 h-px bg-eldritch/30" /><span className="text-eldritch/80 text-xs tracking-widest">{m.content}</span><div className="flex-1 h-px bg-eldritch/30" /></div>;
  }
  if (m.sender_type === 'system') {
    return <div className="text-center text-sm text-parchment/50 whitespace-pre-line">{m.content}</div>;
  }
  return (
    <div className={`flex flex-col ${mine ? 'items-end' : 'items-start'}`}>
      <div className={`max-w-[80%] px-4 py-2 rounded-lg ${mine ? 'bg-blood/25 border border-blood/40' : 'bg-fog border border-parchment/20'} text-parchment/90`}>{m.content}</div>
    </div>
  );
}
