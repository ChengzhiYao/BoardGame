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
};

export function defaultProfile(user_id: string): MP {
  return { user_id, cash: START_CASH, price: START_PRICE, owner_id: null, protected_until: null, working_until: null, opted_out: false, last_daily: null, last_fate: null, trades_today: 0, trades_day: null, bought_today: 0, bought_day: null };
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
