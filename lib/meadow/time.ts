// 童话草原 · 时间与饥饿（×10 真实时钟）。
export const TIME_SCALE = 10;
export const EPOCH = Date.UTC(2026, 0, 1); // 草原纪元起点

export interface Clock { gameDays: number; season: string; night: boolean; label: string; }
export function gameClock(now: number = Date.now()): Clock {
  const gameMs = Math.max(0, now - EPOCH) * TIME_SCALE;
  const gameDays = Math.floor(gameMs / 86400000);
  const dayFrac = (gameMs % 86400000) / 86400000;
  const season = ['春', '夏', '秋', '冬'][Math.floor(gameDays / 7) % 4];
  const night = dayFrac < 0.22 || dayFrac >= 0.82;
  return { gameDays, season, night, label: `草原历 第 ${gameDays + 1} 天 · ${season} · ${night ? '夜' : '昼'}` };
}

// 饥饿 0(饱) → 100(饿死)。约 12 真实小时从饱到饿死。
export const HUNGER_RATE = 100 / (12 * 3600); // 每真实秒
export function advanceHunger(hunger: number, sinceMs: number): number {
  return clamp01(hunger + (Math.max(0, sinceMs) / 1000) * HUNGER_RATE);
}
export function clamp01(v: number): number { return Math.max(0, Math.min(100, v)); }
