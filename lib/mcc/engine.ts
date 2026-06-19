// Midnight Cat Curse —— 原创"赌运气"猫主题派对牌局引擎（纯函数，确定性，服务端运行）。
// 牌型全部原创：curse 诅咒猫 / ward 护身铃 / nap 打盹 / swap 换爪 / peek 烛光窥视 /
// shuffle 走廊洗牌 / hex 毛球诅咒(多走一轮) / thief 零食小偷 / noise 地窖骚动 / lives 九条命。

export type Card = 'curse' | 'ward' | 'nap' | 'swap' | 'peek' | 'shuffle' | 'hex' | 'thief' | 'noise' | 'lives';

export interface State {
  deck: Card[];        // 牌堆（顶部 = 末尾 deck[deck.length-1]）
  discard: Card[];
  hands: Record<string, Card[]>;
  seats: string[];     // 回合顺序（含已出局者，跳过即可）
  names: Record<string, string>;
  alive: Record<string, boolean>;
  turn: string;        // 当前回合座位
  turnsToTake: number; // 当前玩家还需进行的回合数（毛球诅咒会增加）
  status: 'playing' | 'ended';
  winner: string | null;
  pending: null | { type: 'ward'; seat: string };
  log: { msg: string }[];
}

function shuffle<T>(a: T[]): T[] { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
const PLAYABLE: Card[] = ['nap', 'swap', 'peek', 'shuffle', 'hex', 'thief', 'noise', 'lives'];
export const NEEDS_TARGET: Card[] = ['swap', 'hex', 'thief'];

export function newGame(players: { seat: string; name: string }[]): State {
  const seats = players.map((p) => p.seat).sort();
  const names: Record<string, string> = {}; players.forEach((p) => (names[p.seat] = p.name));
  const N = seats.length;
  const pool: Card[] = [];
  const add = (c: Card, n: number) => { for (let i = 0; i < n; i++) pool.push(c); };
  add('nap', 5); add('swap', 5); add('peek', 5); add('shuffle', 4); add('hex', 5); add('thief', 5); add('noise', 3); add('lives', 4);
  shuffle(pool);
  const hands: Record<string, Card[]> = {}; const alive: Record<string, boolean> = {};
  for (const s of seats) { alive[s] = true; hands[s] = ['ward', ...pool.splice(0, 4)]; }
  const deck: Card[] = [...pool];
  for (let i = 0; i < Math.max(0, 6 - N); i++) deck.push('ward');
  for (let i = 0; i < N - 1; i++) deck.push('curse');
  shuffle(deck);
  return { deck, discard: [], hands, seats, names, alive, turn: seats[0], turnsToTake: 1, status: 'playing', winner: null, pending: null, log: [{ msg: '🐾 午夜降临，猫群苏醒——活到最后的人获胜。' }] };
}

function nm(s: State, seat: string) { return s.names[seat] || seat; }
function L(s: State, msg: string) { s.log.push({ msg }); if (s.log.length > 60) s.log = s.log.slice(-60); }
function aliveSeats(s: State) { return s.seats.filter((x) => s.alive[x]); }
function nextAlive(s: State, from: string): string {
  const order = s.seats; const i = order.indexOf(from);
  for (let k = 1; k <= order.length; k++) { const c = order[(i + k) % order.length]; if (s.alive[c]) return c; }
  return from;
}
function leftNeighbor(s: State, seat: string) { return nextAlive(s, seat); }

function checkWin(s: State) {
  const al = aliveSeats(s);
  if (al.length <= 1) { s.status = 'ended'; s.winner = al[0] || null; if (s.winner) L(s, `🏆 ${nm(s, s.winner)} 是唯一的幸存者，获胜！`); }
}
function advance(s: State) {
  if (s.status === 'ended') return;
  s.turnsToTake -= 1;
  if (s.turnsToTake > 0 && s.alive[s.turn]) return; // 同一玩家继续（被毛球诅咒/未走完）
  s.turn = nextAlive(s, s.turn); s.turnsToTake = 1;
}
function eliminate(s: State, seat: string) {
  s.alive[seat] = false;
  s.discard.push(...s.hands[seat]); s.hands[seat] = [];
  L(s, `💀 ${nm(s, seat)} 抽到诅咒猫，没有护身铃——被诅咒卷走，出局！`);
  checkWin(s);
}

// 出牌（行动牌）。返回是否成功 + 烛光窥视结果（仅出牌者可见）。
export function play(s: State, seat: string, card: Card, target?: string): { ok: boolean; error?: string; peek?: Card[] } {
  if (s.status !== 'playing') return { ok: false, error: '游戏已结束' };
  if (s.pending) return { ok: false, error: '有待处理的事件（护身铃）' };
  if (s.turn !== seat) return { ok: false, error: '还没轮到你' };
  if (!s.alive[seat]) return { ok: false, error: '你已出局' };
  if (!PLAYABLE.includes(card)) return { ok: false, error: '这张牌不能主动打出' };
  const idx = s.hands[seat].indexOf(card);
  if (idx < 0) return { ok: false, error: '你没有这张牌' };
  if (NEEDS_TARGET.includes(card)) {
    if (!target || !s.alive[target] || target === seat) return { ok: false, error: '请选择一个有效的目标玩家' };
  }
  // 弃掉这张牌
  s.hands[seat].splice(idx, 1); s.discard.push(card);
  let peek: Card[] | undefined;

  switch (card) {
    case 'nap': { // 打盹：本回合不抽牌直接结束
      L(s, `😴 ${nm(s, seat)} 打了个盹，跳过抽牌。`);
      advance(s); break;
    }
    case 'shuffle': { shuffle(s.deck); L(s, `🌀 ${nm(s, seat)} 在走廊里把牌堆搅乱了。`); break; }
    case 'peek': { peek = s.deck.slice(-3).reverse(); L(s, `🕯️ ${nm(s, seat)} 借烛光偷看了牌堆顶。`); break; }
    case 'lives': {
      if (s.discard.length) { const c = s.discard.splice(Math.floor(Math.random() * s.discard.length), 1)[0]; s.hands[seat].push(c); L(s, `🐈 ${nm(s, seat)} 用九条命从弃牌堆捡回一张牌。`); }
      else L(s, `🐈 ${nm(s, seat)} 想捡牌，但弃牌堆空空如也。`);
      break;
    }
    case 'thief': {
      const th = s.hands[target!]; if (th.length) { const c = th.splice(Math.floor(Math.random() * th.length), 1)[0]; s.hands[seat].push(c); L(s, `🍤 ${nm(s, seat)} 从 ${nm(s, target!)} 那儿顺走了一张牌。`); }
      else L(s, `🍤 ${nm(s, seat)} 想偷 ${nm(s, target!)}，但对方没牌。`);
      break;
    }
    case 'swap': {
      const a = s.hands[seat], b = s.hands[target!];
      const ca = a.length ? a.splice(Math.floor(Math.random() * a.length), 1)[0] : null;
      const cb = b.length ? b.splice(Math.floor(Math.random() * b.length), 1)[0] : null;
      if (cb) a.push(cb); if (ca) b.push(ca);
      L(s, `🐾 ${nm(s, seat)} 和 ${nm(s, target!)} 各换了一张牌。`); break;
    }
    case 'noise': {
      const al = aliveSeats(s); const taken: Record<string, Card | null> = {};
      for (const p of al) { const h = s.hands[p]; taken[p] = h.length ? h.splice(Math.floor(Math.random() * h.length), 1)[0] : null; }
      for (const p of al) { const c = taken[p]; if (c) s.hands[leftNeighbor(s, p)].push(c); }
      L(s, `🔊 地窖一声巨响，所有人各往左手边塞了一张牌。`); break;
    }
    case 'hex': { // 毛球诅咒：自己本回合不抽牌，目标接手并要多走 2 个回合
      L(s, `🧶 ${nm(s, seat)} 把毛球诅咒甩给了 ${nm(s, target!)}——下家要连走两轮！`);
      s.turn = target!; s.turnsToTake = 2; break;
    }
  }
  if (s.status === 'ended') return { ok: true, peek };
  return { ok: true, peek };
}

// 抽牌（回合的强制收尾）。
export function draw(s: State, seat: string): { ok: boolean; error?: string; drew?: Card; eliminated?: boolean; needWard?: boolean } {
  if (s.status !== 'playing') return { ok: false, error: '游戏已结束' };
  if (s.pending) return { ok: false, error: '有待处理的事件' };
  if (s.turn !== seat) return { ok: false, error: '还没轮到你' };
  if (!s.alive[seat]) return { ok: false, error: '你已出局' };
  if (!s.deck.length) { // 兜底：牌堆空了把弃牌洗回去（理论上诅咒猫保证不会先空）
    if (!s.discard.length) { s.status = 'ended'; return { ok: false, error: '没牌了' }; }
    s.deck = shuffle(s.discard.splice(0)); 
  }
  const c = s.deck.pop()!;
  if (c === 'curse') {
    if (s.hands[seat].includes('ward')) { s.pending = { type: 'ward', seat }; L(s, `🔔 ${nm(s, seat)} 抽到诅咒猫！正在用护身铃……`); return { ok: true, drew: c, needWard: true }; }
    eliminate(s, seat);
    if (s.status !== 'ended') advance(s);
    return { ok: true, drew: c, eliminated: true };
  }
  s.hands[seat].push(c);
  L(s, `🎴 ${nm(s, seat)} 抽了一张牌。`);
  advance(s);
  return { ok: true, drew: c };
}

// 用护身铃：化解诅咒猫，并把诅咒猫秘密塞回牌堆某处（pos：0=底部..deckLen=顶部）。
export function useWard(s: State, seat: string, pos: number): { ok: boolean; error?: string } {
  if (!s.pending || s.pending.type !== 'ward' || s.pending.seat !== seat) return { ok: false, error: '现在不需要护身铃' };
  const wi = s.hands[seat].indexOf('ward'); if (wi < 0) return { ok: false, error: '你没有护身铃' };
  s.hands[seat].splice(wi, 1); s.discard.push('ward');
  const p = Math.max(0, Math.min(s.deck.length, Math.floor(pos)));
  s.deck.splice(p, 0, 'curse');
  s.pending = null;
  L(s, `🔔 ${nm(s, seat)} 摇响护身铃，把诅咒猫悄悄塞回了牌堆。`);
  advance(s);
  return { ok: true };
}

// 公开桌面快照（不含牌堆顺序与他人手牌）。
export function publicView(s: State) {
  return {
    status: s.status, turn: s.turn, turnsToTake: s.turnsToTake,
    deckCount: s.deck.length, discardTop: s.discard[s.discard.length - 1] || null, discardCount: s.discard.length,
    winner: s.winner,
    pending: s.pending ? { type: s.pending.type, seat: s.pending.seat } : null,
    players: s.seats.map((seat) => ({ seat, name: s.names[seat], alive: s.alive[seat], handCount: s.hands[seat].length })),
    log: s.log.slice(-20),
  };
}
export function handRows(s: State) { return s.seats.map((seat) => ({ seat, cards: s.hands[seat] })); }
