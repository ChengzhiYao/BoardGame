'use client';
import { LightPaywall, LightLine, useLightStatus } from '@/components/LightPay';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { ShellProps } from './RoomShell';
import MccCard, { CardBack, cardColor, cardName, cardDesc } from './MccCard';
import { mccSfx } from '@/lib/audio/mccCue';

const META: Record<string, { e: string; zh: string; en: string; d_zh: string; d_en: string }> = {
  curse: { e: '😼', zh: '诅咒猫', en: 'Curse Cat', d_zh: '抽到即出局，除非有护身铃', d_en: 'Drawing it eliminates you unless warded' },
  ward: { e: '🔔', zh: '护身铃', en: 'Ward Bell', d_zh: '抽到诅咒猫时化解，并把它塞回牌堆', d_en: 'Cancels a drawn Curse Cat; hide it back in the deck' },
  nap: { e: '😴', zh: '打盹', en: 'Moon Nap', d_zh: '跳过抽牌，直接结束回合', d_en: 'Skip your draw, end your turn' },
  swap: { e: '🐾', zh: '换爪', en: 'Paw Swap', d_zh: '与一名玩家各随机交换一张牌', d_en: 'Swap one random card with a player' },
  peek: { e: '🕯️', zh: '烛光窥视', en: 'Candle Peek', d_zh: '偷看牌堆顶 3 张', d_en: 'Look at the top 3 cards' },
  shuffle: { e: '🌀', zh: '走廊洗牌', en: 'Hallway Shuffle', d_zh: '把牌堆彻底洗乱', d_en: 'Shuffle the deck' },
  hex: { e: '🧶', zh: '毛球诅咒', en: 'Hairball Hex', d_zh: '指定一名玩家，他要连走两轮', d_en: 'A chosen player must take 2 turns' },
  thief: { e: '🍤', zh: '零食小偷', en: 'Treat Thief', d_zh: '随机偷走一名玩家一张牌', d_en: 'Steal a random card from a player' },
  noise: { e: '🔊', zh: '地窖骚动', en: 'Basement Noise', d_zh: '所有人向左手边传一张牌', d_en: 'Everyone passes one card left' },
  lives: { e: '🐈', zh: '九条命', en: 'Nine Lives', d_zh: '从弃牌堆捡回一张牌', d_en: 'Recover one card from the discard' },
  hiss: { e: '🙀', zh: '嘶吼', en: 'Hiss', d_zh: '在响应窗口取消别人刚打出的牌（可被反取消）', d_en: 'Cancel a just-played card during the reaction window' },
  mirror: { e: '🪞', zh: '镜爪', en: 'Mirror Paw', d_zh: '被指定为目标时，把矛头转给另一名玩家', d_en: 'When targeted, redirect it to another player' },
};
const NEEDS_TARGET = ['swap', 'hex', 'thief'];
const buzz = (p: number | number[]) => { try { (navigator as any).vibrate?.(p); } catch {} };
const SEAT_HUE = ['#e7b85a', '#5fd1c1', '#f06a5a', '#a78bfa', '#7fb4ff', '#f29ac0'];
function cn(k: string, en: boolean) { const m = META[k]; return m ? `${m.e} ${en ? m.en : m.zh}` : k; }

