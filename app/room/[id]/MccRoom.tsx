'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { ShellProps } from './RoomShell';

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
  const logRef = useRef<HTMLDivElement>(null);

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
  async function start() { await call('/api/mcc/start', { roomId: props.room.id }); }
  async function replay() { await call('/api/rooms/replay', { roomId: props.room.id }); }
  async function playCard(card: string, target?: string) {
    setPickCard('');
    const d = await call('/api/mcc/play', { roomId: props.room.id, card, target });
    if (d?.peek) setPeek(d.peek);
  }
  async function drawCard() {
    const d = await call('/api/mcc/draw', { roomId: props.room.id });
    if (d?.drew) {
      if (d.eliminated) {/* log shows it */ }
      else if (d.needWard) {/* ward modal via pub.pending */ }
    }
  }
  async function useWard(pos: number) { await call('/api/mcc/ward', { roomId: props.room.id, pos }); }

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
          <button onClick={start} disabled={busy || props.initialPlayers.length < 2}
            className="px-6 py-3 rounded bg-blood/80 hover:bg-blood text-parchment border border-blood disabled:opacity-50">
            {busy ? (en ? 'Dealing…' : '发牌中…') : props.initialPlayers.length < 2 ? (en ? 'Need 2+ players' : '至少 2 人') : (en ? 'Deal & start →' : '发牌开始 →')}
          </button>
        ) : <span className="text-sm text-parchment/50">{en ? 'Waiting for the host to start…' : '等待房主开始……'}</span>}
      </main>
    );
  }

  const turnName = pub.players.find((p: any) => p.seat === pub.turn)?.name;

  return (
    <main className="h-[100svh] flex flex-col overflow-hidden">
      <header className="px-4 py-3 border-b border-eldritch/20 flex items-center justify-between gap-2">
        <span className="font-serif text-parchment text-sm truncate">{en ? 'Midnight Cat Curse' : '午夜猫诅咒'}</span>
        <span className="text-xs text-parchment/55">{ended ? (en ? 'Game over' : '对局结束') : (en ? `Deck ${pub.deckCount} · ${myTurn ? 'YOUR TURN' : turnName + '’s turn'}` : `牌堆 ${pub.deckCount} · ${myTurn ? '轮到你' : turnName + ' 的回合'}`)}{pub.turnsToTake > 1 ? ` (×${pub.turnsToTake})` : ''}</span>
      </header>

      {/* 玩家桌 */}
      <div className="px-4 py-2 border-b border-eldritch/15 flex gap-1.5 flex-wrap">
        {pub.players.map((p: any) => (
          <span key={p.seat} className={`text-xs px-2 py-1 rounded-full border ${p.seat === pub.turn && !ended ? 'bg-eldritch/40 border-eldritch text-parchment' : p.alive ? 'bg-fog border-eldritch/30 text-parchment/80' : 'bg-ink border-parchment/15 text-parchment/30 line-through'}`}>
            {p.seat === pub.turn && !ended ? '▶ ' : ''}{p.name}{p.seat === mySeat ? (en ? ' (you)' : '（你）') : ''} · {en ? `${p.handCount} cards` : `${p.handCount}张`}{!p.alive ? ' 💀' : ''}
          </span>
        ))}
      </div>

      {/* 牌堆 / 弃牌 */}
      <div className="px-4 py-3 flex items-center justify-center gap-6 border-b border-eldritch/10">
        <div className="text-center"><div className="w-16 h-22 rounded-lg bg-gradient-to-b from-eldritch/40 to-ink border border-eldritch/40 flex items-center justify-center text-2xl">🂠</div><div className="text-xs text-parchment/50 mt-1">{en ? 'Deck' : '牌堆'} {pub.deckCount}</div></div>
        <div className="text-center"><div className="w-16 h-22 rounded-lg bg-fog border border-eldritch/30 flex items-center justify-center text-2xl">{pub.discardTop ? META[pub.discardTop]?.e : '—'}</div><div className="text-xs text-parchment/50 mt-1">{en ? 'Discard' : '弃牌'} {pub.discardCount}</div></div>
      </div>

      {/* 日志 */}
      <div ref={logRef} className="flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-1 max-w-2xl w-full mx-auto">
        {(pub.log || []).map((l: any, i: number) => <div key={i} className="text-sm text-parchment/70 leading-snug">{l.msg}</div>)}
      </div>

      {/* 烛光窥视结果 */}
      {peek && (
        <div className="px-4 py-3 border-t border-amber-700/40 bg-amber-950/30 max-w-2xl w-full mx-auto">
          <div className="text-xs text-amber-300/80 mb-1.5">🕯️ {en ? 'Top of deck (top → down):' : '牌堆顶（从上到下）：'}</div>
          <div className="flex gap-2">{peek.map((c, i) => <span key={i} className="text-sm px-2 py-1 rounded bg-fog border border-eldritch/30 text-parchment/85">{cn(c, en)}</span>)}</div>
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

      {/* 我的手牌 + 操作 */}
      {!ended ? (
        <div className="border-t border-eldritch/20 px-4 py-3 space-y-2 max-w-3xl w-full mx-auto" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
          {pickCard ? (
            <div className="space-y-2">
              <div className="text-xs text-parchment/60">{en ? `Choose a target for ${cn(pickCard, en)}:` : `为「${cn(pickCard, en)}」选择目标：`}</div>
              <div className="flex gap-2 flex-wrap">
                {aliveOthers.map((p: any) => <button key={p.seat} onClick={() => playCard(pickCard, p.seat)} disabled={busy} className="px-3 py-1.5 rounded bg-blood/40 hover:bg-blood/60 border border-blood/50 text-parchment text-sm">{p.name}</button>)}
                <button onClick={() => setPickCard('')} className="px-3 py-1.5 rounded bg-fog border border-parchment/30 text-parchment/70 text-sm">{en ? 'Cancel' : '取消'}</button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex gap-2 flex-wrap min-h-[2.5rem]">
                {hand.length === 0 && <span className="text-sm text-parchment/40">{en ? '(no cards)' : '（没有手牌）'}</span>}
                {hand.map((c, i) => (
                  <button key={i} disabled={busy || !myTurn || c === 'ward'} title={en ? META[c]?.d_en : META[c]?.d_zh}
                    onClick={() => { if (NEEDS_TARGET.includes(c)) setPickCard(c); else playCard(c); }}
                    className={`px-2.5 py-2 rounded-lg border text-sm ${myTurn && c !== 'ward' ? 'bg-fog border-eldritch/40 hover:bg-eldritch/20 text-parchment' : 'bg-ink border-parchment/15 text-parchment/45'}`}>
                    {cn(c, en)}
                  </button>
                ))}
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-parchment/45">{myTurn ? (en ? 'Play cards, then draw to end your turn.' : '出牌，然后抽一张结束回合。') : (en ? 'Waiting for your turn…' : '等待你的回合……')}</span>
                <button onClick={drawCard} disabled={busy || !myTurn}
                  className="px-5 py-2 rounded bg-blood/80 hover:bg-blood text-parchment border border-blood text-sm disabled:opacity-40">
                  {en ? 'Draw a card ▶' : '抽一张牌 ▶'}
                </button>
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="border-t border-blood/40 px-4 py-4 text-center max-w-2xl w-full mx-auto flex flex-col items-center gap-2" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
          <div className="text-lg font-serif text-parchment">🏆 {pub.winner ? (pub.players.find((p: any) => p.seat === pub.winner)?.name) : '—'} {en ? 'survives the night!' : '撑过了这一夜！'}</div>
          {isHost && <button onClick={replay} disabled={busy} className="px-5 py-2 rounded bg-blood/80 hover:bg-blood text-parchment border border-blood text-sm disabled:opacity-50">{busy ? (en ? 'Resetting…' : '重置中…') : (en ? '↻ Play again' : '↻ 再来一局')}</button>}
        </div>
      )}
    </main>
  );
}
