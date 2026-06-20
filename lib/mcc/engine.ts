// Midnight Cat Curse —— 原创"赌运气"猫主题派对牌局引擎（纯函数，确定性，服务端运行）。
// 牌型全部原创：curse 诅咒猫 / ward 护身铃 / nap 打盹 / swap 换爪 / peek 烛光窥视 /
// shuffle 走廊洗牌 / hex 毛球诅咒(多走一轮) / thief 零食小偷 / noise 地窖骚动 / lives 九条命 /
// hiss 嘶吼(取消他人出牌，可反取消) / mirror 镜爪(被指定时把目标转给别人)。

export type Card = 'curse' | 'ward' | 'nap' | 'swap' | 'peek' | 'shuffle' | 'hex' | 'thief' | 'noise' | 'lives' | 'hiss' | 'mirror';

export interface State {
  deck: Card[];
  discard: Card[];
  hands: Record<string, Card[]>;
  seats: string[];
  names: Record<string, string>;
  alive: Record<string, boolean>;
  turn: string;
  turnsToTake: number;
  bots: string[]; // 由 AI 扮演的座位
  feed: { c: Card; by: string }[]; // 出牌顺序（谁出了什么）
  status: 'playing' | 'ended';
  winner: string | null;
  pending: null
    | { type: 'ward'; seat: string }
    | { type: 'react'; card: Card; by: string; target: string | null; hiss: number; until: number; passed: string[] };
  log: { msg: string }[];
}