export default function MccRoom(props: ShellProps) {
  const router = useRouter();
  const supabase = useRef(createClient()).current;
  const en = props.room.language === 'en';
  const pub: any = props.mccPublic;
  const [hand, setHand] = useState<string[]>(props.mccHand || []);
  useEffect(() => { setHand(props.mccHand || []); }, [props.mccHand]);
  const [busy, setBusy] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [stBump, setStBump] = useState(0);
  const lightSt = useLightStatus('mcc', stBump);
  const [copied, setCopied] = useState(false);
  const [pickCard, setPickCard] = useState<string>('');
  const [peek, setPeek] = useState<string[] | null>(null);
  const [mirrorPick, setMirrorPick] = useState(false);
  const [showDiscard, setShowDiscard] = useState(false);
  const [preview, setPreview] = useState<number | null>(null);
  const [armed, setArmed] = useState(false);
  const [flashKey, setFlashKey] = useState(0);
  const [resetting, setResetting] = useState(false);
  const [drag, setDrag] = useState<{ card: string; x: number; y: number } | null>(null);
  const [sel, setSel] = useState<number | null>(null);
  const [showLog, setShowLog] = useState(false);
  const dragRef = useRef<any>(null);
  const touchStartY = useRef(0);
  const armedRef = useRef(false);
  const [aiFill, setAiFill] = useState(true);
  const [totalSeats, setTotalSeats] = useState(4);
  const logRef = useRef<HTMLDivElement>(null);
  const logLen = useRef<number>(props.mccPublic?.logSeq ?? (props.mccPublic?.log?.length || 0));

  const isHost = props.room.host_user_id === props.userId;
  const mySeat = props.mySeat;
  const phase = props.room.mcc_phase as string | undefined;
  const started = !!pub && pub.status;
  const ended = pub?.status === 'ended';
  const myTurn = started && !ended && pub.turn === mySeat && !pub.pending;
  const wardMe = pub?.pending?.type === 'ward' && pub.pending.seat === mySeat;
  const inviteUrl = `${typeof window !== 'undefined' ? window.location.origin : props.siteUrl}/join/${props.inviteToken}`;

  useEffect(() => {
    const ch = supabase.channel(`mcc-${props.room.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mcc_public', filter: `room_id=eq.${props.room.id}` }, () => router.refresh())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mcc_hands', filter: `room_id=eq.${props.room.id}` }, () => router.refresh())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms', filter: `id=eq.${props.room.id}` }, () => router.refresh())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [props.room.id, supabase, router]);

  // 轮询兜底
  useEffect(() => {
    const id = setInterval(() => { if (typeof document !== 'undefined' && !document.hidden) router.refresh(); }, 4000);
    return () => clearInterval(id);
  }, [router]);

  useEffect(() => { logRef.current?.scrollTo({ top: logRef.current.scrollHeight }); }, [pub?.logSeq]);

  // 音效：扫描新日志触发。注意 pub.log 只是"最后 20 条"的滑动窗口，
  // 必须用真实总数 logSeq 判断新增，否则过了 20 条后所有音效都不再响。
  useEffect(() => {
    const logs = pub?.log || [];
    const total = (pub?.logSeq ?? logs.length) as number;
    if (total > logLen.current) {
      const newCount = Math.min(total - logLen.current, logs.length);
      for (const l of logs.slice(logs.length - newCount)) {
        const m = l.msg || '';
        if (m.includes('💀')) { mccSfx('eliminate'); setFlashKey((k) => k + 1); }
        else if (m.includes('🏆')) mccSfx('win');
        else if (m.includes('🔔')) { mccSfx('ward'); setFlashKey((k) => k + 1); }
        else if (m.includes('🎴')) mccSfx('draw');
        else if (m.includes('🙀')) mccSfx('hiss');
        else if (m.includes('🌀')) mccSfx('shuffle');
        else if (m.includes('🃏') || m.includes('🚫') || m.includes('🪞')) mccSfx('flip');
        else if (/[🐾🍤🔊🧶🐈🕯️😴]/u.test(m)) mccSfx('flip');
      }
    }
    logLen.current = total;
  }, [pub?.logSeq]);

  // 重连：回到页面/标签页时强制同步
  useEffect(() => {
    const onFocus = () => router.refresh();
    window.addEventListener('focus', onFocus); document.addEventListener('visibilitychange', onFocus);
    return () => { window.removeEventListener('focus', onFocus); document.removeEventListener('visibilitychange', onFocus); };
  }, [router]);

  // 房主端：响应窗口到点自动结算
  useEffect(() => {
    if (!isHost || pub?.pending?.type !== 'react') return;
    const run = () => { fetch('/api/mcc/resolve', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ roomId: props.room.id }) }).catch(() => {}); };
    const id = setInterval(run, 1500);
    return () => clearInterval(id);
  }, [isHost, pub?.pending, props.room.id]);

  // 房主端：驱动机器猫行动
  useEffect(() => {
    if (!isHost || !pub || pub.status !== 'playing') return;
    const turnAI = pub.players.find((p: any) => p.seat === pub.turn)?.isAI;
    const wardAI = pub.pending?.type === 'ward' && pub.players.find((p: any) => p.seat === pub.pending.seat)?.isAI;
    const reactBots = pub.pending?.type === 'react' && pub.players.some((p: any) => p.isAI);
    if (!turnAI && !wardAI && !reactBots) return;
    const run = () => { fetch('/api/mcc/bot', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ roomId: props.room.id }) }).catch(() => {}); };
    run(); const id = setInterval(run, 2500);
    return () => clearInterval(id);
  }, [isHost, pub?.status, pub?.turn, pub?.pending, props.room.id]);

  const inFlight = useRef(false);
  async function call(url: string, body: any, quiet?: string[]) {
    if (inFlight.current) return null; // 同步挡掉手快连点 / 并发重复提交（嘶吼被算两次的根因）
    inFlight.current = true;
    setBusy(true);
    try {
      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const d = await res.json().catch(() => ({} as any));
      if (res.status === 402 && d?.reason === 'light_pay') { setPayOpen(true); return null; }
      if (!res.ok) {
        const msg = d?.error || (en ? 'Error' : '出错了');
        if (quiet && quiet.some((q) => String(msg).includes(q))) { router.refresh(); return null; } // 迟到/竞态：静默刷新，不弹框
        alert(msg);
        return null;
      }
      router.refresh();
      if (url.endsWith('/start')) setStBump((x) => x + 1);
      return d;
    } catch (e: any) { alert((en ? 'Failed: ' : '失败：') + e.message); return null; }
    finally { inFlight.current = false; setBusy(false); }
  }
  async function start() { await call('/api/mcc/start', { roomId: props.room.id, aiFill, total: totalSeats }); }
  async function replay() {
    setResetting(true);
    try {
      const res = await fetch('/api/rooms/replay', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ roomId: props.room.id }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { alert(d.error || (en ? 'Error' : '出错了')); setResetting(false); return; }
      if (typeof window !== 'undefined') window.location.reload();
    } catch (e: any) { alert((en ? 'Failed: ' : '失败：') + e.message); setResetting(false); }
  }
  async function playCard(card: string, target?: string) {
    setPickCard(''); setSel(null); buzz(12);
    const snapshot = hand;
    setHand((h) => { const i = h.indexOf(card); if (i < 0) return h; const c = [...h]; c.splice(i, 1); return c; });
    const d = await call('/api/mcc/play', { roomId: props.room.id, card, target });
    if (!d) { setHand(snapshot); return; }
    if (d.peek) setPeek(d.peek);
  }
  async function drawCard() {
    buzz(10);
    const d = await call('/api/mcc/draw', { roomId: props.room.id });
    if (d?.drew === 'curse') { setFlashKey((k) => k + 1); mccSfx('curse'); buzz([60, 40, 120]); }
  }
  async function useWard(pos: number) { await call('/api/mcc/ward', { roomId: props.room.id, pos }); }
  async function react(kind: 'hiss' | 'mirror', newTarget?: string) { setMirrorPick(false); await call('/api/mcc/react', { roomId: props.room.id, kind, newTarget }, ['没有可响应', '繁忙', '嘶吼牌', '镜爪']); }
  function startDrag(e: React.PointerEvent, card: string, usable: boolean, idx?: number) {
    if (busy) return;
    if (!usable) { if (typeof idx === 'number') setSel(idx); return; }
    const st: any = { card, sx: e.clientX, sy: e.clientY, dragging: false };
    dragRef.current = st;
    const tryPlay = () => { if (busy) return; if (NEEDS_TARGET.includes(card)) { if (aliveOthers.length === 1) playCard(card, aliveOthers[0].seat); else setPickCard(card); } else playCard(card); };
    function cleanup() { dragRef.current = null; setDrag(null); window.removeEventListener('pointermove', move as any); window.removeEventListener('pointerup', up as any); window.removeEventListener('pointercancel', up as any); }
    const move = (ev: PointerEvent) => {
      const sc = dragRef.current; if (!sc) return;
      const dx = ev.clientX - sc.sx, dy = ev.clientY - sc.sy;
      if (!sc.dragging) {
        if (sc.sy - ev.clientY > 14 && Math.abs(dy) > Math.abs(dx)) { sc.dragging = true; setDrag({ card, x: ev.clientX, y: ev.clientY }); }
        else if (Math.abs(dx) > 12) { cleanup(); }
        return;
      }
      ev.preventDefault();
      setDrag({ card, x: ev.clientX, y: ev.clientY });
    };
    const up = (ev: PointerEvent) => {
      const sc = dragRef.current;
      if (sc) {
        const dx = ev.clientX - sc.sx, dy = ev.clientY - sc.sy;
        if (sc.dragging) { if (ev.clientY < window.innerHeight * 0.6) { buzz(15); tryPlay(); } }
        else if (Math.abs(dx) < 8 && Math.abs(dy) < 8) { if (typeof idx === 'number') setSel(idx); else tryPlay(); }
      }
      cleanup();
    };
    window.addEventListener('pointermove', move as any, { passive: false });
    window.addEventListener('pointerup', up as any);
    window.addEventListener('pointercancel', up as any);
  }

  const aliveOthers = (pub?.players || []).filter((p: any) => p.alive && p.seat !== mySeat);

  // ===== 大厅 =====
  if (!started || phase === 'lobby') {
    const count = props.initialPlayers.length;
    return (
      <main className="min-h-[100svh] flex flex-col items-center justify-center px-5 pb-10 text-center" style={{ paddingTop: 'calc(max(10px, env(safe-area-inset-top)) + 56px)' }}>
        <div className="relative w-28 h-28 mb-3">
          <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle,rgba(167,139,250,.35),transparent_65%)] animate-pulse" />
          <div className="absolute inset-3 flex items-center justify-center"><CardBack w={56} glow /></div>
        </div>
        <div className="text-[10.5px] tracking-[.45em] pl-[.45em] text-[#a78bfa]/85">{en ? 'MIDNIGHT CAT CURSE' : '午 夜 猫 诅 咒'}</div>
        <h1 className="mt-3 font-serif font-semibold text-[28px] text-[#efe6d2]">{en ? 'Don’t draw the cursed cat' : '别抽到那只猫'}</h1>
        <p className="mt-3 max-w-xs font-serif text-[14.5px] leading-[1.85] text-parchment/70">{en ? 'Play your cards, then draw one. Draw the Curse Cat and you’re out — unless you ring a Ward Bell. Last one standing wins.' : '先出牌，再抽一张。抽到诅咒猫就出局——除非你摇响护身铃。活到最后的人赢。'}</p>

        <div className="mt-6 flex items-center justify-center gap-3 flex-wrap">
          {Array.from({ length: Math.max(count, aiFill ? totalSeats : count) }).map((_, i) => {
            const p = props.initialPlayers[i];
            const nm = p ? (props.initialUsers.find((u: any) => u.id === p.user_id)?.display_name || (en ? 'Player' : '玩家')) : (en ? 'AI cat' : '机器猫');
            return (
              <div key={i} className={`flex flex-col items-center gap-1 ${p ? '' : 'opacity-45'}`}>
                <Seat hue={SEAT_HUE[i % 6]} size={46} />
                <span className="text-[11.5px] text-parchment/70 max-w-[64px] truncate">{nm}{p && p.user_id === props.userId ? (en ? ' (you)' : '（你）') : ''}</span>
              </div>
            );
          })}
        </div>

        {isHost ? (
          <div className="mt-7 w-full max-w-sm space-y-3">
            <div className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-2.5">
              <span className="text-[13px] text-parchment/70">{en ? 'Fill seats with AI cats' : '空位用机器猫补上'}</span>
              <button onClick={() => setAiFill(!aiFill)} className={`w-11 h-6 rounded-full p-0.5 transition ${aiFill ? 'bg-[#a78bfa]/70' : 'bg-white/15'}`}><span className={`block w-5 h-5 rounded-full bg-white transition ${aiFill ? 'translate-x-5' : ''}`} /></button>
            </div>
            {aiFill && (
              <div className="flex p-1 rounded-xl bg-white/[0.04] border border-white/[0.08]">
                {[2, 3, 4, 5, 6].map((n) => <button key={n} onClick={() => setTotalSeats(n)} disabled={n < count} className={`flex-1 h-9 rounded-lg text-[14px] transition disabled:opacity-25 ${totalSeats === n ? 'bg-[#a78bfa]/25 text-[#efe6d2]' : 'text-parchment/55'}`}>{n}{en ? '' : ' 人'}</button>)}
              </div>
            )}
            <button onClick={start} disabled={busy || (!aiFill && count < 2)} className="w-full py-3.5 rounded-xl bg-[#5b3fb0] hover:bg-[#6a4ac4] border border-[#a78bfa]/50 text-[#f3efff] font-serif font-semibold tracking-[.2em] text-[17px] shadow-[0_10px_40px_-10px_rgba(167,139,250,.7)] disabled:opacity-50">
              {busy ? (en ? 'Dealing…' : '发牌中…') : (!aiFill && count < 2) ? (en ? 'Need 2+ players' : '至少 2 人') : (en ? 'Deal' : '发 牌')}
            </button>
            <LightLine st={lightSt} mode="mcc" en={en} />
            <LightPaywall open={payOpen} onClose={() => setPayOpen(false)} mode="mcc" en={en} />
          </div>
        ) : <p className="mt-7 text-[13px] text-parchment/50">{en ? 'Waiting for the host to deal…' : '等房主发牌……'}</p>}

        <div className="mt-4 w-full max-w-sm flex items-center gap-2 rounded-xl border border-[#d8c7a8]/[0.13] bg-[#0b0c0f]/60 px-4 py-2.5 text-left">
          <span className="flex-1 text-[13px] text-parchment/70">{en ? 'Bring friends' : '叫朋友一起'} <span className="text-parchment/35">· 2–6</span></span>
          <button onClick={() => { navigator.clipboard.writeText(inviteUrl); setCopied(true); setTimeout(() => setCopied(false), 1500); }} className="shrink-0 text-[13px] text-[#c9a96e] border-b border-[#c9a96e]/40">{copied ? (en ? 'Copied' : '已复制') : (en ? 'Copy link' : '复制链接')}</button>
          <button onClick={() => { try { (navigator as any).share ? (navigator as any).share({ title: 'MystNight', url: inviteUrl }) : navigator.clipboard.writeText(inviteUrl); } catch {} }} className="shrink-0 ml-2 text-[13px] text-parchment/60">{en ? 'Share' : '分享'}</button>
        </div>
      </main>
    );
  }

  const turnName = pub.players.find((p: any) => p.seat === pub.turn)?.name;
  const mePub = pub.players.find((p: any) => p.seat === mySeat);
  const spectator = !mePub;
  const meDead = !!mePub && !mePub.alive;
  const others = pub.players.filter((p: any) => p.seat !== mySeat);
  const seatIdx = (seat: string) => Math.max(0, pub.players.findIndex((p: any) => p.seat === seat));
  const lastLog = (pub.log || []).slice(-1)[0]?.msg || '';
  const selCard = sel !== null ? hand[sel] : null;
  const selUsable = !!selCard && myTurn && !['ward', 'hiss', 'mirror'].includes(selCard);
  const n = hand.length;
  const vw = typeof window !== 'undefined' ? Math.min(window.innerWidth, 560) : 390;
  const cw = n <= 4 ? 108 : n <= 6 ? 98 : n <= 8 ? 86 : 76;           // 手牌越多越小
  const overlap = n <= 1 ? 0 : Math.min(cw * 0.66, Math.max(cw * 0.12, (cw * n - (vw - 28)) / (n - 1))); // 叠多少

  return (
    <main className="relative h-[100svh] flex flex-col overflow-hidden select-none">
      <div aria-hidden className="fixed inset-0 -z-[5] pointer-events-none bg-[radial-gradient(110%_70%_at_50%_42%,rgba(64,44,120,.35),rgba(10,9,14,.96)_70%)]" />
      {flashKey > 0 && <div key={flashKey} className="mcc-flash pointer-events-none fixed inset-0 z-[60] bg-red-700" />}
      <LightPaywall open={payOpen} onClose={() => setPayOpen(false)} mode="mcc" en={en} />

      {/* 拖拽中的牌 */}
      {drag && (
        <>
          <div className="pointer-events-none fixed inset-x-0 top-0 z-[57]" style={{ height: '60vh', background: 'linear-gradient(to bottom, rgba(167,139,250,.18), transparent)' }} />
          <div className="pointer-events-none fixed left-1/2 -translate-x-1/2 z-[58] text-[#d7c9ff] text-sm" style={{ top: 'calc(max(10px, env(safe-area-inset-top)) + 60px)' }}>{en ? '↑ Release to play' : '↑ 松手就打出'}</div>
          <div className="pointer-events-none fixed z-[59]" style={{ left: drag.x, top: drag.y, transform: 'translate(-50%, -78%) rotate(-4deg) scale(1.08)' }}><MccCard card={drag.card} en={en} w={110} glow /></div>
        </>
      )}

      {/* 对手 */}
      <header className="shrink-0 px-3" style={{ paddingTop: 'calc(max(10px, env(safe-area-inset-top)) + 52px)' }}>
        {(spectator || meDead) && <div className="mb-2 text-center text-[12px] text-parchment/50">{spectator ? (en ? 'Spectating' : '观战中') : (en ? 'You’re out — watching' : '你已出局 · 观战中')}</div>}
        <div className="flex justify-center gap-3 flex-wrap">
          {others.map((p: any) => {
            const on = p.seat === pub.turn && !ended;
            return (
              <div key={p.seat} className={`relative flex flex-col items-center w-[64px] transition ${p.alive ? '' : 'opacity-40 grayscale'}`}>
                <div className={`relative rounded-full ${on ? 'mcc-turn' : ''}`} style={{ boxShadow: on ? `0 0 0 2px ${SEAT_HUE[seatIdx(p.seat) % 6]}, 0 0 22px ${SEAT_HUE[seatIdx(p.seat) % 6]}aa` : 'none' }}>
                  <Seat hue={SEAT_HUE[seatIdx(p.seat) % 6]} size={50} dead={!p.alive} />
                  {p.alive && <span className="absolute -bottom-1 -right-1 min-w-[22px] h-[22px] px-1 rounded-full bg-[#15131c] border border-white/20 text-[11px] text-[#efe6d2] flex items-center justify-center tabular-nums">{p.handCount}</span>}
                  {on && pub.turnsToTake > 1 && <span className="absolute -top-1 -right-1 px-1.5 rounded-full bg-[#f06a5a] text-[10px] text-white">×{pub.turnsToTake}</span>}
                </div>
                <span className="mt-1.5 text-[11.5px] text-[#efe6d2]/80 max-w-full truncate">{p.name}{p.isAI ? (en ? ' · AI' : ' · 机') : ''}</span>
              </div>
            );
          })}
        </div>
      </header>

      {/* 桌面：牌堆 + 弃牌 */}
      <section className="flex-1 min-h-0 flex flex-col items-center justify-center gap-4 px-4">
        <div className="flex items-end justify-center gap-7">
          <button onClick={() => myTurn && !busy && drawCard()} disabled={!myTurn || busy} aria-label={en ? 'Draw' : '抽牌'} className={`relative transition-transform ${myTurn ? 'active:scale-95' : ''}`}>
            <div className="absolute left-1.5 top-1.5 opacity-50"><CardBack w={86} /></div>
            <div className="absolute left-0.5 top-0.5 opacity-75"><CardBack w={86} /></div>
            <div className={`relative ${myTurn && !busy ? 'mcc-breathe' : ''}`}><CardBack w={86} count={pub.deckCount} glow={myTurn && !busy} /></div>
            <div className={`mt-2 text-center text-[12px] ${myTurn ? 'text-[#d7c9ff]' : 'text-parchment/40'}`}>{myTurn ? (en ? 'Tap to draw' : '点我抽牌') : (en ? 'Deck' : '牌堆')}</div>
          </button>
          <button onClick={() => setShowDiscard(true)} className="relative">
            {pub.discardTop
              ? <div key={pub.discardTop + '-' + pub.discardCount} className="mcc-pop rotate-[6deg]"><MccCard card={pub.discardTop} en={en} w={86} /></div>
              : <div className="w-[86px] h-[125px] rounded-[12px] border border-dashed border-white/15" />}
            <div className="mt-2 text-center text-[12px] text-parchment/40">{en ? `Discard ${pub.discardCount}` : `弃牌 ${pub.discardCount}`}</div>
          </button>
        </div>

        {/* 状态 */}
        <div className="text-center min-h-[52px]">
          {ended ? null : myTurn ? (
            <>
              <div className="font-serif text-[19px] text-[#efe6d2]">{en ? 'Your turn' : '轮到你了'}{pub.turnsToTake > 1 ? <span className="text-[#f06a5a]"> ×{pub.turnsToTake}</span> : ''}</div>
              <div className="text-[12.5px] text-parchment/50">{en ? 'Play cards if you like, then draw one to end your turn' : '想出牌就先出，最后抽一张结束回合'}</div>
            </>
          ) : (
            <div className="text-[14px] text-parchment/60">{en ? `${turnName}’s turn…` : `${turnName} 的回合……`}</div>
          )}
          <button onClick={() => setShowLog(true)} className="mt-1.5 max-w-[86vw] truncate text-[12px] text-parchment/40 hover:text-parchment/70">{lastLog}</button>
        </div>
      </section>

      {/* 手牌 */}
      {!ended && !spectator && !meDead && (
        <footer className="shrink-0 relative" style={{ paddingBottom: 'max(10px, env(safe-area-inset-bottom))' }}>
          <div className="flex justify-center items-end px-3 pt-6 pb-1" style={{ minHeight: cw * 1.45 + 34 }}>
            {n === 0 && <span className="text-[13px] text-parchment/40 mb-10">{en ? 'No cards in hand' : '手里没有牌'}</span>}
            {hand.map((c, i) => {
              const usable = myTurn && !['ward', 'hiss', 'mirror'].includes(c);
              const mid = (n - 1) / 2;
              const rot = (i - mid) * (n > 6 ? 3 : 4.5);
              const lift = Math.abs(i - mid) * Math.abs(i - mid) * 1.6;
              return (
                <button key={i + c} onPointerDown={(e) => startDrag(e, c, usable, i)} style={{ marginLeft: i === 0 ? 0 : -overlap, touchAction: 'none', zIndex: i, transform: `translateY(${lift}px) rotate(${rot}deg)`, transformOrigin: 'bottom center' }}
                  className={`mcc-deal relative shrink-0 transition-transform duration-150 active:-translate-y-3 ${drag?.card === c ? 'opacity-30' : ''}`}>
                  <div className={usable ? '' : 'brightness-[.55] saturate-50'}><MccCard card={c} en={en} w={cw} /></div>
                </button>
              );
            })}
          </div>
          <div className="text-center text-[11px] text-parchment/35">{myTurn ? (en ? 'Tap a card to look · drag up to play' : '点一张看看 · 往上拖直接打出') : (en ? 'Tap a card to read it' : '点牌看说明')}</div>
        </footer>
      )}

      {/* 选中的牌：放大 + 出牌按钮 */}
      {selCard && (
        <div className="fixed inset-0 z-[66] flex flex-col items-center justify-center px-6 bg-black/70 backdrop-blur-[3px] mn-fadein" onClick={() => setSel(null)}>
          <div onClick={(e) => e.stopPropagation()} className="flex flex-col items-center">
            <div className="mcc-pop"><MccCard card={selCard} en={en} w={190} glow /></div>
            {selUsable ? (
              <button onClick={() => { const c = selCard; setSel(null); if (NEEDS_TARGET.includes(c)) { if (aliveOthers.length === 1) playCard(c, aliveOthers[0].seat); else setPickCard(c); } else playCard(c); }} disabled={busy}
                className="mt-5 w-56 h-12 rounded-2xl text-[16px] font-serif tracking-[.2em] text-white disabled:opacity-50" style={{ background: cardColor(selCard), boxShadow: `0 10px 30px -8px ${cardColor(selCard)}` }}>
                {NEEDS_TARGET.includes(selCard) && aliveOthers.length > 1 ? (en ? 'Choose a target' : '选个目标') : (en ? 'Play it' : '打 出')}
              </button>
            ) : (
              <div className="mt-5 text-[12.5px] text-parchment/45">{['ward'].includes(selCard) ? (en ? 'Used automatically when you draw the Curse Cat' : '抽到诅咒猫时用') : ['hiss', 'mirror'].includes(selCard) ? (en ? 'Used when someone else plays a card' : '别人出牌时，在响应窗口里用') : (en ? 'Wait for your turn' : '轮到你时才能出')}</div>
            )}
            <button onClick={() => setSel(null)} className="mt-3 h-10 px-6 text-[13px] text-parchment/50">{en ? 'Back' : '收回'}</button>
          </div>
        </div>
      )}

      {/* 选目标 */}
      {pickCard && (
        <div className="fixed inset-0 z-[70] bg-black/75 backdrop-blur-sm flex items-end sm:items-center justify-center" onClick={() => setPickCard('')}>
          <div onClick={(e) => e.stopPropagation()} className="mn-sheet w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl border border-white/10 bg-[#121118] px-5 pt-5" style={{ paddingBottom: 'max(20px, env(safe-area-inset-bottom))' }}>
            <div className="text-center font-serif text-[18px] text-[#efe6d2]">{en ? 'Who gets it?' : '对谁用？'}</div>
            <div className="text-center text-[12.5px] mt-1" style={{ color: cardColor(pickCard) }}>{cardName(pickCard, en)} · <span className="text-parchment/50">{cardDesc(pickCard, en)}</span></div>
            <div className="mt-5 grid grid-cols-3 gap-3">
              {aliveOthers.map((p: any) => (
                <button key={p.seat} onClick={() => playCard(pickCard, p.seat)} disabled={busy} className="flex flex-col items-center gap-1.5 py-3 rounded-2xl border border-white/10 bg-white/[0.03] active:bg-white/10 disabled:opacity-50">
                  <Seat hue={SEAT_HUE[seatIdx(p.seat) % 6]} size={48} />
                  <span className="text-[13px] text-[#efe6d2] truncate max-w-full px-1">{p.name}</span>
                  <span className="text-[11px] text-parchment/40">{en ? `${p.handCount} cards` : `${p.handCount} 张牌`}</span>
                </button>
              ))}
            </div>
            <button onClick={() => setPickCard('')} className="mt-4 w-full h-11 text-[13px] text-parchment/50">{en ? 'Cancel' : '算了'}</button>
          </div>
        </div>
      )}

      {/* 抽到诅咒猫：护身铃 */}
      {wardMe && (
        <div className="fixed inset-0 z-[75] flex flex-col items-center justify-center px-6 bg-[radial-gradient(circle_at_50%_40%,rgba(120,10,16,.75),rgba(8,4,6,.95)_70%)]">
          <div className="text-[11px] tracking-[.4em] text-[#ff8a8a]">{en ? 'YOU DREW IT' : '你 抽 到 了'}</div>
          <div className="mt-3 mcc-shake"><MccCard card="curse" en={en} w={170} glow /></div>
          <div className="mt-5 font-serif text-[18px] text-[#fbeee0]">{en ? 'Ring the Ward Bell — where do you hide it?' : '摇响护身铃——把它藏回哪里？'}</div>
          <div className="mt-4 grid grid-cols-3 gap-2.5 w-full max-w-xs">
            {[[pub.deckCount, en ? 'Top' : '最上面', en ? 'next draw' : '下一个人就抽到'], [-1, en ? 'Random' : '随便塞', en ? 'nobody knows' : '谁也不知道'], [0, en ? 'Bottom' : '最底下', en ? 'safe for now' : '暂时安全']].map(([pos, l, sub]) => (
              <button key={String(l)} onClick={() => useWard(pos === -1 ? Math.floor(Math.random() * (pub.deckCount + 1)) : (pos as number))} disabled={busy} className="rounded-2xl border border-[#5fd1c1]/40 bg-[#5fd1c1]/10 py-3 active:bg-[#5fd1c1]/25 disabled:opacity-50">
                <div className="text-[15px] text-[#dffaf5]">{l}</div><div className="text-[10.5px] text-[#dffaf5]/50 mt-0.5">{sub}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 响应窗口：嘶吼 / 镜爪 */}
      {pub?.pending?.type === 'react' && (() => {
        const pend = pub.pending; const byName = pub.players.find((p: any) => p.seat === pend.by)?.name; const tgtName = pend.target ? pub.players.find((p: any) => p.seat === pend.target)?.name : null;
        const myAlive = pub.players.find((p: any) => p.seat === mySeat)?.alive !== false;
        const canHiss = myAlive && hand.includes('hiss');
        const canMirror = myAlive && ['swap', 'hex', 'thief'].includes(pend.card) && pend.target === mySeat && hand.includes('mirror');
        const oth = pub.players.filter((p: any) => p.alive && p.seat !== mySeat);
        const canceled = pend.hiss % 2 === 1;
        return (
          <div className="fixed inset-x-0 bottom-0 z-[64] px-3" style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}>
            <div className="mn-sheet mx-auto max-w-md rounded-3xl border border-white/12 bg-[#141219]/95 backdrop-blur px-4 pt-4 pb-3 shadow-[0_-10px_40px_rgba(0,0,0,.6)]">
              <div className="flex items-center gap-3">
                <div className="shrink-0"><MccCard card={pend.card} en={en} w={60} /></div>
                <div className="min-w-0 flex-1">
                  <div className="text-[14px] text-[#efe6d2]">{byName} {en ? 'played' : '打出了'} <span style={{ color: cardColor(pend.card) }}>{cardName(pend.card, en)}</span>{tgtName ? <span className="text-parchment/60">{' → '}{pend.target === mySeat ? (en ? 'you' : '你') : tgtName}</span> : ''}</div>
                  <div className={`mt-1 text-[12.5px] ${canceled ? 'text-[#f06a5a]' : 'text-parchment/50'}`}>{canceled ? (en ? 'Currently CANCELED' : '现在：被取消了') : (en ? 'Currently going through' : '现在：将会生效')}</div>
                  <div className="mt-2 h-1 rounded-full bg-white/10 overflow-hidden"><div className="h-full bg-[#a78bfa] mcc-timer" /></div>
                </div>
              </div>
              {(canHiss || canMirror) && !mirrorPick && (
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {canHiss && <button onClick={() => { buzz(20); react('hiss'); }} disabled={busy} className="h-12 rounded-2xl bg-[#5fd1c1]/20 border border-[#5fd1c1]/50 text-[15px] text-[#dffaf5] disabled:opacity-50">{canceled ? (en ? 'Hiss back!' : '嘶吼·反取消') : (en ? 'Hiss! (cancel)' : '嘶吼·取消它')}</button>}
                  {canMirror && <button onClick={() => { if (oth.length === 1) react('mirror', oth[0].seat); else setMirrorPick(true); }} disabled={busy} className="h-12 rounded-2xl bg-[#5fd1c1]/20 border border-[#5fd1c1]/50 text-[15px] text-[#dffaf5] disabled:opacity-50">{en ? 'Mirror it' : '镜爪·转给别人'}</button>}
                </div>
              )}
              {mirrorPick && (
                <div className="mt-3 flex gap-2 flex-wrap justify-center">
                  {oth.map((p: any) => <button key={p.seat} onClick={() => react('mirror', p.seat)} disabled={busy} className="h-10 px-4 rounded-full border border-[#5fd1c1]/50 text-[13.5px] text-[#dffaf5]">{p.name}</button>)}
                  <button onClick={() => setMirrorPick(false)} className="h-10 px-4 text-[13px] text-parchment/50">{en ? 'cancel' : '算了'}</button>
                </div>
              )}
              {!canHiss && !canMirror && <div className="mt-2 text-center text-[11.5px] text-parchment/40">{en ? 'Others may respond…' : '等别人决定要不要响应……'}</div>}
            </div>
          </div>
        );
      })()}

      {/* 烛光窥视 */}
      {peek && (
        <div className="fixed inset-0 z-[68] flex flex-col items-center justify-center px-4 bg-black/80 backdrop-blur-[3px] mn-fadein" onClick={() => setPeek(null)}>
          <div className="text-[11px] tracking-[.35em] text-[#e7b85a]">{en ? 'TOP OF THE DECK' : '牌 堆 最 上 面'}</div>
          <div className="mt-4 flex items-end gap-3">
            {peek.map((c, i) => (
              <div key={i} className="flex flex-col items-center gap-2 mcc-deal" style={{ animationDelay: `${i * 0.12}s` }}>
                <MccCard card={c} en={en} w={i === 0 ? 112 : 96} glow={c === 'curse'} />
                <span className="text-[12px] text-parchment/55">{i === 0 ? (en ? 'next' : '下一张') : en ? `#${i + 1}` : `第 ${i + 1} 张`}</span>
              </div>
            ))}
          </div>
          <button onClick={() => setPeek(null)} className="mt-6 h-11 px-8 rounded-full border border-white/15 text-[14px] text-parchment/75">{en ? 'Got it' : '记住了'}</button>
        </div>
      )}

      {/* 结束 */}
      {ended && (
        <div className="fixed inset-0 z-[74] flex flex-col items-center justify-center px-6 bg-[radial-gradient(circle_at_50%_40%,rgba(90,63,176,.55),rgba(8,7,12,.95)_70%)] mn-fadein">
          <div className="text-[11px] tracking-[.4em] text-[#d7c9ff]">{en ? 'DAWN BREAKS' : '天 亮 了'}</div>
          <div className="mt-4"><Seat hue={SEAT_HUE[seatIdx(pub.winner) % 6]} size={92} /></div>
          <div className="mt-4 font-serif text-[24px] text-[#f3efff]">{pub.winner === mySeat ? (en ? 'You survived the night' : '你活过了这一夜') : en ? `${pub.players.find((p: any) => p.seat === pub.winner)?.name || '—'} survived` : `${pub.players.find((p: any) => p.seat === pub.winner)?.name || '—'} 活到了最后`}</div>
          <div className="mt-6 flex gap-2.5 w-full max-w-xs">
            <a href="/play" className="flex-1 h-12 rounded-2xl border border-white/15 text-[14px] text-parchment/75 flex items-center justify-center">{en ? 'Hall' : '回大厅'}</a>
            {isHost && <button onClick={replay} disabled={resetting} className="flex-1 h-12 rounded-2xl bg-[#5b3fb0] border border-[#a78bfa]/50 text-[15px] text-white disabled:opacity-50">{resetting ? '…' : (en ? 'Again' : '再来一局')}</button>}
          </div>
          <button onClick={() => setShowLog(true)} className="mt-4 text-[12.5px] text-parchment/45 underline underline-offset-4">{en ? 'How it went' : '看看这局怎么打的'}</button>
        </div>
      )}

      {/* 记录 */}
      {showLog && (
        <div className="fixed inset-0 z-[80]" onClick={() => setShowLog(false)}>
          <div className="absolute inset-0 bg-black/60 mn-fadein" />
          <div onClick={(e) => e.stopPropagation()} ref={logRef} className="mn-sheet absolute inset-x-0 bottom-0 max-h-[70svh] overflow-y-auto rounded-t-3xl bg-[#121118] border-t border-white/10 px-5 pt-4" style={{ paddingBottom: 'max(20px, env(safe-area-inset-bottom))' }}>
            <div className="font-serif text-[17px] text-[#efe6d2] mb-3">{en ? 'What happened' : '发生了什么'}</div>
            <div className="space-y-2">{(pub.log || []).map((l: any, i: number) => <div key={i} className="text-[13.5px] text-parchment/75 leading-snug">{l.msg}</div>)}</div>
          </div>
        </div>
      )}

      {/* 弃牌堆 */}
      {showDiscard && (() => {
        const counts: Record<string, number> = {}; (pub.discard || []).forEach((c: string) => { counts[c] = (counts[c] || 0) + 1; });
        return (
          <div className="fixed inset-0 z-[80]" onClick={() => setShowDiscard(false)}>
            <div className="absolute inset-0 bg-black/60 mn-fadein" />
            <div onClick={(e) => e.stopPropagation()} className="mn-sheet absolute inset-x-0 bottom-0 max-h-[75svh] overflow-y-auto rounded-t-3xl bg-[#121118] border-t border-white/10 px-5 pt-4" style={{ paddingBottom: 'max(20px, env(safe-area-inset-bottom))' }}>
              <div className="font-serif text-[17px] text-[#efe6d2]">{en ? `Discard pile · ${pub.discardCount}` : `弃牌堆 · ${pub.discardCount} 张`}</div>
              {(pub.feed || []).length > 0 && (
                <>
                  <div className="mt-4 mb-2 text-[11px] tracking-[.25em] text-parchment/40">{en ? 'RECENT · NEWEST FIRST' : '最近出的牌 · 新的在前'}</div>
                  <div className="flex gap-2.5 overflow-x-auto pb-1">
                    {[...pub.feed].reverse().map((it: any, i: number) => (
                      <div key={i} className="shrink-0 text-center">
                        <MccCard card={it.c} en={en} w={70} />
                        <div className="mt-1 text-[10.5px] text-parchment/50 truncate" style={{ maxWidth: 70 }}>{pub.players.find((p: any) => p.seat === it.by)?.name || it.by}</div>
                      </div>
                    ))}
                  </div>
                </>
              )}
              <div className="mt-4 mb-2 text-[11px] tracking-[.25em] text-parchment/40">{en ? 'ALL' : '全部'}</div>
              {pub.discardCount === 0 ? <div className="text-[13px] text-parchment/40">{en ? 'Empty' : '还是空的'}</div> : (
                <div className="flex gap-2.5 flex-wrap">
                  {Object.entries(counts).map(([c, num]) => (
                    <div key={c} className="relative">
                      <MccCard card={c} en={en} w={76} />
                      {num > 1 && <span className="absolute -top-1.5 -right-1.5 min-w-[22px] h-[22px] px-1 rounded-full bg-[#5b3fb0] text-[11px] text-white flex items-center justify-center">×{num}</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })()}
    </main>
  );
}

// 座位上的猫：每个座位一种颜色
function Seat({ hue, size = 48, dead }: { hue: string; size?: number; dead?: boolean }) {
  return (
    <svg viewBox="0 0 48 48" style={{ width: size, height: size }}>
      <defs><radialGradient id={`g${hue.slice(1)}`} cx="50%" cy="40%" r="60%"><stop offset="0%" stopColor={hue} stopOpacity=".35" /><stop offset="100%" stopColor="#0c0b12" /></radialGradient></defs>
      <circle cx="24" cy="24" r="23" fill={`url(#g${hue.slice(1)})`} stroke={hue} strokeOpacity=".6" />
      <g fill="none" stroke="#f3efe6" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 18 L11 9 L20 15.5" /><path d="M34 18 L37 9 L28 15.5" />
        <path d="M12 21.5 q12 -7 24 0 q2 12 -12 16 q-14 -4 -12 -16 Z" />
        <path d="M6 26 H15 M33 26 H42" strokeWidth="1" opacity=".5" />
      </g>
      {dead
        ? <g stroke="#f3efe6" strokeWidth="1.6" strokeLinecap="round"><path d="M17 23 l4 4 M21 23 l-4 4 M27 23 l4 4 M31 23 l-4 4" /></g>
        : <g fill={hue}><ellipse cx="19" cy="25" rx="1.9" ry="2.6" /><ellipse cx="29" cy="25" rx="1.9" ry="2.6" /></g>}
      <path d="M22 30.5 l2 1.5 l2 -1.5" fill="none" stroke="#f3efe6" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}
