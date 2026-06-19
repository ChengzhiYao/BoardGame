'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { playSfx } from '@/lib/audio/sfx';
import { playBotcCue } from '@/lib/audio/botcCue';
import type { ShellProps } from './RoomShell';

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
  const [myVote, setMyVote] = useState('');
  const [myNightTarget, setMyNightTarget] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const sfxSeen = useRef<Set<string>>(new Set());
  const wokeFor = useRef<string>('');

  const phase = props.room.botc_phase as string | undefined;
  const day = props.room.botc_day || 0;
  const generating = props.room.modules_generating;
  const bps: any[] = props.botcPlayers || [];
  const inviteUrl = `${typeof window !== 'undefined' ? window.location.origin : props.siteUrl}/join/${props.inviteToken}`;
  const isHost = props.room.host_user_id === props.userId;
  const meBp = bps.find((p) => p.seat === props.mySeat);
  const iAmAlive = !meBp || meBp.alive;
  const usedGhost = !!meBp?.used_ghost_vote;
  const roleCard = messages.filter((m) => m.payload?.type === 'botc_role').slice(-1)[0]?.content || '';
  const myNightAction = messages.filter((m) => m.payload?.type === 'botc_role_action').slice(-1)[0]?.payload?.action || '';

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

  // 音效：新消息携带 payload.sfx 时播放（cue_* 为合成音，其余为素材音）
  useEffect(() => {
    for (const m of messages) {
      const sfx = m.payload?.sfx;
      if (!Array.isArray(sfx) || sfxSeen.current.has(m.id)) continue;
      sfxSeen.current.add(m.id);
      sfx.forEach((k: string) => (typeof k === 'string' && k.startsWith('cue_')) ? playBotcCue(k) : playSfx(k));
    }
  }, [messages]);

  // 入夜且自己有夜间能力 → 轻提示音"叫醒"
  useEffect(() => {
    if (phase === 'night' && iAmAlive && ['kill', 'poison', 'protect'].includes(myNightAction)) {
      const key = `${day}`; if (wokeFor.current !== key) { wokeFor.current = key; playBotcCue('cue_wake'); }
    }
  }, [phase, day, myNightAction, iAmAlive]);

  // 轮询兜底
  useEffect(() => {
    const tick = async () => {
      if (typeof document !== 'undefined' && document.hidden) return;
      const { data } = await supabase.from('messages').select('*').eq('room_id', props.room.id).order('created_at', { ascending: true }).limit(400);
      if (data) setMessages((prev) => { const ids = new Set(prev.map((m) => m.id)); const add = data.filter((m: any) => !ids.has(m.id)); return add.length ? [...prev, ...add] : prev; });
      const { data: r } = await supabase.from('rooms').select('botc_phase, botc_day').eq('id', props.room.id).maybeSingle();
      if (r && (r.botc_phase !== props.room.botc_phase || r.botc_day !== props.room.botc_day)) router.refresh();
    };
    const id = setInterval(tick, 4000);
    return () => clearInterval(id);
  }, [props.room.id, props.room.botc_phase, props.room.botc_day, supabase, router]);

  // 房主端：白天定时催 AI 发言
  useEffect(() => {
    if (!isHost || phase !== 'day') return;
    const run = () => { fetch('/api/botc/ai', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ roomId: props.room.id }) }).catch(() => {}); };
    const id = setInterval(run, 25000);
    return () => clearInterval(id);
  }, [isHost, phase, props.room.id]);

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
  async function resolveDay() { if (!confirm(en ? 'Tally votes and execute?' : '统计投票并处决？')) return; await call('/api/botc/resolve', { roomId: props.room.id }); }
  async function resolveNight() { if (!confirm(en ? 'Resolve the night?' : '结算今夜（天亮）？')) return; await call('/api/botc/resolve-night', { roomId: props.room.id }); }
  async function replay() {
    const d = await call('/api/rooms/replay', { roomId: props.room.id });
    if (d?.ok) router.refresh();
  }
  async function sendChat() {
    const c = text.trim(); if (!c || !props.myPlayerId) return;
    setText('');
    await supabase.from('messages').insert({ room_id: props.room.id, sender_type: 'player', sender_player_id: props.myPlayerId, content: c, visibility: 'public', turn_no: day });
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
  const aliveTargets = bps.filter((p) => p.alive && p.seat && p.seat !== props.mySeat);
  const hasNightPower = ['kill', 'poison', 'protect'].includes(myNightAction);
  const nightLabel = myNightAction === 'kill' ? (en ? 'Kill' : '杀害') : myNightAction === 'poison' ? (en ? 'Poison' : '投毒') : myNightAction === 'protect' ? (en ? 'Protect' : '保护') : '';
  const canVote = iAmAlive || !usedGhost; // 活人可投；死者保留一张鬼票

  return (
    <main className={`h-[100svh] flex flex-col overflow-hidden ${night ? 'bg-[#06060c]' : ''}`}>
      <header className="px-4 py-3 border-b border-eldritch/20 flex items-center justify-between">
        <span className="font-serif text-parchment">{en ? 'Bloodbound' : '血染'} · {props.room.name}</span>
        <span className="text-xs text-parchment/50">{ended ? (en ? 'Game over' : '对局结束') : night ? (en ? `🌙 Night ${day}` : `🌙 第 ${day} 夜`) : (en ? `☀ Day ${day} · discuss & vote` : `☀ 第 ${day} 天 · 讨论与投票`)}</span>
      </header>

      <div className="px-4 py-2 border-b border-eldritch/15 flex gap-1.5 flex-wrap">
        {bps.map((p, i) => (
          <span key={i} className={`text-xs px-2 py-1 rounded-full border ${p.alive ? 'bg-fog border-eldritch/30 text-parchment/80' : 'bg-ink border-parchment/15 text-parchment/30 line-through'}`}>
            {p.seat ? `${p.seat}·` : ''}{p.display_name}{p.is_ai ? ' 🤖' : ''}{!p.alive ? ' ☠' : ''}
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
        {messages.filter((m) => m.payload?.type !== 'botc_role' && m.payload?.type !== 'botc_role_action').map((m) => <BotcMsg key={m.id} m={m} mine={m.sender_player_id === props.myPlayerId} en={en} />)}
        {busy && <div className="text-center text-parchment/40 italic text-sm">{en ? 'The Storyteller is resolving…' : '说书人结算中……'}</div>}
        <div ref={bottomRef} />
      </div>

      {ended ? (
        <div className="border-t border-blood/40 px-4 py-3 text-center max-w-3xl w-full mx-auto flex flex-col items-center gap-2" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
          <span className="text-parchment/70 text-sm">{en ? 'The game is over.' : '本局结束。'}</span>
          {isHost && (
            <button onClick={replay} disabled={busy}
              className="px-5 py-2 rounded bg-blood/80 hover:bg-blood text-parchment border border-blood text-sm disabled:opacity-50">
              {busy ? (en ? 'Resetting…' : '重置中…') : (en ? '↻ Play again (new setup)' : '↻ 再来一局（重新发身份）')}
            </button>
          )}
        </div>
      ) : night ? (
        <div className="border-t border-eldritch/20 px-4 py-3 space-y-2 max-w-3xl w-full mx-auto" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
          {iAmAlive && hasNightPower ? (
            <div className="flex gap-2 items-center flex-wrap">
              <span className="text-xs text-eldritch shrink-0">🌙 {en ? 'Your night power:' : '你的夜间能力：'} {nightLabel}</span>
              <select value={myNightTarget} onChange={(e) => e.target.value && nightAct(e.target.value)} disabled={busy}
                className="px-2 py-1.5 rounded bg-fog border border-eldritch/30 text-parchment text-sm">
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
      ) : (
        <div className="border-t border-eldritch/20 px-4 py-3 space-y-2 max-w-3xl w-full mx-auto" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
          <div className="flex gap-2">
            <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && sendChat()}
              placeholder={iAmAlive ? (en ? 'Speak to the table…' : '公开发言…') : (en ? 'Speak from the grave…' : '亡者发言…')} disabled={!props.myPlayerId}
              className="flex-1 min-w-0 px-4 py-2 rounded bg-fog border border-eldritch/30 text-parchment placeholder:text-parchment/30 outline-none focus:border-eldritch disabled:opacity-50" />
            <button onClick={sendChat} disabled={!props.myPlayerId} className="px-4 py-2 rounded bg-eldritch/60 hover:bg-eldritch text-parchment text-sm shrink-0">{en ? 'Say' : '发言'}</button>
          </div>
          <div className="flex gap-2 items-center flex-wrap">
            <span className="text-xs text-parchment/50 shrink-0">{iAmAlive ? (en ? 'Execute:' : '指认处决：') : (en ? '👻 Ghost vote:' : '👻 鬼票：')}</span>
            {canVote ? (
              <select value={myVote} onChange={(e) => e.target.value && vote(e.target.value)} disabled={busy}
                className="px-2 py-1.5 rounded bg-fog border border-eldritch/30 text-parchment text-sm">
                <option value="">{en ? '— pick —' : '— 选择 —'}</option>
                {aliveTargets.map((p) => <option key={p.seat} value={p.seat}>{p.seat}·{p.display_name}</option>)}
                <option value="skip">{en ? 'Skip / no vote' : '弃票'}</option>
              </select>
            ) : <span className="text-xs text-parchment/40">{en ? 'ghost vote spent' : '鬼票已用'}</span>}
            {myVote && <span className="text-xs text-eldritch">{en ? 'voted: ' : '已投：'}{myVote}</span>}
          </div>
          {isHost && (
            <button onClick={resolveDay} disabled={busy} className="w-full px-4 py-2 rounded bg-blood/70 hover:bg-blood text-parchment text-sm disabled:opacity-50">
              {busy ? (en ? 'Resolving…' : '结算中…') : (en ? 'Tally votes → execute ▶' : '结算今日（处决）▶')}
            </button>
          )}
          {!isHost && <div className="text-center text-[11px] text-parchment/35">{en ? 'The host advances the day after discussion.' : '讨论后由房主推进当天结算。'}</div>}
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
