'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { ShellProps } from './RoomShell';
import MccCard from './MccCard';
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
function cn(k: string, en: boolean) { const m = META[k]; return m ? `${m.e} ${en ? m.en : m.zh}` : k; }

export default function MccRoom(props: ShellProps) {
  const router = useRouter();
  const supabase = useRef(createClient()).current;
  const en = props.room.language === 'en';
  const pub: any = props.mccPublic;
  const hand: string[] = props.mccHand || [];
  const [busy, setBusy] = useState(false);
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
  const dragRef = useRef<any>(null);
  const touchStartY = useRef(0);
  const armedRef = useRef(false);
  const [aiFill, setAiFill] = useState(true);
  const [totalSeats, setTotalSeats] = useState(4);
  const logRef = useRef<HTMLDivElement>(null);
  const logLen = useRef<number>(props.mccPublic?.log?.length || 0);

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

  useEffect(() => { logRef.current?.scrollTo({ top: logRef.current.scrollHeight }); }, [pub?.log?.length]);

  // 音效：扫描新日志触发
  useEffect(() => {
    const logs = pub?.log || [];
    if (logs.length > logLen.current) {
      for (const l of logs.slice(logLen.current)) {
        const m = l.msg || '';
        if (m.includes('💀')) { mccSfx('eliminate'); setFlashKey((k) => k + 1); }
        else if (m.includes('🏆')) mccSfx('win');
        else if (m.includes('🔔')) { mccSfx('ward'); setFlashKey((k) => k + 1); }
        else if (m.includes('🎴')) mccSfx('draw');
        else if (m.includes('🃏') || m.includes('🙀') || m.includes('🚫') || m.includes('🪞')) mccSfx('flip');
        else if (/[🌀🐾🍤🔊🧶🐈🕯️😴]/u.test(m)) mccSfx('flip');
      }
    }
    logLen.current = logs.length;
  }, [pub?.log?.length]);

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

  async function call(url: string, body: any) {
    setBusy(true);
    try {
      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const d = await res.json();
      if (!res.ok) { alert(d.error || (en ? 'Error' : '出错了')); return null; }
      router.refresh();
      return d;
    } catch (e: any) { alert((en ? 'Failed: ' : '失败：') + e.message); return null; }
    finally { setBusy(false); }
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
    setPickCard('');
    const d = await call('/api/mcc/play', { roomId: props.room.id, card, target });
    if (d?.peek) setPeek(d.peek);
  }
  async function drawCard() {
    const d = await call('/api/mcc/draw', { roomId: props.room.id });
    if (d?.drew === 'curse') { setFlashKey((k) => k + 1); mccSfx('curse'); }
  }
  async function useWard(pos: number) { await call('/api/mcc/ward', { roomId: props.room.id, pos }); }
  async function react(kind: 'hiss' | 'mirror', newTarget?: string) { setMirrorPick(false); await call('/api/mcc/react', { roomId: props.room.id, kind, newTarget }); }
  function startDrag(e: React.PointerEvent, card: string, usable: boolean) {
    if (!usable || busy) return;
    const st: any = { card, sx: e.clientX, sy: e.clientY, dragging: false };
    dragRef.current = st;
    const tryPlay = () => { if (busy) return; if (NEEDS_TARGET.includes(card)) setPickCard(card); else playCard(card); };
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
        if (sc.dragging) { if (ev.clientY < window.innerHeight * 0.6) tryPlay(); }
        else if (Math.abs(dx) < 8 && Math.abs(dy) < 8) tryPlay();
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
    return (
      <main className="min-h-[100svh] flex flex-col items-center justify-center gap-6 px-6 text-center">
        <h1 className="text-2xl font-serif text-parchment">{en ? 'Midnight Cat Curse' : '午夜猫诅咒'} · {props.room.name}</h1>
        <p className="text-parchment/60 max-w-md">{en ? 'A cursed-cat party card game. On your turn, play action cards, then draw. Draw a Curse Cat and you’re out — unless you ring a Ward Bell. Last cat standing wins. 2–6 players.' : '诅咒猫派对牌局。轮到你时先出行动牌，再抽一张；抽到诅咒猫就出局——除非你摇响护身铃。活到最后者获胜。2～6 人。'}</p>
        <div className="flex gap-2 flex-wrap justify-center">
          {props.initialPlayers.map((p: any) => {
            const nm = props.initialUsers.find((u: any) => u.id === p.user_id)?.display_name || (en ? 'Player' : '玩家');
            const mine = p.user_id === props.userId;
            return <span key={p.id} className={`text-xs px-2.5 py-1 rounded-full border ${mine ? 'bg-blood/25 border-blood/50 text-parchment' : 'bg-fog border-eldritch/30 text-parchment/80'}`}>● {nm} [{p.seat}]{mine ? (en ? ' · you' : ' · 你') : ''}</span>;
          })}
        </div>
        <div className="flex flex-col items-center gap-3 w-full max-w-md">
          <span className="text-sm text-parchment/50">{en ? 'Invite players (2–6):' : '把链接发给玩家（2～6 人）：'}</span>
          <code className="text-xs px-3 py-2 rounded bg-fog border border-eldritch/30 text-eldritch break-all w-full">{inviteUrl}</code>
          <button onClick={() => { navigator.clipboard.writeText(inviteUrl); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
            className="px-4 py-1.5 rounded bg-eldritch/40 hover:bg-eldritch text-parchment text-sm">{copied ? (en ? 'Copied' : '已复制') : (en ? 'Copy invite link' : '复制邀请链接')}</button>
        </div>
        {isHost ? (
          <>
            <div className="flex flex-col items-center gap-2">
              <label className="flex items-center gap-2 text-sm text-parchment/80 cursor-pointer">
                <input type="checkbox" checked={aiFill} onChange={(e) => setAiFill(e.target.checked)} />
                {en ? 'Fill empty seats with AI cats 🤖' : '用机器猫🤖补满空位'}
              </label>
              {aiFill && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-parchment/50">{en ? 'Total players:' : '总人数：'}</span>
                  {[2, 3, 4, 5, 6].map((n) => (
                    <button key={n} onClick={() => setTotalSeats(n)} disabled={n < props.initialPlayers.length}
                      className={`px-2.5 py-1 rounded border text-sm ${totalSeats === n ? 'bg-eldritch/60 border-eldritch text-parchment' : 'bg-fog border-eldritch/30 text-parchment/60'} disabled:opacity-30`}>{n}</button>
                  ))}
                </div>
              )}
            </div>
            <button onClick={start} disabled={busy || (!aiFill && props.initialPlayers.length < 2)}
              className="px-6 py-3 rounded bg-blood/80 hover:bg-blood text-parchment border border-blood disabled:opacity-50">
              {busy ? (en ? 'Dealing…' : '发牌中…') : (!aiFill && props.initialPlayers.length < 2) ? (en ? 'Need 2+ players' : '至少 2 人') : (en ? 'Deal & start →' : '发牌开始 →')}
            </button>
          </>
        ) : <span className="text-sm text-parchment/50">{en ? 'Waiting for the host to start…' : '等待房主开始……'}</span>}
      </main>
    );
  }

  const turnName = pub.players.find((p: any) => p.seat === pub.turn)?.name;
  const mePub = pub.players.find((p: any) => p.seat === mySeat);
  const spectator = !mePub;
  const meDead = !!mePub && !mePub.alive;

  return (
    <main className="h-[100svh] flex flex-col overflow-hidden">
      {flashKey > 0 && <div key={flashKey} className="mcc-flash pointer-events-none fixed inset-0 z-[60] bg-red-700" />}
      {drag && (
        <>
          <div className="pointer-events-none fixed inset-x-0 top-0 z-[57]" style={{ height: '60vh', background: 'linear-gradient(to bottom, rgba(178,58,72,0.16), transparent)' }} />
          <div className="pointer-events-none fixed left-1/2 -translate-x-1/2 z-[58] text-blood text-sm font-medium" style={{ top: 14 }}>↑ {NEEDS_TARGET.includes(drag.card) ? (en ? 'Drag up to pick a target' : '拖到上方 · 选择目标') : (en ? 'Drag up to play' : '拖到上方 · 出牌')}</div>
          <div className="pointer-events-none fixed z-[59]" style={{ left: drag.x, top: drag.y, transform: 'translate(-50%, -78%) scale(1.05)' }}><MccCard card={drag.card} en={en} w={108} /></div>
        </>
      )}
      {armed && <div className="pointer-events-none fixed left-1/2 -translate-x-1/2 z-[55] text-blood text-sm font-medium" style={{ bottom: 300 }}>↑ {en ? 'Release to play' : '松手打出'}</div>}
      {pickCard && (
        <div className="fixed inset-0 z-[70] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setPickCard('')}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-2xl border border-white/20 bg-[#0a0a0c] p-5 shadow-2xl">
            <div className="text-center text-parchment text-base font-serif tracking-wide mb-1">{en ? 'Choose a target' : '选择目标'}</div>
            <div className="text-center text-xs text-parchment/50 mb-4">「{cn(pickCard, en)}」· {en ? META[pickCard]?.d_en : META[pickCard]?.d_zh}</div>
            <div className="grid grid-cols-3 gap-3">
              {aliveOthers.map((p: any) => (
                <button key={p.seat} onClick={() => playCard(pickCard, p.seat)} disabled={busy}
                  className="flex flex-col items-center gap-1.5 p-2 rounded-xl border border-white/15 hover:border-blood hover:bg-blood/15 active:bg-blood/25 transition disabled:opacity-50">
                  <CatHead />
                  <span className="text-sm text-parchment truncate max-w-full">{p.name}{p.isAI ? ' 🤖' : ''}</span>
                  <span className="text-[10px] text-parchment/40">{en ? 'seat' : '座位'} {p.seat}</span>
                </button>
              ))}
            </div>
            <button onClick={() => setPickCard('')} className="mt-4 w-full py-2 rounded-lg bg-fog border border-parchment/25 text-parchment/70 text-sm">{en ? 'Cancel' : '取消'}</button>
          </div>
        </div>
      )}
      {(spectator || meDead) && <div className="px-4 py-1.5 text-center text-xs bg-ink/70 text-parchment/55 border-b border-eldritch/15">{spectator ? (en ? '👁 Spectating (no seat this game)' : '👁 观战中（你不在本局座位）') : (en ? '💀 You are out — spectating' : '💀 你已出局 · 观战中')}</div>}
      <header className="px-4 py-3 border-b border-eldritch/20 flex items-center justify-between gap-2">
        <span className="font-serif text-parchment text-sm truncate"><span className="inline-block w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse mr-1.5 align-middle" />{en ? 'Midnight Cat Curse' : '午夜猫诅咒'}</span>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={() => setShowDiscard((v) => !v)} className="text-xs px-2 py-1 rounded bg-eldritch/30 text-parchment">{en ? `Discard ${pub.discardCount}` : `弃牌 ${pub.discardCount}`}</button>
          <span className="text-xs text-parchment/55">{ended ? (en ? 'Game over' : '对局结束') : (en ? `Deck ${pub.deckCount} · ${myTurn ? 'YOUR TURN' : turnName + '’s turn'}` : `牌堆 ${pub.deckCount} · ${myTurn ? '轮到你' : turnName + ' 的回合'}`)}{pub.turnsToTake > 1 ? ` (×${pub.turnsToTake})` : ''}</span>
        </div>
      </header>

      {/* 玩家桌 */}
      {showDiscard && (() => {
        const counts: Record<string, number> = {}; (pub.discard || []).forEach((c: string) => { counts[c] = (counts[c] || 0) + 1; });
        return (
          <div className="px-4 py-3 bg-ink/85 border-b border-eldritch/20 max-w-5xl w-full mx-auto">
            <div className="text-xs text-parchment/50 mb-2">{en ? `Discard pile (${pub.discardCount})` : `弃牌堆（共 ${pub.discardCount} 张）`}</div>
            {(pub.feed || []).length > 0 && (
              <div className="mb-3">
                <div className="text-[11px] text-parchment/45 mb-1.5">{en ? 'Recent plays (newest first)' : '出牌顺序（最新在前）'}</div>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {[...pub.feed].reverse().map((it: any, i: number) => (
                    <div key={i} className="shrink-0 text-center">
                      <div className="text-[9px] text-parchment/50 mb-0.5 truncate" style={{ maxWidth: 66 }}>{pub.players.find((p: any) => p.seat === it.by)?.name || it.by}</div>
                      <MccCard card={it.c} en={en} w={66} />
                    </div>
                  ))}
                </div>
              </div>
            )}
            {pub.discardCount === 0 ? <div className="text-sm text-parchment/40">{en ? '(empty)' : '（空）'}</div> : (
              <div className="flex gap-2 flex-wrap max-h-[40vh] overflow-y-auto">
                {Object.entries(counts).map(([c, num]) => (
                  <div key={c} className="relative">
                    <MccCard card={c} en={en} w={76} />
                    {num > 1 && <span className="absolute -top-1 -right-1 text-[10px] px-1.5 py-0.5 rounded-full bg-blood text-parchment border border-blood/60">×{num}</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })()}

      <div className="px-4 py-2 border-b border-eldritch/15 flex gap-1.5 flex-wrap">
        {pub.players.map((p: any) => (
          <span key={p.seat} className={`text-xs px-2 py-1 rounded-full border ${p.seat === pub.turn && !ended ? 'bg-eldritch/40 border-eldritch text-parchment' : p.alive ? 'bg-fog border-eldritch/30 text-parchment/80' : 'bg-ink border-parchment/15 text-parchment/30 line-through'}`}>
            {p.seat === pub.turn && !ended ? '▶ ' : ''}{p.name}{p.isAI ? ' 🤖' : ''}{p.seat === mySeat ? (en ? ' (you)' : '（你）') : ''} · {en ? `${p.handCount} cards` : `${p.handCount}张`}{!p.alive ? ' 💀' : ''}
          </span>
        ))}
      </div>

      {/* 牌堆 / 弃牌 */}
      <div className="px-4 py-2 flex items-center justify-center gap-6 border-b border-eldritch/10">
        <div className="text-center"><div className="w-12 h-[68px] rounded-lg bg-black border border-white/25 flex items-center justify-center"><div className="w-6 h-9 rounded border border-white/20" /></div><div className="text-xs text-parchment/50 mt-1">{en ? 'Deck' : '牌堆'} {pub.deckCount}</div></div>
        <div className="text-center">{pub.discardTop ? <div key={pub.discardTop + '-' + pub.discardCount} className="mcc-pop"><MccCard card={pub.discardTop} en={en} w={64} /></div> : <div className="w-14 h-20 rounded-lg bg-fog border border-eldritch/30 flex items-center justify-center text-2xl text-parchment/30">—</div>}<div className="text-xs text-parchment/50 mt-1">{en ? 'Discard' : '弃牌'} {pub.discardCount}</div></div>
      </div>

      {/* 日志 */}
      <div ref={logRef} className="flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-1 max-w-2xl w-full mx-auto">
        {(pub.log || []).map((l: any, i: number) => <div key={i} className="text-sm text-parchment/70 leading-snug">{l.msg}</div>)}
      </div>

      {/* 烛光窥视结果 */}
      {peek && (
        <div className="px-4 py-3 border-t border-amber-700/40 bg-amber-950/30 max-w-2xl w-full mx-auto">
          <div className="text-xs text-amber-300/80 mb-1.5">🕯️ {en ? 'Top of deck (top → down):' : '牌堆顶（从上到下）：'}</div>
          <div className="flex gap-3">{peek.map((c, i) => <MccCard key={i} card={c} en={en} w={104} />)}</div>
          <button onClick={() => setPeek(null)} className="mt-2 text-xs text-parchment/50 underline">{en ? 'close' : '收起'}</button>
        </div>
      )}

      {/* 护身铃：把诅咒猫塞回牌堆 */}
      {wardMe && (
        <div className="px-4 py-3 border-t border-blood/50 bg-blood/15 max-w-2xl w-full mx-auto text-center">
          <div className="text-sm text-parchment mb-2">🔔 {en ? 'You drew the Curse Cat! Ring the Ward Bell and hide it back in the deck:' : '你抽到了诅咒猫！摇响护身铃，把它塞回牌堆：'}</div>
          <div className="flex gap-2 justify-center flex-wrap">
            <button onClick={() => useWard(pub.deckCount)} disabled={busy} className="px-3 py-1.5 rounded bg-eldritch/60 text-parchment text-sm">{en ? 'Top' : '塞到顶部'}</button>
            <button onClick={() => useWard(Math.floor(Math.random() * (pub.deckCount + 1)))} disabled={busy} className="px-3 py-1.5 rounded bg-eldritch/60 text-parchment text-sm">{en ? 'Random' : '随机位置'}</button>
            <button onClick={() => useWard(0)} disabled={busy} className="px-3 py-1.5 rounded bg-eldritch/60 text-parchment text-sm">{en ? 'Bottom' : '塞到底部'}</button>
          </div>
        </div>
      )}

      {/* 响应窗口：嘶吼 / 镜爪 */}
      {pub?.pending?.type === 'react' && (() => {
        const pend = pub.pending; const byName = pub.players.find((p: any) => p.seat === pend.by)?.name; const tgtName = pend.target ? pub.players.find((p: any) => p.seat === pend.target)?.name : null;
        const myAlive = pub.players.find((p: any) => p.seat === mySeat)?.alive !== false;
        const canMirror = ['swap', 'hex', 'thief'].includes(pend.card) && pend.target === mySeat && hand.includes('mirror');
        const others = pub.players.filter((p: any) => p.alive && p.seat !== mySeat && p.seat !== pend.by);
        return (
          <div className="px-4 py-2 border-t border-amber-700/40 bg-amber-950/25 max-w-2xl w-full mx-auto text-center space-y-1">
            <div className="text-sm text-amber-200/90">🃏 {byName} {en ? 'played' : '打出'}「{cn(pend.card, en)}」{tgtName ? (en ? ` \u2192 ${tgtName}` : `（指向 ${tgtName}）`) : ''} · {pend.hiss % 2 === 1 ? (en ? 'will be CANCELED' : '当前将被取消') : (en ? 'will resolve' : '当前将生效')}</div>
            {myAlive && (
              <div className="flex gap-2 justify-center flex-wrap">
                {hand.includes('hiss') && <button onClick={() => react('hiss')} disabled={busy} className="px-3 py-1.5 rounded bg-blood/50 hover:bg-blood/70 border border-blood/50 text-parchment text-sm">🙀 {pend.hiss % 2 === 1 ? (en ? 'Hiss (un-cancel)' : '嘶吼（反取消）') : (en ? 'Hiss (cancel)' : '嘶吼（取消）')}</button>}
                {canMirror && !mirrorPick && <button onClick={() => setMirrorPick(true)} disabled={busy} className="px-3 py-1.5 rounded bg-eldritch/50 hover:bg-eldritch/70 border border-eldritch/50 text-parchment text-sm">🪞 {en ? 'Mirror Paw' : '镜爪转移'}</button>}
              </div>
            )}
            {mirrorPick && (
              <div className="flex gap-2 justify-center flex-wrap">
                <span className="text-xs text-parchment/60 self-center">{en ? 'redirect to:' : '转给：'}</span>
                {others.map((p: any) => <button key={p.seat} onClick={() => react('mirror', p.seat)} disabled={busy} className="px-2.5 py-1 rounded bg-eldritch/40 border border-eldritch/50 text-parchment text-sm">{p.name}</button>)}
                <button onClick={() => setMirrorPick(false)} className="px-2.5 py-1 rounded bg-fog border border-parchment/30 text-parchment/60 text-sm">{en ? 'cancel' : '取消'}</button>
              </div>
            )}
            <div className="text-[11px] text-parchment/40">{en ? 'Resolves automatically when the window closes…' : '窗口结束后自动结算……'}</div>
          </div>
        );
      })()}

      {/* 我的手牌 + 操作 */}
      {!ended ? (
        <div className="border-t border-eldritch/20 px-4 py-3 space-y-2 max-w-5xl w-full mx-auto" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
          {(spectator || meDead) ? (
              <div className="text-center text-sm text-parchment/55 py-3">{en ? 'Watching the chaos…' : '围观这场混乱……'}</div>
            ) : false ? (
            <div className="space-y-2">
              <div className="text-xs text-parchment/60">{en ? `Choose a target for ${cn(pickCard, en)}:` : `为「${cn(pickCard, en)}」选择目标：`}</div>
              <div className="flex gap-2 flex-wrap">
                {aliveOthers.map((p: any) => <button key={p.seat} onClick={() => playCard(pickCard, p.seat)} disabled={busy} className="px-3 py-1.5 rounded bg-blood/40 hover:bg-blood/60 border border-blood/50 text-parchment text-sm">{p.name}</button>)}
                <button onClick={() => setPickCard('')} className="px-3 py-1.5 rounded bg-fog border border-parchment/30 text-parchment/70 text-sm">{en ? 'Cancel' : '取消'}</button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-parchment/45">{myTurn ? (en ? 'Play any number of cards, then draw to end your turn.' : '可连续出牌，出完点"抽一张牌"结束回合。') : (en ? 'Waiting for your turn…' : '等待你的回合……')}</span>
                <button onClick={drawCard} disabled={busy || !myTurn}
                  className="px-5 py-2 rounded bg-blood/80 hover:bg-blood text-parchment border border-blood text-sm disabled:opacity-40 shrink-0">
                  {en ? 'Draw a card ▶' : '抽一张牌 ▶'}
                </button>
              </div>
              <div className="flex items-end gap-2 overflow-x-auto pt-3 sm:pt-16 pb-2 px-2" style={{ WebkitOverflowScrolling: 'touch' }}>
                {hand.length === 0 && <span className="text-sm text-parchment/40 self-center">{en ? '(no cards)' : '（没有手牌）'}</span>}
                {hand.map((c, i) => {
                  const usable = myTurn && !['ward', 'hiss', 'mirror'].includes(c);
                  const mid = (hand.length - 1) / 2;
                  return (
                    <button key={i} title={en ? META[c]?.d_en : META[c]?.d_zh}
                      onPointerDown={(e) => startDrag(e, c, usable)} style={{ touchAction: 'pan-x' }}
                      className={`hand-card mcc-deal shrink-0 ${usable ? 'cursor-pointer' : 'opacity-55 cursor-default'} ${drag?.card === c ? 'opacity-30' : ''}`}>
                      <div style={{ transform: `rotate(${(i - mid) * 2}deg)`, transformOrigin: 'bottom center' }}>
                        <MccCard card={c} en={en} w={100} />
                      </div>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="border-t border-blood/40 px-4 py-4 text-center max-w-2xl w-full mx-auto flex flex-col items-center gap-2" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
          <div className="text-lg font-serif text-parchment">🏆 {pub.winner ? (pub.players.find((p: any) => p.seat === pub.winner)?.name) : '—'} {en ? 'survives the night!' : '撑过了这一夜！'}</div>
          {isHost && <button onClick={replay} disabled={resetting} className="px-5 py-2 rounded bg-blood/80 hover:bg-blood text-parchment border border-blood text-sm disabled:opacity-50">{resetting ? (en ? 'Resetting…' : '重置中…') : (en ? '↻ Play again' : '↻ 再来一局')}</button>}
        </div>
      )}
    </main>
  );
}

function CatHead() {
  const W = '#ece9e2';
  return (
    <svg viewBox="0 0 48 48" style={{ width: 48, height: 48 }}>
      <circle cx="24" cy="24" r="22" fill="#0c0c10" stroke={W} strokeOpacity="0.35" />
      <g fill="none" stroke={W} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 17 L11 8 L20 15" />
        <path d="M34 17 L37 8 L28 15" />
        <path d="M12 21 q12 -7 24 0 q2 12 -12 16 q-14 -4 -12 -16 Z" />
        <path d="M6 25 H15 M33 25 H42" strokeWidth="1" opacity="0.55" />
      </g>
      <g fill={W}><circle cx="19" cy="24" r="1.8" /><circle cx="29" cy="24" r="1.8" /></g>
      <path d="M22 29 l2 1.5 l2 -1.5" fill="none" stroke={W} strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}
