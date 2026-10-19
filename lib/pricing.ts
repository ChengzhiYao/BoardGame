// 永久免费的游戏模式（AI 用量极少）：海龟汤 / 真心话大冒险 / 午夜猫诅咒。
export const FREE_MODES = ['soup', 'td', 'mcc'];
export const FREE_PLAYS_ON_SIGNUP = 2;

// 免费玩家每周可免费游玩的时长（秒）：2 小时
export const FREE_WEEKLY_SECONDS = 2 * 3600;

// 会员每月可免费开的「豪华大作」局数（超出后用购买的局数）
export const MEMBER_PREMIUM_PLAYS = 5;

// 会员订阅（无限畅玩）。价格单位：美分 USD。
export const MEMBERSHIP = {
  monthly: { id: 'm', price: 1000, interval: 'month' as const },
  yearly: { id: 'y', price: 6000, interval: 'year' as const },
};
// 年费相对「月费×12」便宜的百分比（60 vs 120 → 50%）
export function yearlySavingsPct() {
  return Math.round((1 - MEMBERSHIP.yearly.price / (MEMBERSHIP.monthly.price * 12)) * 100);
}

// 本月起始（当月 1 号 UTC）的 YYYY-MM-DD，用作会员每月豪华局数的分桶键
export function monthStart(d = new Date()): string {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString().slice(0, 10);
}

// 本周起始（周一 00:00 UTC）的 YYYY-MM-DD，用作每周免费时长的分桶键
export function weekStart(d = new Date()): string {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = (t.getUTCDay() + 6) % 7;
  t.setUTCDate(t.getUTCDate() - day);
  return t.toISOString().slice(0, 10);
}