const ZH: Record<string, string> = { curse: '诅咒猫', ward: '护身铃', nap: '打盹', swap: '换爪', peek: '烛光窥视', shuffle: '走廊洗牌', hex: '毛球诅咒', thief: '零食小偷', noise: '地窖骚动', lives: '九条命', hiss: '嘶吼', mirror: '镜爪' };
function shuffle<T>(a: T[]): T[] { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

export const PLAYABLE: Card[] = ['nap', 'swap', 'peek', 'shuffle', 'hex', 'thief', 'noise', 'lives'];
export const NEEDS_TARGET: Card[] = ['swap', 'hex', 'thief'];
const CANCELABLE: Card[] = ['nap', 'swap', 'hex', 'thief', 'noise']; // peek/shuffle/lives 立即生效，不进响应窗口

export function newGame(players: { seat: string; name: string; bot?: boolean }[]): State {
  const seats = players.map((p) => p.seat).sort();
  const names: Record<string, string> = {}; players.forEach((p) => (names[p.seat] = p.name));
  const N = seats.length;
  const pool: Card[] = [];
  const add = (c: Card, n: number) => { for (let i = 0; i < n; i++) pool.push(c); };
  add('nap', 5); add('swap', 5); add('peek', 5); add('shuffle', 4); add('hex', 5); add('thief', 5); add('noise', 3); add('lives', 4); add('hiss', 5); add('mirror', 3);
  shuffle(pool);
  const hands: Record<string, Card[]> = {}; const alive: Record<string, boolean> = {};
  for (const s of seats) { alive[s] = true; hands[s] = ['ward', ...pool.splice(0, 5)]; }
  const deck: Card[] = [...pool];
  deck.push('ward'); // 仅 1 张备用护身铃（每人开局已各持 1 张）
  for (let i = 0; i < N - 1; i++) deck.push('curse');
  shuffle(deck);
  const bots = players.filter((p) => p.bot).map((p) => p.seat);
  return { deck, discard: [], hands, seats, names, alive, turn: seats[0], turnsToTake: 1, bots, feed: [], status: 'playing', winner: null, pending: null, log: [{ msg: '🐾 午夜降临，猫群苏醒——活到最后的人获胜。' }] };
}

function nm(s: State, seat: string) { return s.names[seat] || seat; }
function L(s: State, msg: string) { s.log.push({ msg }); if (s.log.length > 60) s.log = s.log.slice(-60); }
function aliveSeats(s: State) { return s.seats.filter((x) => s.alive[x]); }
function nextAlive(s: State, from: string): string {
  const order = s.seats; const i = order.indexOf(from);
  for (let k = 1; k <= order.length; k++) { const c = order[(i + k) % order.length]; if (s.alive[c]) return c; }
  return from;
}
function checkWin(s: State) {
  const al = aliveSeats(s);
  if (al.length <= 1) { s.status = 'ended'; s.winner = al[0] || null; if (s.winner) L(s, `🏆 ${nm(s, s.winner)} 是唯一的幸存者，获胜！`); }
}
function advance(s: State) {
  if (s.status === 'ended') return;
  s.turnsToTake -= 1;
  if (s.turnsToTake > 0 && s.alive[s.turn]) return;
  s.turn = nextAlive(s, s.turn); s.turnsToTake = 1;
}
function eliminate(s: State, seat: string) {
  s.alive[seat] = false;
  s.discard.push(...s.hands[seat]); s.hands[seat] = [];
  L(s, `💀 ${nm(s, seat)} 抽到诅咒猫，没有护身铃——被诅咒卷走，出局！`);
  checkWin(s);
}

function someoneCanReact(s: State, by: string, card: Card, target: string | null): boolean {
  for (const p of aliveSeats(s)) {
    if (p === by) continue;
    if (s.bots.includes(p) && !(NEEDS_TARGET.includes(card) && target === p)) continue; // 机器猫只为针对自己的牌开窗
    if (s.hands[p].includes('hiss')) return true;
  }
  if (NEEDS_TARGET.includes(card) && target && s.hands[target]?.includes('mirror')) return true;
  return false;
}

// 实际结算一张行动牌（不含 peek，peek 在 play 里立即处理）。
function applyEffect(s: State, card: Card, by: string, target: string | null) {
  switch (card) {
    case 'nap': L(s, `😴 ${nm(s, by)} 打了个盹，跳过抽牌。`); advance(s); break;
    case 'shuffle': shuffle(s.deck); L(s, `🌀 ${nm(s, by)} 在走廊里把牌堆搅乱了。`); break;
    case 'lives':
      if (s.discard.length) { const c = s.discard.splice(Math.floor(Math.random() * s.discard.length), 1)[0]; s.hands[by].push(c); L(s, `🐈 ${nm(s, by)} 用九条命从弃牌堆捡回一张牌。`); }
      else L(s, `🐈 ${nm(s, by)} 想捡牌，但弃牌堆空空如也。`); break;
    case 'thief': {
      if (!target) break; const th = s.hands[target];
      if (th?.length) { const c = th.splice(Math.floor(Math.random() * th.length), 1)[0]; s.hands[by].push(c); L(s, `🍤 ${nm(s, by)} 从 ${nm(s, target)} 那儿顺走了一张牌。`); }
      else L(s, `🍤 ${nm(s, by)} 想偷 ${nm(s, target)}，但对方没牌。`); break;
    }
    case 'swap': {
      if (!target) break; const a = s.hands[by], b = s.hands[target];
      const ca = a.length ? a.splice(Math.floor(Math.random() * a.length), 1)[0] : null;
      const cb = b.length ? b.splice(Math.floor(Math.random() * b.length), 1)[0] : null;
      if (cb) a.push(cb); if (ca) b.push(ca);
      L(s, `🐾 ${nm(s, by)} 和 ${nm(s, target)} 各换了一张牌。`); break;
    }
    case 'noise': {
      const al = aliveSeats(s); const taken: Record<string, Card | null> = {};
      for (const p of al) { const h = s.hands[p]; taken[p] = h.length ? h.splice(Math.floor(Math.random() * h.length), 1)[0] : null; }
      for (const p of al) { const c = taken[p]; if (c) s.hands[nextAlive(s, p)].push(c); }
      L(s, `🔊 地窖一声巨响，所有人各往左手边塞了一张牌。`); break;
    }
    case 'hex': { if (!target) break; L(s, `🧶 ${nm(s, by)} 把毛球诅咒甩给了 ${nm(s, target)}——下家要连走两轮！`); s.turn = target; s.turnsToTake = 2; break; }
  }
}

export function play(s: State, seat: string, card: Card, target?: string): { ok: boolean; error?: string; peek?: Card[] } {
  if (s.status !== 'playing') return { ok: false, error: '游戏已结束' };
  if (s.pending) return { ok: false, error: '有待处理的事件，请稍候' };
  if (s.turn !== seat) return { ok: false, error: '还没轮到你' };
  if (!s.alive[seat]) return { ok: false, error: '你已出局' };
  if (!PLAYABLE.includes(card)) return { ok: false, error: '这张牌不能主动打出' };
  const idx = s.hands[seat].indexOf(card);
  if (idx < 0) return { ok: false, error: '你没有这张牌' };
  const tgt = target || null;
  if (NEEDS_TARGET.includes(card)) { if (!tgt || !s.alive[tgt] || tgt === seat) return { ok: false, error: '请选择一个有效的目标玩家' }; }
  s.hands[seat].splice(idx, 1); s.discard.push(card);
  s.feed.push({ c: card, by: seat }); if (s.feed.length > 50) s.feed = s.feed.slice(-50);

  if (card === 'peek') { L(s, `🕯️ ${nm(s, seat)} 借烛光偷看了牌堆顶。`); return { ok: true, peek: s.deck.slice(-3).reverse() }; }

  if (CANCELABLE.includes(card) && someoneCanReact(s, seat, card, tgt)) {
    s.pending = { type: 'react', card, by: seat, target: tgt, hiss: 0, until: Date.now() + 8000, passed: [] };
    L(s, `🃏 ${nm(s, seat)} 打出「${ZH[card]}」${tgt ? `（指向 ${nm(s, tgt)}）` : ''}——可在数秒内被嘶吼/镜爪响应……`);
    return { ok: true };
  }
  applyEffect(s, card, seat, tgt);
  return { ok: true };
}

// 响应：嘶吼取消 / 镜爪转移目标。
export function react(s: State, seat: string, kind: 'hiss' | 'mirror', newTarget?: string): { ok: boolean; error?: string } {
  if (!s.pending || s.pending.type !== 'react') return { ok: false, error: '现在没有可响应的出牌' };
  if (!s.alive[seat]) return { ok: false, error: '你已出局' };
  const pg = s.pending;
  if (kind === 'hiss') {
    const i = s.hands[seat].indexOf('hiss'); if (i < 0) return { ok: false, error: '你没有嘶吼牌' };
    s.hands[seat].splice(i, 1); s.discard.push('hiss');
    pg.hiss += 1; pg.until = Date.now() + 8000; pg.passed = [];
    L(s, `🙀 ${nm(s, seat)} 发出嘶吼！（当前：${pg.hiss % 2 === 1 ? '该牌将被取消' : '取消被反取消'}）`);
    return { ok: true };
  }
  if (kind === 'mirror') {
    if (!NEEDS_TARGET.includes(pg.card)) return { ok: false, error: '这张牌没有目标可转移' };
    if (seat !== pg.target) return { ok: false, error: '只有被指定的目标可以用镜爪' };
    const i = s.hands[seat].indexOf('mirror'); if (i < 0) return { ok: false, error: '你没有镜爪' };
    if (!newTarget || !s.alive[newTarget] || newTarget === seat) return { ok: false, error: '请选择有效的新目标' };
    s.hands[seat].splice(i, 1); s.discard.push('mirror');
    pg.target = newTarget; pg.until = Date.now() + 8000; pg.passed = [];
    L(s, `🪞 ${nm(s, seat)} 用镜爪把矛头转给了 ${nm(s, newTarget)}！`);
    return { ok: true };
  }
  return { ok: false, error: '未知响应' };
}

// 响应窗口到点则结算（取消或生效）。host 端轮询调用。
export function resolvePending(s: State): boolean {
  if (!s.pending || s.pending.type !== 'react') return false;
  const pg = s.pending;
  if (pg.hiss % 2 === 1) { L(s, `🚫 「${ZH[pg.card]}」被嘶吼取消了。`); s.pending = null; return true; }
  s.pending = null;
  applyEffect(s, pg.card, pg.by, pg.target);
  return true;
}

export function draw(s: State, seat: string): { ok: boolean; error?: string; drew?: Card; eliminated?: boolean; needWard?: boolean } {
  if (s.status !== 'playing') return { ok: false, error: '游戏已结束' };
  if (s.pending) return { ok: false, error: '有待处理的事件' };
  if (s.turn !== seat) return { ok: false, error: '还没轮到你' };
  if (!s.alive[seat]) return { ok: false, error: '你已出局' };
  if (!s.deck.length) { if (!s.discard.length) { s.status = 'ended'; return { ok: false, error: '没牌了' }; } s.deck = shuffle(s.discard.splice(0)); }
  const c = s.deck.pop()!;
  if (c === 'curse') {
    if (s.hands[seat].includes('ward')) { s.pending = { type: 'ward', seat }; L(s, `🔔 ${nm(s, seat)} 抽到诅咒猫！正在用护身铃……`); return { ok: true, drew: c, needWard: true }; }
    eliminate(s, seat); if (s.status !== 'ended') advance(s); return { ok: true, drew: c, eliminated: true };
  }
  s.hands[seat].push(c); L(s, `🎴 ${nm(s, seat)} 抽了一张牌。`); advance(s);
  return { ok: true, drew: c };
}

export function useWard(s: State, seat: string, pos: number): { ok: boolean; error?: string } {
  if (!s.pending || s.pending.type !== 'ward' || s.pending.seat !== seat) return { ok: false, error: '现在不需要护身铃' };
  const wi = s.hands[seat].indexOf('ward'); if (wi < 0) return { ok: false, error: '你没有护身铃' };
  s.hands[seat].splice(wi, 1); s.discard.push('ward');
  const p = Math.max(0, Math.min(s.deck.length, Math.floor(pos)));
  s.deck.splice(p, 0, 'curse'); s.pending = null;
  L(s, `🔔 ${nm(s, seat)} 摇响护身铃，把诅咒猫悄悄塞回了牌堆。`); advance(s);
  return { ok: true };
}

export function publicView(s: State) {
  const pend = s.pending ? (s.pending.type === 'ward' ? { type: 'ward', seat: s.pending.seat } : { type: 'react', card: s.pending.card, by: s.pending.by, target: s.pending.target, hiss: s.pending.hiss }) : null;
  return {
    status: s.status, turn: s.turn, turnsToTake: s.turnsToTake,
    deckCount: s.deck.length, discardTop: s.discard[s.discard.length - 1] || null, discardCount: s.discard.length, discard: s.discard, feed: s.feed.slice(-24),
    winner: s.winner, pending: pend,
    players: s.seats.map((seat) => ({ seat, name: s.names[seat], alive: s.alive[seat], handCount: s.hands[seat].length, isAI: s.bots.includes(seat) })),
    log: s.log.slice(-20), logSeq: s.log.length,
  };
}
export function handRows(s: State) { return s.seats.map((seat) => ({ seat, cards: s.hands[seat] })); }

// AI 机器猫的单步行动（房主端轮询驱动）：偶尔出一张牌，然后抽牌。
export function botAct(s: State, seat: string) {
  if (s.status !== 'playing' || s.turn !== seat || s.pending) return;
  const hand = s.hands[seat];
  const playable = hand.filter((c) => PLAYABLE.includes(c));
  if (playable.length && Math.random() < 0.45) {
    const offensive = playable.filter((c) => c === 'thief' || c === 'hex');
    const from = offensive.length && Math.random() < 0.6 ? offensive : playable;
    const card = from[Math.floor(Math.random() * from.length)];
    let target: string | undefined;
    if (NEEDS_TARGET.includes(card)) {
      const opps = aliveSeats(s).filter((x) => x !== seat);
      target = opps.length ? opps[Math.floor(Math.random() * opps.length)] : undefined;
    }
    if (!NEEDS_TARGET.includes(card) || target) play(s, seat, card, target);
  }
  if (s.pending || s.turn !== seat || s.status !== 'playing') return; // 进入响应窗口 / 回合已转移
  draw(s, seat);
}

export function humanCanReact(s: State): boolean {
  if (!s.pending || s.pending.type !== 'react') return false;
  const pg = s.pending;
  for (const seat of aliveSeats(s)) { if (seat === pg.by || s.bots.includes(seat)) continue; if (s.hands[seat].includes('hiss')) return true; }
  if (NEEDS_TARGET.includes(pg.card) && pg.target && !s.bots.includes(pg.target) && s.hands[pg.target]?.includes('mirror')) return true;
  return false;
}

// 机器猫在响应窗口的一步决策：会用嘶吼反制（尤其针对自己），偶尔虚张；没人能再响应则直接结算。
export function botReact(s: State) {
  if (!s.pending || s.pending.type !== 'react') return;
  const pg = s.pending;
  for (const seat of aliveSeats(s)) {
    if (!s.bots.includes(seat) || seat === pg.by) continue;
    const targeted = NEEDS_TARGET.includes(pg.card) && pg.target === seat;
    // 被指定且有镜爪：一半概率把矛头转走
    if (targeted && s.hands[seat].includes('mirror') && !pg.passed.includes('m:' + seat)) {
      if (Math.random() < 0.5) { const opps = aliveSeats(s).filter((x) => x !== seat); if (opps.length) { react(s, seat, 'mirror', opps[Math.floor(Math.random() * opps.length)]); return; } }
      pg.passed.push('m:' + seat);
    }
    if (pg.passed.includes(seat) || !s.hands[seat].includes('hiss')) { if (!pg.passed.includes(seat)) pg.passed.push(seat); continue; }
    const willCancel = pg.hiss % 2 === 0;
    let p = 0.05; // 基础虚张
    if (targeted && willCancel) p = 0.78;
    else if (targeted) p = 0.45;
    else if (willCancel && pg.card === 'hex') p = 0.12;
    if (Math.random() < p) { react(s, seat, 'hiss'); return; }
    pg.passed.push(seat);
  }
  // 没有真人能响应、且机器猫也都决定不动 → 立即结算，不空等
  if (!humanCanReact(s)) {
    const botPending = aliveSeats(s).some((seat) => s.bots.includes(seat) && seat !== pg.by && !pg.passed.includes(seat) && s.hands[seat].includes('hiss'));
    if (!botPending) resolvePending(s);
  }
}
