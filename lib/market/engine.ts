// 身价场核心数值与工具。
export const START_CASH = 1000;
export const START_PRICE = 500;
export const DAILY_REWARD = 100;
export const PRICE_MULT = 1.3;       // 每次成交身价涨幅
export const OWNER_SHARE = 0.90;     // 原主人分成
export const SELF_SHARE = 0.05;      // 被交易者本人分成
export const HOLD_CAP = 10;          // 持有满 10 则自己不可被买
export const PROTECT_DAYS = 3;       // 赎身/保护天数
export const TRADES_PER_DAY = 20;    // 每人每天买入上限
export const BOUGHT_PER_DAY = 2;     // 每人每天最多被买次数

export function today(): string { return new Date().toISOString().slice(0, 10); }

export type MP = {
  user_id: string; cash: number; price: number; owner_id: string | null;
  protected_until: string | null; working_until: string | null; opted_out: boolean;
  last_daily: string | null; last_fate: string | null;
  trades_today: number; trades_day: string | null; bought_today: number; bought_day: string | null;
  exp: number; nickname: string | null; quest_day: string | null; q_buy: number; q_work: number; q_social: number; q_claimed: boolean;
};

export function defaultProfile(user_id: string): MP {
  return { user_id, cash: START_CASH, price: START_PRICE, owner_id: null, protected_until: null, working_until: null, opted_out: false, last_daily: null, last_fate: null, trades_today: 0, trades_day: null, bought_today: 0, bought_day: null, exp: 0, nickname: null, quest_day: null, q_buy: 0, q_work: 0, q_social: 0, q_claimed: false };
}

export function isProtected(p: MP) { return !!(p.protected_until && new Date(p.protected_until) > new Date()); }
export function isWorking(p: MP) { return !!(p.working_until && new Date(p.working_until) > new Date()); }
export function tradesToday(p: MP) { return p.trades_day === today() ? p.trades_today : 0; }
export function boughtToday(p: MP) { return p.bought_day === today() ? p.bought_today : 0; }

// 确保有 profile 行（没有则建默认）
export async function ensureProfile(admin: any, userId: string): Promise<MP> {
  const { data } = await admin.from('market_profiles').select('*').eq('user_id', userId).maybeSingle();
  if (data) return data as MP;
  const def = defaultProfile(userId);
  await admin.from('market_profiles').insert(def).then(() => {}, () => {});
  const { data: d2 } = await admin.from('market_profiles').select('*').eq('user_id', userId).maybeSingle();
  return (d2 as MP) || def;
}

export async function feed(admin: any, text: string) {
  try { await admin.from('market_feed').insert({ text }); } catch {}
}


// 称号/等级
export const TITLES = [
  { min: 0, zh: '平民', en: 'Commoner' }, { min: 200, zh: '小资', en: 'Climber' }, { min: 600, zh: '富商', en: 'Merchant' },
  { min: 1500, zh: '大亨', en: 'Tycoon' }, { min: 4000, zh: '巨鳄', en: 'Magnate' }, { min: 10000, zh: '传奇', en: 'Legend' },
];
export function rankOf(exp: number) {
  let i = 0; for (let k = 0; k < TITLES.length; k++) if (exp >= TITLES[k].min) i = k;
  const cur = TITLES[i]; const next = TITLES[i + 1] || null;
  const prog = next ? (exp - cur.min) / (next.min - cur.min) : 1;
  return { level: i + 1, zh: cur.zh, en: cur.en, exp, nextMin: next ? next.min : null, prog: Math.max(0, Math.min(1, prog)) };
}
// 每日任务
export function questState(p: MP) {
  const on = p.quest_day === today();
  const buy = on ? p.q_buy : 0, work = on ? p.q_work : 0, social = on ? p.q_social : 0, claimed = on ? p.q_claimed : false;
  const done = buy >= 1 && work >= 1 && social >= 1;
  return { buy, work, social, claimed, done, canClaim: done && !claimed };
}
export function questBump(p: MP, field: 'q_buy' | 'q_work' | 'q_social'): any {
  const on = p.quest_day === today();
  const base: any = { q_buy: on ? p.q_buy : 0, q_work: on ? p.q_work : 0, q_social: on ? p.q_social : 0, q_claimed: on ? p.q_claimed : false, quest_day: today() };
  base[field] = (base[field] || 0) + 1;
  return base;
}
export const QUEST_REWARD = 200;
