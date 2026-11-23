'use client';
import { toast, ask } from '@/components/Toast';
import Narration from '@/components/Narration';
import MicButton from '@/components/MicButton';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { playSfx } from '@/lib/audio/sfx';
import { playBotcCue } from '@/lib/audio/botcCue';
import type { ShellProps } from './RoomShell';
import { useTTS } from './useTTS';
import { Sheet, SheetLabel } from './ui';
const TEAM_C: Record<string, string> = { demon: '#e0473f', minion: '#e8904a', outsider: '#6fb6e8', townsfolk: '#5fcf95' };

const teamCls: Record<string, string> = { demon: 'text-red-400', minion: 'text-orange-400', outsider: 'text-sky-400', townsfolk: 'text-emerald-400' };
function teamName(t: string, en: boolean) { return t === 'demon' ? (en ? 'Demon' : '恶魔') : t === 'minion' ? (en ? 'Minion' : '爪牙') : t === 'outsider' ? (en ? 'Outsider' : '外来者') : (en ? 'Townsfolk' : '镇民'); }

const fresh = (m: any) => !!m?.created_at && Date.now() - new Date(m.created_at).getTime() < 90000;
export default function BotcRoom(props: ShellProps) {
  const router = useRouter();
  const supabase = useRef(createClient()).current;
  const en = props.room.language === 'en';
  const [messages, setMessages] = useState<any[]>(props.initialMessages);
  useTTS({ lang: props.room.language, messages, roomId: props.room.id, classify: (m: any) => { const t = m.payload?.type; if (t === 'botc_st' || t === 'botc_reveal') return { kind: 'narrator' as const, text: m.content }; return null; } });
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [size, setSize] = useState(6);
  const [theme, setTheme] = useState('');
  const [roleOpen, setRoleOpen] = useState(true);
  const [showRoles, setShowRoles] = useState(false);
  const [showPlayers, setShowPlayers] = useState(false);
  const [sheet, setSheet] = useState<null | 'role' | 'roles' | 'claim'>(null);
  const [showTheme, setShowTheme] = useState(false);
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
      if (!res.ok) toast(d.error || (en ? 'Error' : '出错了'));
      return d;
    } catch (e: any) { toast((en ? 'Failed: ' : '失败：') + e.message); }
    finally { setBusy(false); }
  }
  // Linger 伴侣邀请的局:TA 来开局(人数/题材按 TA 的口味)
  const compAuto = useRef(false);
  useEffect(() => {
    const comp = props.room.companion;
    if (!comp?.name || !isHost || compAuto.current || !(!phase || phase === 'lobby') || props.room.modules_generating) return;
    // 只在真正发出请求时才记"已开局";别用 cleanup 取消定时器(依赖一变就会把开局取消掉,之后再也不触发)
    const t = setTimeout(() => {
      if (compAuto.current) return; compAuto.current = true;
      fetch('/api/botc/start', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ roomId: props.room.id, size: comp.picks?.size || 6, theme: comp.picks?.theme || null }) })
        .then(() => router.refresh()).catch(() => { compAuto.current = false; });
    }, 1200);
    void t;
  }, [isHost, phase, props.room.modules_generating]);
  // 开局超过 25 秒还没进去:给个手动按钮兜底
  const [compSlow, setCompSlow] = useState(false);
  useEffect(() => { if (!props.room.companion?.name) return; const t = setTimeout(() => setCompSlow(true), 25000); return () => clearTimeout(t); }, []);
  async function start() { await call('/api/botc/start', { roomId: props.room.id, size, theme: theme.trim() || null }); }
  async function replay() {
    setResetting(true);
    try {
      const res = await fetch('/api/rooms/replay', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ roomId: props.room.id }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { toast(d.error || (en ? 'Error' : '出错了')); setResetting(false); return; }
      if (typeof window !== 'undefined') window.location.reload();
    } catch (e: any) { toast((en ? 'Failed: ' : '失败：') + e.message); setResetting(false); }
  }
  async function passTurn() { const d = await call('/api/botc/pass', { roomId: props.room.id }); if (d?.ok) router.refresh(); }
  async function resolveDay() { if (!(await ask(en ? 'Tally votes and execute?' : '统计投票并处决？'))) return; await call('/api/botc/resolve', { roomId: props.room.id }); }
  async function resolveNight() { if (!(await ask(en ? 'Resolve the night?' : '结算今夜（天亮）？'))) return; await call('/api/botc/resolve-night', { roomId: props.room.id }); }
  async function sendChat() {
    const c = text.trim(); if (!c || !props.myPlayerId) return;
    setText('');
    await supabase.from('messages').insert({ room_id: props.room.id, sender_type: 'player', sender_player_id: props.myPlayerId, content: c, visibility: 'public', turn_no: day });
    if (props.room.companion?.name) fetch('/api/linger/react', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ roomId: props.room.id }) }).catch(() => {}); // 伴侣接你的话
  }
  async function claim(role: string) {
    setClaimSel(role); if (!props.myPlayerId || !props.mySeat) return;
    await supabase.from('messages').insert({ room_id: props.room.id, sender_type: 'player', sender_player_id: props.myPlayerId, content: (en ? `claims to be 「${role}」` : `自称身份：「${role}」`), visibility: 'public', turn_no: day, payload: { type: 'botc_claim', seat: props.mySeat, role } });
  }
  async function vote(t: string) { setMyVote(t); await call('/api/botc/vote', { roomId: props.room.id, target: t }); }
  async function nightAct(t: string) { setMyNightTarget(t); await call('/api/botc/night', { roomId: props.room.id, target: t }); }

  // ===== 和 Linger 伴侣的局:不显示大厅,直接等 TA 开局 =====
  if (props.room.companion?.name && (!phase || phase === 'lobby' || phase === 'locking')) {
    const nm = props.room.companion.name;
    return (
      <main className="min-h-[100svh] flex flex-col items-center justify-center gap-5 px-6 text-center">
        {props.room.companion.avatar ? <img src={props.room.companion.avatar} alt="" className="w-20 h-20 rounded-full object-cover border border-eldritch/40" /> : null}
        <h1 className="text-2xl font-serif text-parchment">{en ? `${nm} is setting up the game…` : `${nm} 正在开局…`}</h1>
        <p className="text-parchment/55 max-w-sm">{en ? 'The Storyteller is dealing roles. Anyone could be evil — including you, and including them.' : '说书人正在发身份。谁都可能是邪恶方——包括你,也包括 TA。'}</p>
        <div className="flex gap-1.5">{[0, 1, 2].map((i) => <span key={i} className="w-2 h-2 rounded-full bg-parchment/50 animate-pulse" style={{ animationDelay: `${i * 0.2}s` }} />)}</div>
        {compSlow && isHost && <button disabled={busy} onClick={start} className="mt-2 px-5 py-2 rounded-full border border-eldritch/40 text-sm text-parchment/80">{en ? 'Taking too long? Start now' : '等太久了?现在开始'}</button>}
      </main>
    );
  }
  // ===== 大厅 =====
  if (!phase || phase === 'lobby') {
    const count = props.initialPlayers.length;
    return (
      <main className="min-h-[100svh] flex flex-col items-center justify-center px-5 pb-10 text-center" style={{ paddingTop: 'calc(max(10px, env(safe-area-inset-top)) + 56px)' }}>
        <div className="relative w-24 h-24 mb-2">
          <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle,rgba(224,71,63,.35),transparent_65%)] animate-pulse" />
          <svg viewBox="0 0 64 64" className="absolute inset-3"><g fill="none" stroke="#efe6d2" strokeWidth="1.4" strokeLinecap="round"><path d="M32 6v6M32 12l-10 8v30h20V20z" /><path d="M22 50h20M26 30h12M28 38h8" /><circle cx="32" cy="24" r="3" fill="#e0473f" stroke="none" /></g></svg>
        </div>
        <div className="text-[10.5px] tracking-[.45em] pl-[.45em] text-[#e0473f]/85">{en ? 'SOCIAL DEDUCTION' : '社 交 推 理'}</div>
        <h1 className="mt-3 font-serif font-semibold text-[28px] text-[#efe6d2]">{en ? 'Someone at this table is evil' : '这张桌上，有人是恶魔'}</h1>
        <p className="mt-3 max-w-xs font-serif text-[14.5px] leading-[1.85] text-parchment/70">{en ? 'Get a secret role. By day, talk and vote someone out. By night, the evil ones strike. The AI Storyteller runs it and fills the seats.' : '每人拿到一个秘密身份。白天发言、投票处决；夜里，邪恶方动手。AI 说书人主持，空位由 AI 补上。'}</p>
        <div className="mt-5 flex items-center gap-2.5 text-[12px] tracking-wider text-parchment/50">
          <span>{en ? '~30 min' : '约 30 分钟'}</span><span className="w-[3px] h-[3px] rotate-45 bg-[#c9a96e]/60" /><span>{en ? `${count} real · AI fills the rest` : `真人 ${count} 位 · 其余 AI`}</span>
        </div>
        <div className="mt-6 w-full max-w-sm space-y-3">
          <div className="flex p-1 rounded-xl bg-white/[0.04] border border-white/[0.08]">
            {[4, 6, 8].map((n) => <button key={n} onClick={() => setSize(n)} className={`flex-1 h-9 rounded-lg text-[14px] transition ${size === n ? 'bg-[#e0473f]/20 text-[#efe6d2]' : 'text-parchment/55'}`}>{n}{en ? ' seats' : ' 人局'}</button>)}
          </div>
          <button onClick={start} disabled={busy || generating} className="w-full py-3.5 rounded-xl bg-[#7d1d1d] hover:bg-[#8e2323] border border-[#a83232]/60 text-[#f2ead9] font-serif font-semibold tracking-[.2em] text-[17px] shadow-[0_10px_40px_-10px_rgba(125,29,29,.7)] disabled:opacity-60">
            {busy || generating ? (en ? 'Dealing roles…' : '正在发身份……') : (en ? 'Begin' : '开 始')}
          </button>
          <button onClick={() => setShowTheme((v) => !v)} className="text-[13px] text-parchment/50">{en ? 'Pick a theme' : '换个题材'} {showTheme ? '▴' : '▾'}</button>
          {showTheme && <input value={theme} onChange={(e) => setTheme(e.target.value)} placeholder={en ? 'cyberpunk cult, haunted school…' : '比如：赛博邪教、闹鬼校园……'} className="w-full px-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-[#efe6d2] text-[14px] placeholder:text-parchment/30 outline-none focus:border-[#c9a96e]/50 nf-in" />}
        </div>
        <div className="mt-4 w-full max-w-sm flex items-center gap-2 rounded-xl border border-[#d8c7a8]/[0.13] bg-[#0b0c0f]/60 px-4 py-2.5 text-left">
          <span className="flex-1 text-[13px] text-parchment/70">{en ? 'Bring friends' : '叫朋友一起'} <span className="text-parchment/35">· {en ? 'more humans, more lies' : '真人越多越好玩'}</span></span>
          <button onClick={() => { navigator.clipboard.writeText(inviteUrl); setCopied(true); setTimeout(() => setCopied(false), 1500); }} className="shrink-0 text-[13px] text-[#c9a96e] border-b border-[#c9a96e]/40">{copied ? (en ? 'Copied' : '已复制') : (en ? 'Copy link' : '复制链接')}</button>
          <button onClick={() => { try { (navigator as any).share ? (navigator as any).share({ title: 'MystNight', url: inviteUrl }) : navigator.clipboard.writeText(inviteUrl); } catch {} }} className="shrink-0 ml-2 text-[13px] text-parchment/60">{en ? 'Share' : '分享'}</button>
        </div>
      </main>
    );
  }

  const ended = phase === 'reveal';
  const night = phase === 'night';
  const voting = phase === 'vote';
  const hasNightPower = ['kill', 'poison', 'protect', 'inspect'].includes(myNightAction);
  const nightLabel = myNightAction === 'kill' ? (en ? 'Kill' : '杀害') : myNightAction === 'poison' ? (en ? 'Poison' : '投毒') : myNightAction === 'protect' ? (en ? 'Protect' : '保护') : myNightAction === 'inspect' ? (en ? 'Inspect' : '查验') : '';
  const canVote = iAmAlive || !usedGhost;
  const trueRoleOf = (seat: string) => revealAssign.find((a) => a.seat === seat);
  const pickMode: null | 'night' | 'vote' = ended ? null : night && iAmAlive && hasNightPower ? 'night' : voting && canVote ? 'vote' : null;
  const picked = pickMode === 'night' ? myNightTarget : pickMode === 'vote' ? myVote : '';
  const alive = bps.filter((p) => p.alive).length;
  const myTeam = (manifest.find((m: any) => roleCard.includes(m.role)) || {}).team as string | undefined;
  const phaseText = ended ? (en ? 'The end' : '终局') : night ? (en ? `Night ${day}` : `第 ${day} 夜`) : voting ? (en ? `Day ${day} · Vote` : `第 ${day} 天 · 投票`) : (en ? `Day ${day}` : `第 ${day} 天`);
  function tapSeat(p: any) {
    if (!pickMode || !p.alive || p.seat === props.mySeat || busy) return;
    try { (navigator as any).vibrate?.(12); } catch {}
    if (pickMode === 'night') nightAct(p.seat); else vote(p.seat);
  }

  return (
    <main className="relative h-[100svh] flex flex-col overflow-hidden">
      <div aria-hidden className="fixed inset-0 -z-[5] pointer-events-none transition-colors duration-1000" style={{ background: night ? 'radial-gradient(110% 70% at 50% 0%, rgba(40,50,110,.45), rgba(5,6,14,.97) 70%)' : voting ? 'radial-gradient(110% 70% at 50% 0%, rgba(120,24,24,.4), rgba(12,8,8,.96) 70%)' : 'radial-gradient(110% 70% at 50% 0%, rgba(150,100,50,.28), rgba(12,11,10,.95) 70%)' }} />
      {night && <div aria-hidden className="fixed inset-0 -z-[4] pointer-events-none opacity-60" style={{ backgroundImage: 'radial-gradient(1px 1px at 20% 30%, #fff8, transparent), radial-gradient(1px 1px at 70% 20%, #fff6, transparent), radial-gradient(1.5px 1.5px at 40% 12%, #fff7, transparent), radial-gradient(1px 1px at 85% 40%, #fff5, transparent), radial-gradient(1px 1px at 10% 8%, #fff6, transparent)' }} />}

      {/* 顶部：阶段 + 我的身份 + 身份表 */}
      <header className="shrink-0 px-3" style={{ paddingTop: 'calc(max(10px, env(safe-area-inset-top)) + 50px)' }}>
        <div className="mx-auto max-w-2xl flex items-center gap-2 h-14 px-2.5 rounded-2xl bg-[#0e0f13]/70 backdrop-blur-md border border-white/[0.07]">
          <span className="w-10 h-10 rounded-xl flex items-center justify-center text-[18px]" style={{ background: night ? 'rgba(90,110,220,.18)' : voting ? 'rgba(224,71,63,.18)' : 'rgba(230,170,90,.16)' }}>{ended ? '⚑' : night ? '☾' : voting ? '⚖' : '☀'}</span>
          <span className="min-w-0 flex-1">
            <span className="block font-serif text-[15px] text-[#efe6d2] leading-tight">{phaseText}</span>
            <span className="block text-[11.5px] text-parchment/45">{en ? `${alive} alive of ${bps.length}` : `存活 ${alive} / ${bps.length}`}</span>
          </span>
          {roleCard && (
            <button onClick={() => setSheet('role')} className="h-10 px-3 rounded-xl border flex items-center gap-1.5 text-[12.5px]" style={{ borderColor: (TEAM_C[myTeam || ''] || '#c9a96e') + '66', color: TEAM_C[myTeam || ''] || '#e8d7b0', background: (TEAM_C[myTeam || ''] || '#c9a96e') + '14' }}>
              <span className="w-2 h-2 rounded-full" style={{ background: TEAM_C[myTeam || ''] || '#c9a96e' }} />{en ? 'My role' : '我的身份'}
            </button>
          )}
          {manifest.length > 0 && <button onClick={() => setSheet('roles')} className="h-10 px-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-[12.5px] text-[#d8c7a8]">{en ? 'Roles' : '身份表'}</button>}
        </div>
      </header>

      {/* 座位：白天看谁在发言，投票 / 夜里直接点人 */}
      <div className="shrink-0 px-2 pt-3">
        {pickMode && <div className="text-center text-[12.5px] mb-2" style={{ color: pickMode === 'night' ? '#a9b8ff' : '#ff9a8a' }}>{pickMode === 'night' ? (en ? `Tap someone to ${nightLabel.toLowerCase()}` : `点一个人 · ${nightLabel}`) : iAmAlive ? (en ? 'Tap who should be executed' : '点你要处决的人') : (en ? 'Ghost vote: tap someone (once per game)' : '鬼票：点一个人（整局只有一次）')}</div>}
        <div className="flex gap-2.5 overflow-x-auto px-2 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden justify-start sm:justify-center">
          {bps.map((p, i) => {
            const isMe = p.seat === props.mySeat;
            const talking = p.seat === speaking && !night && !voting && !ended;
            const tr = ended ? trueRoleOf(p.seat) : null;
            const sel = picked === p.seat;
            const tappable = !!pickMode && p.alive && !isMe;
            const ring = sel ? (pickMode === 'night' ? '#a9b8ff' : '#ff6a5a') : talking ? '#e8c27a' : tr ? (TEAM_C[tr.team] || '#888') : isMe ? '#c9a96e' : 'rgba(255,255,255,.14)';
            return (
              <button key={i} onClick={() => tapSeat(p)} disabled={!tappable}
                className={`shrink-0 w-[64px] flex flex-col items-center transition ${p.alive ? '' : 'opacity-45'} ${tappable ? 'active:scale-95' : ''}`}>
                <span className={`relative w-12 h-12 rounded-full flex items-center justify-center font-serif text-[18px] ${talking ? 'animate-pulse' : ''}`}
                  style={{ boxShadow: `0 0 0 2px ${ring}${sel || talking ? `, 0 0 18px ${ring}` : ''}`, background: p.alive ? 'radial-gradient(circle at 50% 35%, #2a2620, #121114)' : '#0d0d10', color: p.alive ? '#efe6d2' : 'rgba(239,230,210,.5)' }}>
                  {p.alive ? String(p.display_name || '?').slice(0, 1) : '☠'}
                  {p.is_ai && p.seat !== props.room.companion?.seat && <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 px-1 rounded bg-[#15131c] border border-white/15 text-[8.5px] text-parchment/60 leading-[13px]">AI</span>}
                  {talking && <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#e8c27a] text-[9px] text-black flex items-center justify-center">🎙</span>}
                </span>
                <span className={`mt-1.5 text-[11.5px] max-w-full truncate ${isMe ? 'text-[#e8d7b0]' : 'text-[#efe6d2]/80'}`}>{isMe ? (en ? 'You' : '你') : p.display_name}</span>
                {tr ? <span className="text-[10px] truncate max-w-full" style={{ color: TEAM_C[tr.team] }}>{tr.role}</span>
                  : claims[p.seat] ? <span className="text-[10px] text-[#e8c27a]/75 truncate max-w-full">「{claims[p.seat]}」</span> : <span className="h-[14px]" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* 故事 */}
      <section className="flex-1 min-h-0 overflow-y-auto mn-fade-top">
        <div className="mx-auto max-w-2xl px-4 pt-3 pb-6 space-y-3.5">
          {messages.filter((m) => !['botc_role', 'botc_role_action', 'botc_manifest'].includes(m.payload?.type)).map((m) => <BotcMsg key={m.id} m={m} mine={m.sender_player_id === props.myPlayerId} en={en} />)}
          {busy && <div className="flex items-center justify-center gap-2.5 py-2 text-[12.5px] tracking-[.18em] text-[#c9a96e]/75"><span className="flex gap-1">{[0, 1, 2].map((i) => <span key={i} className="w-1.5 h-1.5 rounded-full bg-[#c9a96e]/80 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />)}</span>{en ? 'The Storyteller speaks' : '说书人正在讲述'}</div>}
          <div ref={bottomRef} className="h-1" />
        </div>
      </section>

      {/* 底部 */}
      <footer className="shrink-0 px-3 pt-2 bg-gradient-to-t from-[#0b0c0f] via-[#0b0c0f]/95 to-[#0b0c0f]/0" style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}>
        <div className="mx-auto max-w-2xl space-y-2">
          {ended ? (
            <div className="rounded-2xl border border-white/10 bg-[#111216]/90 px-4 py-4 text-center">
              <div className="font-serif text-[16px] text-[#efe6d2]">{en ? 'The masks are off.' : '面具都摘下来了。'}</div>
              <div className="mt-3 flex gap-2.5">
                <a href="/play" className="flex-1 h-11 rounded-xl border border-white/12 text-[14px] text-parchment/75 flex items-center justify-center">{en ? 'Back to hall' : '回到大厅'}</a>
                {isHost && <button onClick={replay} disabled={resetting} className="flex-1 h-11 rounded-xl bg-[#7d1d1d] border border-[#a83232]/60 text-[#f2ead9] text-[14px] disabled:opacity-50">{resetting ? '…' : (en ? 'New roles' : '再来一局')}</button>}
              </div>
            </div>
          ) : (
            <>
              <div className="text-center text-[12.5px] min-h-[18px]">
                {night ? (pickMode ? (picked ? <span className="text-[#a9b8ff]">{en ? 'Chosen — you can still change' : '已选好 · 天亮前还能换'}</span> : null) : <span className="text-parchment/45">{en ? 'Night. Close your eyes…' : '夜深了，闭上眼睛……'}</span>)
                  : voting ? (picked ? <span className="text-[#ff9a8a]">{en ? `Voted: ${picked === 'skip' ? 'skip' : bps.find((p) => p.seat === picked)?.display_name}` : `已投：${picked === 'skip' ? '弃票' : bps.find((p) => p.seat === picked)?.display_name}`}</span> : !canVote ? <span className="text-parchment/40">{en ? 'Ghost vote spent' : '鬼票已用过'}</span> : null)
                  : myTurn ? <span className="text-[#e8c27a]">{en ? 'Your turn to speak' : '轮到你发言了'}</span>
                  : speakerBp ? <span className="text-parchment/50">{en ? `${speakerBp.display_name} is speaking` : `${speakerBp.display_name} 正在发言`}</span> : null}
              </div>
              {!night && (
                <div className="flex items-end gap-2">
                  <div className="flex-1 min-w-0 flex items-end rounded-2xl border border-white/[0.12] focus-within:border-[#c9a96e]/50 bg-[#0f1014]/90 backdrop-blur pl-4 pr-1.5 py-1.5">
                    <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !(e.nativeEvent as any).isComposing) sendChat(); }}
                      placeholder={iAmAlive ? (en ? 'Say something to the table…' : '对大家说……') : (en ? 'Speak from the grave…' : '亡者发言……')} disabled={!props.myPlayerId}
                      className="flex-1 min-w-0 bg-transparent py-[9px] text-[15px] text-[#efe6d2] placeholder:text-parchment/35 outline-none disabled:opacity-50" />
                    <MicButton value={text} onChange={setText} en={en} compact />
                  </div>
                  <button onClick={sendChat} disabled={!text.trim() || !props.myPlayerId} aria-label={en ? 'Send' : '发送'} className="shrink-0 h-12 w-12 rounded-2xl bg-[#7d1d1d] border border-[#a83232]/60 text-[#f2ead9] flex items-center justify-center disabled:opacity-35">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19V5M5.5 11.5L12 5l6.5 6.5" /></svg>
                  </button>
                </div>
              )}
              <div className="flex gap-2">
                {!night && !voting && iAmAlive && manifest.length > 0 && <button onClick={() => setSheet('claim')} className="h-10 px-3.5 rounded-xl border border-[#e8c27a]/35 text-[13px] text-[#e8c27a]">{claimSel ? (en ? `Claimed ${claimSel}` : `自称「${claimSel}」`) : (en ? 'Claim a role' : '亮身份')}</button>}
                {myTurn && !night && !voting && <button onClick={passTurn} disabled={busy} className="flex-1 h-10 rounded-xl bg-[#e8c27a] text-[#1a140a] text-[14px] font-medium disabled:opacity-50">{en ? 'Done speaking' : '我说完了'}</button>}
                {voting && canVote && <button onClick={() => vote('skip')} disabled={busy} className={`h-10 px-4 rounded-xl border text-[13px] ${myVote === 'skip' ? 'border-[#ff9a8a] text-[#ff9a8a]' : 'border-white/12 text-parchment/60'}`}>{en ? 'Skip vote' : '弃票'}</button>}
                {isHost && night && <button onClick={resolveNight} disabled={busy} className="flex-1 h-10 rounded-xl bg-[#3a4790] border border-[#a9b8ff]/40 text-[#eef0ff] text-[14px] disabled:opacity-50">{busy ? '…' : (en ? 'Call the dawn ☀' : '天亮了 ☀')}</button>}
                {isHost && voting && <button onClick={resolveDay} disabled={busy} className="flex-1 h-10 rounded-xl bg-[#7d1d1d] border border-[#a83232]/60 text-[#f2ead9] text-[14px] disabled:opacity-50">{busy ? '…' : (en ? 'Count the votes' : '计票处决')}</button>}
              </div>
              {!isHost && (night || voting) && <div className="text-center text-[11px] text-parchment/35">{night ? (en ? 'The host calls the dawn' : '房主会叫天亮') : (en ? 'The host counts the votes' : '房主会计票')}</div>}
            </>
          )}
        </div>
      </footer>

      <Sheet open={sheet === 'role'} onClose={() => setSheet(null)} title={en ? 'Your secret role' : '你的秘密身份'}>
        <div className="rounded-2xl p-4 border" style={{ borderColor: (TEAM_C[myTeam || ''] || '#c9a96e') + '55', background: `radial-gradient(120% 80% at 50% 0%, ${(TEAM_C[myTeam || ''] || '#c9a96e')}22, transparent 70%)` }}>
          {myTeam && <div className="text-[11px] tracking-[.3em] mb-2" style={{ color: TEAM_C[myTeam] }}>{teamName(myTeam, en)}{myTeam === 'demon' || myTeam === 'minion' ? (en ? ' · EVIL' : ' · 邪恶方') : (en ? ' · GOOD' : ' · 好人方')}</div>}
          <div className="font-serif text-[15px] leading-[1.9] text-[#efe6d2]/90 whitespace-pre-line">{roleCard}</div>
        </div>
        {hasNightPower && <p className="mt-3 text-[12.5px] text-parchment/45">{en ? `At night, tap a seat to ${nightLabel.toLowerCase()}.` : `夜里，直接点座位上的人来「${nightLabel}」。`}</p>}
      </Sheet>
      <Sheet open={sheet === 'roles'} onClose={() => setSheet(null)} title={en ? 'Roles in this game' : '本局会出现的身份'}>
        <p className="text-[12.5px] text-parchment/45 mb-3">{en ? 'You don’t know who has which.' : '你不知道谁是谁。'}</p>
        {['townsfolk', 'outsider', 'minion', 'demon'].map((tm) => {
          const list = manifest.filter((m: any) => m.team === tm);
          if (!list.length) return null;
          return (
            <div key={tm} className="mb-4">
              <SheetLabel><span style={{ color: TEAM_C[tm] }}>{teamName(tm, en)}</span></SheetLabel>
              <div className="space-y-2">{list.map((m: any, i: number) => (
                <div key={i} className="rounded-xl border border-white/[0.07] bg-white/[0.025] px-3.5 py-2.5"><div className="text-[14px] text-[#efe6d2]">{m.role}</div><div className="text-[12.5px] text-parchment/55 leading-relaxed">{m.ability}</div></div>
              ))}</div>
            </div>
          );
        })}
      </Sheet>
      <Sheet open={sheet === 'claim'} onClose={() => setSheet(null)} title={en ? 'Claim a role (you may lie)' : '对大家亮身份（可以说谎）'}>
        <div className="grid grid-cols-2 gap-2">
          {manifest.map((m: any, i: number) => (
            <button key={i} onClick={() => { claim(m.role); setSheet(null); }} className={`rounded-xl border px-3 py-2.5 text-left ${claimSel === m.role ? 'border-[#e8c27a]/70 bg-[#e8c27a]/10' : 'border-white/10 bg-white/[0.03]'}`}>
              <div className="text-[14px] text-[#efe6d2]">{m.role}</div><div className="text-[11px]" style={{ color: TEAM_C[m.team] }}>{teamName(m.team, en)}</div>
            </button>
          ))}
        </div>
      </Sheet>
    </main>
  );
}

function BotcMsg({ m, mine, en }: { m: any; mine: boolean; en: boolean }) {
  const type = m.payload?.type;
  if (type === 'botc_reveal') return <Narration text={m.content} lang={en ? 'en' : 'zh'} fresh={fresh(m)} tone="reveal" label={en ? 'Revealed' : '揭晓'} collapse={false} />;
  if (type === 'botc_st') return <Narration text={m.content} lang={en ? 'en' : 'zh'} fresh={fresh(m)} tone={(m.payload?.sfx || []).some((x: string) => /death|execution/.test(x)) ? 'danger' : 'kp'} label={en ? 'Storyteller' : '说书人'} />;
  if (type === 'botc_private') return <div className="rounded-2xl bg-[#2a2210]/60 border border-[#e8c27a]/35 px-4 py-3 text-[14px] text-[#f3e6c4] leading-relaxed whitespace-pre-line"><div className="text-[10.5px] tracking-[.22em] text-[#e8c27a] mb-1">{en ? 'ONLY YOU' : '只有你知道'}</div>{m.content}</div>;
  if (type === 'botc_vote') return <div className="flex justify-center"><span className="px-3 py-1 rounded-full border border-[#e0473f]/25 text-[12px] text-[#ffb3a8]/80">{m.content}</span></div>;
  if (type === 'botc_claim') return <div className="flex justify-center"><span className="px-3 py-1 rounded-full border border-[#e8c27a]/30 bg-[#e8c27a]/[0.06] text-[12.5px] text-[#e8c27a]">{m.content}</span></div>;
  if (type === 'botc_ai' || type === 'companion') return (
    <div className="flex flex-col items-start">
      <span className="text-[11.5px] text-parchment/45 mb-1 px-1">{m.payload?.name}</span>
      <div className="max-w-[86%] px-4 py-2.5 rounded-2xl rounded-tl-md border border-white/10 bg-white/[0.045] text-[14.5px] leading-relaxed text-[#efe6d2]/92">{m.content}</div>
    </div>
  );
  if (m.sender_type === 'system') return <div className="flex justify-center"><span className="px-3.5 py-1.5 rounded-full border border-white/[0.07] text-[12.5px] text-parchment/50 text-center">{m.content}</span></div>;
  return (
    <div className={`flex flex-col ${mine ? 'items-end' : 'items-start'}`}>
      <span className="text-[11.5px] text-parchment/40 mb-1 px-1">{mine ? (en ? 'You' : '你') : (m.payload?.name || (en ? 'Player' : '玩家'))}</span>
      <div className={`max-w-[86%] px-4 py-2.5 text-[14.5px] leading-relaxed ${mine ? 'rounded-2xl rounded-br-md border border-[#c9a96e]/30 bg-[#c9a96e]/[0.09] text-[#efe6d2]' : 'rounded-2xl rounded-tl-md border border-[#5aa39a]/25 bg-[#5aa39a]/[0.07] text-[#efe6d2]/92'}`}>{m.content}</div>
    </div>
  );
}
