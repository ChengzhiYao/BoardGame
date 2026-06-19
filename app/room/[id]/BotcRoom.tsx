'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { playSfx } from '@/lib/audio/sfx';
import { playBotcCue } from '@/lib/audio/botcCue';
import type { ShellProps } from './RoomShell';

const teamCls: Record<string, string> = { demon: 'text-red-400', minion: 'text-orange-400', outsider: 'text-sky-400', townsfolk: 'text-emerald-400' };
function teamName(t: string, en: boolean) { return t === 'demon' ? (en ? 'Demon' : '恶魔') : t === 'minion' ? (en ? 'Minion' : '爪牙') : t === 'outsider' ? (en ? 'Outsider' : '外来者') : (en ? 'Townsfolk' : '镇民'); }

export default function BotcRoom(props: ShellProps) {
  const router = useRouter();
  const supabase = useRef(createClient()).current;
  const en = props.room.language === 'en';
  const [messages, setMessages] = useState<any[]>(props.initialMessages);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [size, setSize] = useState(6);
  const [theme, setTheme] = useState('');
  const [roleOpen, setRoleOpen] = useState(true);
  const [showRoles, setShowRoles] = useState(false);
  const [showPlayers, setShowPlayers] = useState(false);
  const [myVote, setMyVote] = useState('');
  const [myNightTarget, setMyNightTarget] = useState('');
  const [claimSel, setClaimSel] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const sfxSeen = useRef<Set<string>>(new Set());
  const wokeFor = useRef<string>('');

  const phase = props.room.botc_phase as string | undefined;
  const day = props.room.botc_day || 0;
  const speaking = props.room.waiting_for as string | undefined;
  const generating = props.room.modules_generating;
  const bps: any[] = props.botcPlayers || [];
  const inviteUrl = `${typeof window !== 'undefined' ? window.location.origin : props.siteUrl}/join/${props.inviteToken}`;
  const isHost = props.room.host_user_id === props.userId;
  const meBp = bps.find((p) => p.seat === props.mySeat);
  const iAmAlive = !meBp || meBp.alive;
  const usedGhost = !!meBp?.used_ghost_vote;
  const myTurn = !!props.mySeat && speaking === props.mySeat && iAmAlive;
  const speakerBp = bps.find((p) => p.seat === speaking);
  const roleCard = messages.filter((m) => m.payload?.type === 'botc_role').slice(-1)[0]?.content || '';
  const myNightAction = messages.filter((m) => m.payload?.type === 'botc_role_action').slice(-1)[0]?.payload?.action || '';
  const manifest: any[] = messages.filter((m) => m.payload?.type === 'botc_manifest').slice(-1)[0]?.payload?.roles || [];
  const revealAssign: any[] = messages.filter((m) => m.payload?.type === 'botc_reveal').slice(-1)[0]?.payload?.assignments || [];
  const claims: Record<string, string> = {};
  messages.filter((m) => m.payload?.type === 'botc_claim').forEach((m) => { if (m.payload?.seat) claims[m.payload.seat] = m.payload.role; });

  useEffect(() => {
    const ch = supabase.channel(`botc-msgs-${props.room.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `room_id=eq.${props.room.id}` },
        (payload: any) => setMessages((prev) => prev.some((m) => m.id === payload.new.id) ? prev : [...prev, payload.new]))
      .subscribe();
    const ch2 = supabase.channel(`botc-room-${props.room.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms', filter: `id=eq.${props.room.id}` }, () => router.refresh())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'botc_players', filter: `room_id=eq.${props.room.id}` }, () => router.refresh())
      .subscribe();
    return () => { supabase.removeChannel(ch); supabase.removeChannel(ch2); };
  }, [props.room.id, supabase, router]);

  useEffect(() => { setMessages((prev) => { const ids = new Set(prev.map((m) => m.id)); const add = props.initialMessages.filter((m) => !ids.has(m.id)); return add.length ? [...prev, ...add] : prev; }); }, [props.initialMessages]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  useEffect(() => {
    for (const m of messages) {
      const sfx = m.payload?.sfx;
      if (!Array.isArray(sfx) || sfxSeen.current.has(m.id)) continue;
      sfxSeen.current.add(m.id);
      sfx.forEach((k: string) => (typeof k === 'string' && k.startsWith('cue_')) ? playBotcCue(k) : playSfx(k));
    }
  }, [messages]);

  useEffect(() => {
    if (phase === 'night' && iAmAlive && ['kill', 'poison', 'protect', 'inspect'].includes(myNightAction)) {
      const key = `${day}`; if (wokeFor.current !== key) { wokeFor.current = key; playBotcCue('cue_wake'); }
    }
  }, [phase, day, myNightAction, iAmAlive]);

  useEffect(() => {
    const tick = async () => {
      if (typeof document !== 'undefined' && document.hidden) return;
      const { data } = await supabase.from('messages').select('*').eq('room_id', props.room.id).order('created_at', { ascending: true }).limit(400);
      if (data) setMessages((prev) => { const ids = new Set(prev.map((m) => m.id)); const add = data.filter((m: any) => !ids.has(m.id)); return add.length ? [...prev, ...add] : prev; });
      const { data: r } = await supabase.from('rooms').select('botc_phase, botc_day, waiting_for').eq('id', props.room.id).maybeSingle();
      if (r && (r.botc_phase !== props.room.botc_phase || r.botc_day !== props.room.botc_day || r.waiting_for !== props.room.waiting_for)) router.refresh();
    };
    const id = setInterval(tick, 4000);
    return () => clearInterval(id);
  }, [props.room.id, props.room.botc_phase, props.room.botc_day, props.room.waiting_for, supabase, router]);

  // 房主端：白天按座位推进发言（当前发言者是 AI 时让其说一句，是真人则等其点"发言完毕"）
  useEffect(() => {
    if (!isHost || phase !== 'day') return;
    const run = () => { fetch('/api/botc/turn', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ roomId: props.room.id }) }).catch(() => {}); };
    run();
    const id = setInterval(run, 6000);
    return () => clearInterval(id);
  }, [isHost, phase, props.room.id, props.room.waiting_for]);

  async function call(url: string, body: any) {
    setBusy(true);
    try {
      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const d = await res.json();
      if (!res.ok) alert(d.error || (en ? 'Error' : '出错了'));
      return d;
    } catch (e: any) { alert((en ? 'Failed: ' : '失败：') + e.message); }
    finally { setBusy(false); }
  }
  async function start() { await call('/api/botc/start', { roomId: props.room.id, size, theme: theme.trim() || null }); }
  async function replay() { const d = await call('/api/rooms/replay', { roomId: props.room.id }); if (d?.ok) router.refresh(); }
  async function passTurn() { const d = await call('/api/botc/pass', { roomId: props.room.id }); if (d?.ok) router.refresh(); }
  async function resolveDay() { if (!confirm(en ? 'Tally votes and execute?' : '统计投票并处决？')) return; await call('/api/botc/resolve', { roomId: props.room.id }); }
  async function resolveNight() { if (!confirm(en ? 'Resolve the night?' : '结算今夜（天亮）？')) return; await call('/api/botc/resolve-night', { roomId: props.room.id }); }
  async function sendChat() {
    const c = text.trim(); if (!c || !props.myPlayerId) return;
    setText('');
    await supabase.from('messages').insert({ room_id: props.room.id, sender_type: 'player', sender_player_id: props.myPlayerId, content: c, visibility: 'public', turn_no: day });
  }
  async function claim(role: string) {
    setClaimSel(role); if (!props.myPlayerId || !props.mySeat) return;
    await supabase.from('messages').insert({ room_id: props.room.id, sender_type: 'player', sender_player_id: props.myPlayerId, content: (en ? `claims to be 「${role}」` : `自称身份：「${role}」`), visibility: 'public', turn_no: day, payload: { type: 'botc_claim', seat: props.mySeat, role } });
  }
  async function vote(t: string) { setMyVote(t); await call('/api/botc/vote', { roomId: props.room.id, target: t }); }
  async function nightAct(t: string) { setMyNightTarget(t); await call('/api/botc/night', { roomId: props.room.id, target: t }); }

  // ===== 大厅 =====
  if (!phase || phase === 'lobby') {
    return (
      <main className="min-h-[100svh] flex flex-col items-center justify-center gap-6 px-6 text-center">
        <h1 className="text-2xl font-serif text-parchment">{en ? 'Bloodbound' : '血染'} · {props.room.name}</h1>
        <p className="text-parchment/60 max-w-md">{en ? 'Social deduction (like Werewolf / Clocktower). Good (Townsfolk/Outsiders) vs Evil (Minions/Demon). An AI Storyteller hosts and fills empty seats — anyone can be evil, including you. 1–8 real players.' : '社交推理（类狼人杀/血染钟楼）。好人（镇民/外来者）对邪恶（爪牙/恶魔）。AI 说书人主持并补满空位——任何人都可能是邪恶方，包括你。真人 1～8 人。'}</p>
        <div className="flex flex-col items-center gap-1.5">
          <span className="text-sm text-parchment/50">{en ? `${props.initialPlayers.length} real player(s) joined · AI fills the rest` : `已加入 ${props.initialPlayers.length} 名真人 · 其余由 AI 补位`}</span>
          <div className="flex gap-2 flex-wrap justify-center">
            {props.initialPlayers.map((p: any) => {
              const nm = props.initialUsers.find((u: any) => u.id === p.user_id)?.display_name || (en ? 'Player' : '玩家');
              const mine = p.user_id === props.userId;
              return <span key={p.id} className={`text-xs px-2.5 py-1 rounded-full border ${mine ? 'bg-blood/25 border-blood/50 text-parchment' : 'bg-fog border-eldritch/30 text-parchment/80'}`}>● {nm} [{p.seat}]{mine ? (en ? ' · you' : ' · 你') : ''}</span>;
            })}
          </div>
        </div>
        <div className="flex flex-col items-center gap-3 w-full max-w-md">
          <span className="text-sm text-parchment/50">{en ? 'Invite players:' : '把链接发给玩家：'}</span>
          <code className="text-xs px-3 py-2 rounded bg-fog border border-eldritch/30 text-eldritch break-all w-full">{inviteUrl}</code>
          <button onClick={() => { navigator.clipboard.writeText(inviteUrl); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
            className="px-4 py-1.5 rounded bg-eldritch/40 hover:bg-eldritch text-parchment text-sm">{copied ? (en ? 'Copied' : '已复制') : (en ? 'Copy invite link' : '复制邀请链接')}</button>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-parchment/60">{en ? 'Players in game:' : '本局人数：'}</span>
          {[4, 6, 8].map((n) => (
            <button key={n} onClick={() => setSize(n)}
              className={`px-3 py-1.5 rounded border text-sm ${size === n ? 'bg-eldritch/60 border-eldritch text-parchment' : 'bg-fog border-eldritch/30 text-parchment/60'}`}>{n}{en ? '' : '人'}</button>
          ))}
        </div>
        <input value={theme} onChange={(e) => setTheme(e.target.value)} placeholder={en ? 'Theme (optional): cyberpunk cult, haunted school…' : '题材（可选）：赛博邪教、闹鬼校园…'}
          className="w-72 px-3 py-2 rounded bg-fog border border-eldritch/30 text-parchment placeholder:text-parchment/30 text-sm outline-none focus:border-eldritch" />
        <button onClick={start} disabled={busy || generating}
          className="px-6 py-3 rounded bg-blood/80 hover:bg-blood text-parchment border border-blood disabled:opacity-50">
          {busy || generating ? (en ? 'Dealing roles…' : '正在发身份…') : (en ? `Start (${size}-player game) →` : `开始（${size} 人局）→`)}
        </button>
      </main>
    );
  }

  const ended = phase === 'reveal';
  const night = phase === 'night';
  const voting = phase === 'vote';
  const aliveTargets = bps.filter((p) => p.alive && p.seat && p.seat !== props.mySeat);
  const hasNightPower = ['kill', 'poison', 'protect', 'inspect'].includes(myNightAction);
  const nightLabel = myNightAction === 'kill' ? (en ? 'Kill' : '杀害') : myNightAction === 'poison' ? (en ? 'Poison' : '投毒') : myNightAction === 'protect' ? (en ? 'Protect' : '保护') : myNightAction === 'inspect' ? (en ? 'Inspect' : '查验') : '';
  const canVote = iAmAlive || !usedGhost;
  const trueRoleOf = (seat: string) => revealAssign.find((a) => a.seat === seat);
  const chatInput = (
    <div className="flex gap-2">
      <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && sendChat()}
        placeholder={iAmAlive ? (en ? 'Speak to the table…' : '公开发言…') : (en ? 'Speak from the grave…' : '亡者发言…')} disabled={!props.myPlayerId}
        className="flex-1 min-w-0 px-4 py-2 rounded bg-fog border border-eldritch/30 text-parchment placeholder:text-parchment/30 outline-none focus:border-eldritch disabled:opacity-50" />
      <button onClick={sendChat} disabled={!props.myPlayerId} className="px-4 py-2 rounded bg-eldritch/60 hover:bg-eldritch text-parchment text-sm shrink-0">{en ? 'Say' : '发言'}</button>
    </div>
  );
  const claimRow = iAmAlive && manifest.length > 0 ? (
    <div className="flex gap-2 items-center flex-wrap">
      <span className="text-xs text-parchment/50 shrink-0">{en ? 'Claim:' : '宣称：'}</span>
      <select value={claimSel} onChange={(e) => e.target.value && claim(e.target.value)} className="px-2 py-1.5 rounded bg-fog border border-eldritch/30 text-parchment text-sm">
        <option value="">{en ? '— claim a role —' : '— 宣称身份 —'}</option>
        {manifest.map((m, i) => <option key={i} value={m.role}>{m.role}</option>)}
      </select>
    </div>
  ) : null;

  return (
    <main className={`h-[100svh] flex flex-col overflow-hidden ${night ? 'bg-[#06060c]' : ''}`}>
      <header className="px-4 py-3 border-b border-eldritch/20 flex items-center justify-between gap-2">
        <span className="font-serif text-parchment text-sm truncate">{en ? 'Bloodbound' : '血染'} · {props.room.name}</span>
        <div className="flex items-center gap-2 shrink-0">
          {manifest.length > 0 && <button onClick={() => { setShowRoles((v) => !v); setShowPlayers(false); }} className="text-xs px-2 py-1 rounded bg-eldritch/30 text-parchment">{en ? 'Roles' : '身份'}</button>}
          <button onClick={() => { setShowPlayers((v) => !v); setShowRoles(false); }} className="text-xs px-2 py-1 rounded bg-eldritch/30 text-parchment">{en ? `Players ${bps.length}` : `玩家 ${bps.length}`}</button>
          <span className="text-xs text-parchment/50">{ended ? (en ? 'Over' : '结束') : night ? (en ? `🌙 N${day}` : `🌙 第${day}夜`) : voting ? (en ? `🗳 D${day} vote` : `🗳 第${day}天·投票`) : (en ? `☀ D${day}` : `☀ 第${day}天`)}</span>
        </div>
      </header>

      {showRoles && manifest.length > 0 && (
        <div className="px-4 py-3 bg-ink/70 border-b border-eldritch/20 max-w-3xl w-full mx-auto">
          <div className="text-xs text-parchment/50 mb-2">{en ? 'Roles that exist in this game (you don’t know who has which)' : '本局会出现的身份（不知道谁是谁）'}</div>
          <div className="space-y-1.5">
            {manifest.map((m, i) => (
              <div key={i} className="text-sm leading-snug"><span className="text-parchment/90">{m.role}</span> <span className={`text-[11px] ${teamCls[m.team] || 'text-parchment/50'}`}>· {teamName(m.team, en)}</span><div className="text-parchment/55 text-xs">{m.ability}</div></div>
            ))}
          </div>
        </div>
      )}

      {showPlayers && (
        <div className="px-4 py-3 bg-ink/70 border-b border-eldritch/20 max-w-3xl w-full mx-auto">
          <div className="text-xs text-parchment/50 mb-2">{en ? `Players (${bps.filter((p) => p.alive).length} alive / ${bps.length})` : `玩家（存活 ${bps.filter((p) => p.alive).length} / 共 ${bps.length}）`}</div>
          <div className="grid grid-cols-2 gap-1.5">
            {bps.map((p, i) => {
              const tr = trueRoleOf(p.seat);
              return (
                <div key={i} className={`text-sm rounded px-2 py-1 border ${p.alive ? 'bg-fog border-eldritch/30' : 'bg-ink border-parchment/15 text-parchment/40'}`}>
                  <span className={p.alive ? 'text-parchment/85' : 'line-through'}>{p.seat}·{p.display_name}</span>{p.is_ai ? ' 🤖' : ''}{!p.alive ? ' ☠' : ''}
                  {ended && tr ? <span className={`text-[11px] ${teamCls[tr.team] || ''}`}> ·「{tr.role}」</span>
                    : claims[p.seat] ? <span className="text-[11px] text-amber-300/80"> （{en ? 'claims' : '自称'}：{claims[p.seat]}）</span> : null}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="px-4 py-2 border-b border-eldritch/15 flex gap-1.5 flex-wrap">
        {bps.map((p, i) => (
          <span key={i} className={`text-xs px-2 py-1 rounded-full border ${p.seat === speaking && !night && !voting && !ended ? 'bg-eldritch/40 border-eldritch text-parchment' : p.alive ? 'bg-fog border-eldritch/30 text-parchment/80' : 'bg-ink border-parchment/15 text-parchment/30 line-through'}`}>
            {p.seat === speaking && !night && !voting && !ended ? '🎙 ' : ''}{p.seat}·{p.display_name}{p.is_ai ? ' 🤖' : ''}{!p.alive ? ' ☠' : ''}
            {claims[p.seat] && !ended ? <span className="text-amber-300/80">（{en ? 'c' : '自称'}:{claims[p.seat]}）</span> : null}
          </span>
        ))}
      </div>

      {roleCard && (
        <div className="border-b border-blood/25 bg-blood/10">
          <button onClick={() => setRoleOpen((v) => !v)} className="w-full flex items-center justify-between px-4 py-2 text-left">
            <span className="text-xs font-medium tracking-wide text-blood">🎭 {en ? 'YOUR ROLE (secret)' : '你的身份 · 仅你可见'}</span>
            <span className="text-xs text-parchment/50">{roleOpen ? (en ? 'hide ▲' : '收起 ▲') : (en ? 'show ▼' : '展开 ▼')}</span>
          </button>
          {roleOpen && <div className="px-4 pb-3 -mt-1 text-parchment/90 leading-relaxed whitespace-pre-line text-sm">{roleCard}</div>}
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-3 max-w-3xl w-full mx-auto">
        {messages.filter((m) => !['botc_role', 'botc_role_action', 'botc_manifest'].includes(m.payload?.type)).map((m) => <BotcMsg key={m.id} m={m} mine={m.sender_player_id === props.myPlayerId} en={en} />)}
        {busy && <div className="text-center text-parchment/40 italic text-sm">{en ? 'The Storyteller is resolving…' : '说书人结算中……'}</div>}
        <div ref={bottomRef} />
      </div>

      {ended ? (
        <div className="border-t border-blood/40 px-4 py-3 text-center max-w-3xl w-full mx-auto flex flex-col items-center gap-2" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
          <span className="text-parchment/70 text-sm">{en ? 'The game is over.' : '本局结束。'}</span>
          {isHost && (
            <button onClick={replay} disabled={busy} className="px-5 py-2 rounded bg-blood/80 hover:bg-blood text-parchment border border-blood text-sm disabled:opacity-50">
              {busy ? (en ? 'Resetting…' : '重置中…') : (en ? '↻ Play again (new setup)' : '↻ 再来一局（重新发身份）')}
            </button>
          )}
        </div>
      ) : night ? (
        <div className="border-t border-eldritch/20 px-4 py-3 space-y-2 max-w-3xl w-full mx-auto" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
          {iAmAlive && hasNightPower ? (
            <div className="flex gap-2 items-center flex-wrap">
              <span className="text-xs text-eldritch shrink-0">🌙 {en ? 'Your night power:' : '你的夜间能力：'} {nightLabel}</span>
              <select value={myNightTarget} onChange={(e) => e.target.value && nightAct(e.target.value)} disabled={busy} className="px-2 py-1.5 rounded bg-fog border border-eldritch/30 text-parchment text-sm">
                <option value="">{en ? '— choose target —' : '— 选择目标 —'}</option>
                {aliveTargets.map((p) => <option key={p.seat} value={p.seat}>{p.seat}·{p.display_name}</option>)}
              </select>
              {myNightTarget && <span className="text-xs text-eldritch">{en ? 'chosen: ' : '已选：'}{myNightTarget}</span>}
            </div>
          ) : (
            <div className="text-center text-sm text-parchment/50">{en ? 'Night falls — close your eyes and wait for dawn…' : '夜深了，闭眼等待天亮……'}</div>
          )}
          {isHost && (
            <button onClick={resolveNight} disabled={busy} className="w-full px-4 py-2 rounded bg-eldritch/60 hover:bg-eldritch text-parchment text-sm disabled:opacity-50">
              {busy ? (en ? 'Resolving…' : '结算中…') : (en ? 'Dawn ▶ resolve the night' : '天亮 ▶ 结算今夜')}
            </button>
          )}
          {!isHost && <div className="text-center text-[11px] text-parchment/35">{en ? 'The host calls dawn once night actions are in.' : '夜间行动提交后，由房主呼叫天亮。'}</div>}
        </div>
      ) : voting ? (
        <div className="border-t border-eldritch/20 px-4 py-3 space-y-2 max-w-3xl w-full mx-auto" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
          <div className="text-center text-xs text-blood">🗳 {en ? 'Voting — everyone speaks no more; cast your execution vote.' : '投票阶段 —— 大家都发言完了，请投出处决票。'}</div>
          {chatInput}
          <div className="flex gap-2 items-center flex-wrap">
            <span className="text-xs text-parchment/50 shrink-0">{iAmAlive ? (en ? 'Execute:' : '指认处决：') : (en ? '👻 Ghost vote:' : '👻 鬼票：')}</span>
            {canVote ? (
              <select value={myVote} onChange={(e) => e.target.value && vote(e.target.value)} disabled={busy} className="px-2 py-1.5 rounded bg-fog border border-eldritch/30 text-parchment text-sm">
                <option value="">{en ? '— pick —' : '— 选择 —'}</option>
                {aliveTargets.map((p) => <option key={p.seat} value={p.seat}>{p.seat}·{p.display_name}</option>)}
                <option value="skip">{en ? 'Skip / no vote' : '弃票'}</option>
              </select>
            ) : <span className="text-xs text-parchment/40">{en ? 'ghost vote spent' : '鬼票已用'}</span>}
            {myVote && <span className="text-xs text-eldritch">{en ? 'voted: ' : '已投：'}{myVote}</span>}
          </div>
          {isHost && (
            <button onClick={resolveDay} disabled={busy} className="w-full px-4 py-2 rounded bg-blood/70 hover:bg-blood text-parchment text-sm disabled:opacity-50">
              {busy ? (en ? 'Resolving…' : '结算中…') : (en ? 'Tally votes → execute ▶' : '结算处决（出今日票）▶')}
            </button>
          )}
          {!isHost && <div className="text-center text-[11px] text-parchment/35">{en ? 'The host tallies the vote.' : '由房主统计今日处决。'}</div>}
        </div>
      ) : (
        <div className="border-t border-eldritch/20 px-4 py-3 space-y-2 max-w-3xl w-full mx-auto" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
          <div className="text-center text-xs text-parchment/55">
            {myTurn ? <span className="text-eldritch">🎙 {en ? 'Your turn to speak — say your piece, then press “Done”.' : '轮到你发言 —— 说完后点"发言完毕"。'}</span>
              : speakerBp ? (en ? `🎙 Now speaking: ${speakerBp.seat}·${speakerBp.display_name}${speakerBp.is_ai ? ' 🤖' : ''}` : `🎙 当前发言：${speakerBp.seat}·${speakerBp.display_name}${speakerBp.is_ai ? ' 🤖' : ''}`)
              : (en ? 'Discussion…' : '讨论中……')}
          </div>
          {chatInput}
          {claimRow}
          {myTurn && (
            <button onClick={passTurn} disabled={busy} className="w-full px-4 py-2 rounded bg-eldritch/60 hover:bg-eldritch text-parchment text-sm disabled:opacity-50">
              {busy ? (en ? 'Passing…' : '处理中…') : (en ? 'Done speaking ▶' : '发言完毕 ▶')}
            </button>
          )}
        </div>
      )}
    </main>
  );
}

function BotcMsg({ m, mine, en }: { m: any; mine: boolean; en: boolean }) {
  const type = m.payload?.type;
  if (type === 'botc_reveal') return <div className="mx-auto max-w-2xl rounded-lg bg-blood/20 border border-blood/50 px-4 py-3 text-parchment leading-relaxed whitespace-pre-line">{m.content}</div>;
  if (type === 'botc_st') return <div className="mx-auto max-w-2xl rounded-lg bg-eldritch/10 border border-eldritch/40 px-4 py-3 text-parchment/90 leading-relaxed whitespace-pre-line text-sm">📖 {m.content}</div>;
  if (type === 'botc_private') return <div className="mx-auto max-w-2xl rounded-lg bg-amber-900/15 border border-amber-700/40 px-4 py-2 text-amber-200/90 leading-relaxed whitespace-pre-line text-sm">🔒 {en ? 'Only you:' : '仅你可见：'} {m.content}</div>;
  if (type === 'botc_vote') return <div className="text-center text-xs text-parchment/50">{m.content}</div>;
  if (type === 'botc_claim') return <div className="text-center text-xs text-amber-300/70">📣 {m.content}</div>;
  if (type === 'botc_ai') return (
    <div className="flex flex-col items-start">
      <span className="text-xs text-parchment/40 mb-1">{m.payload?.name} 🤖</span>
      <div className="max-w-[80%] px-4 py-2 rounded-lg bg-fog border border-eldritch/30 text-parchment/90">{m.content}</div>
    </div>
  );
  if (m.sender_type === 'system') return <div className="text-center text-sm text-parchment/50">{m.content}</div>;
  return (
    <div className={`flex flex-col ${mine ? 'items-end' : 'items-start'}`}>
      <span className="text-xs text-parchment/40 mb-1">{mine ? (en ? 'You' : '你') : (en ? 'Player' : '玩家')}</span>
      <div className={`max-w-[80%] px-4 py-2 rounded-lg ${mine ? 'bg-blood/25 border border-blood/40' : 'bg-fog border border-eldritch/30'} text-parchment/90`}>{m.content}</div>
    </div>
  );
}
