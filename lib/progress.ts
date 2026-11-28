// 玩家成长:经验和等级、每日打卡奖励、专属头像框。
// 经验全部从真实玩过的东西算出来(局数、猜中的汤、每日一汤、结局、听完的故事、打卡、分享),不能刷。

export type ProgStats = {
  played: number; soupSolved: number; dailyPlayed: number; cocEndings: number; jbsDone: number; botcDone: number;
  listens: number; checkins: number; shares: number; bestCheckinStreak: number;
};

export function xpOf(s: Partial<ProgStats>): number {
  return Math.round(
    (s.played || 0) * 20 + (s.soupSolved || 0) * 10 + (s.dailyPlayed || 0) * 15 + (s.cocEndings || 0) * 40 +
    (s.jbsDone || 0) * 30 + (s.botcDone || 0) * 30 + (s.listens || 0) * 6 + (s.checkins || 0) * 5 + (s.shares || 0) * 10,
  );
}

// 升到第 n 级要累计 50·n·(n-1) 经验:2 级 100、3 级 300、5 级 1000、10 级 4500、20 级 19000
export const needFor = (n: number) => 50 * n * (n - 1);
export function levelOf(xp: number) {
  let n = 1; while (needFor(n + 1) <= xp && n < 99) n++;
  const cur = xp - needFor(n), span = needFor(n + 1) - needFor(n);
  return { level: n, xp, cur, span, next: needFor(n + 1) };
}

export const LEVEL_TITLES: [number, string, string][] = [
  [1, '新来的客人', 'Newcomer'], [3, '夜行者', 'Night Walker'], [5, '常客', 'Regular'], [8, '解谜人', 'Riddle Solver'],
  [12, '守夜人', 'Night Keeper'], [16, '老练调查员', 'Seasoned Investigator'], [20, '谜夜旧识', 'Old Friend of the Night'], [30, '深渊行者', 'Abyss Walker'],
];
export const titleOf = (lv: number, en = false) => { let t = LEVEL_TITLES[0]; for (const x of LEVEL_TITLES) if (lv >= x[0]) t = x; return en ? t[2] : t[1]; };

// 头像框:达成条件才能解锁,解锁后在「我的」里选一个戴上
export type Frame = { id: string; zh: string; en: string; dzh: string; den: string; test: (s: Partial<ProgStats> & { level: number }) => boolean; css: string };
export const FRAMES: Frame[] = [
  { id: 'mist', zh: '晨雾', en: 'Morning Mist', dzh: '累计打卡 7 天', den: 'Check in on 7 days', test: (s) => (s.checkins || 0) >= 7, css: 'linear-gradient(135deg,#cfe9e1,#6aa595,#cfe9e1)' },
  { id: 'candle', zh: '烛光', en: 'Candlelight', dzh: '升到 5 级', den: 'Reach level 5', test: (s) => s.level >= 5, css: 'linear-gradient(135deg,#ffe2a8,#d08a3a,#ffe2a8)' },
  { id: 'herald', zh: '信使', en: 'Herald', dzh: '分享 5 次成绩', den: 'Share your results 5 times', test: (s) => (s.shares || 0) >= 5, css: 'linear-gradient(135deg,#b9d4ff,#5b7fd6,#b9d4ff)' },
  { id: 'eclipse', zh: '月蚀', en: 'Eclipse', dzh: '连续打卡 30 天', den: 'Check in 30 days in a row', test: (s) => (s.bestCheckinStreak || 0) >= 30, css: 'conic-gradient(from 0deg,#2b2440,#c9b6ff,#2b2440,#8f7ad6,#2b2440)' },
  { id: 'bloodmoon', zh: '血月', en: 'Blood Moon', dzh: '升到 10 级', den: 'Reach level 10', test: (s) => s.level >= 10, css: 'conic-gradient(from 30deg,#5a0f12,#e05050,#5a0f12,#a83232,#5a0f12)' },
  { id: 'abyss', zh: '深渊', en: 'Abyss', dzh: '升到 20 级', den: 'Reach level 20', test: (s) => s.level >= 20, css: 'conic-gradient(from 0deg,#0b1a22,#3fd0c9,#160b22,#8f5bd6,#0b1a22)' },
];
export const frameCss = (id?: string | null) => FRAMES.find((f) => f.id === id)?.css || null;

// 每日打卡:每累计 5 次送 1 次免费的豪华玩法(跑团/剧本杀/血染钟楼都能用)
export const CHECKIN_EVERY = 5;

export function streakFrom(days: string[], today: string): { current: number; best: number } {
  const set = new Set(days); const asc = Array.from(set).sort();
  let best = 0, run = 0, prev = 0;
  for (const d of asc) { const t = Date.parse(d + 'T12:00:00Z'); run = prev && t - prev <= 86400000 * 1.1 ? run + 1 : 1; best = Math.max(best, run); prev = t; }
  let current = 0; let t = Date.parse(today + 'T12:00:00Z');
  if (!set.has(today)) t -= 86400000; // 今天还没打,从昨天往回数
  while (set.has(new Date(t).toISOString().slice(0, 10))) { current++; t -= 86400000; }
  return { current, best };
}
