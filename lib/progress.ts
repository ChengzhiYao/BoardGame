// 玩家成长:经验和等级、每日打卡奖励、专属头像框。
// 经验全部从真实玩过的东西算出来(局数、猜中的汤、每日一汤、结局、听完的故事、打卡、分享),不能刷。

export type ProgStats = {
  played: number; soupSolved: number; dailyPlayed: number; cocEndings: number; jbsDone: number; botcDone: number;
  listens: number; checkins: number; shares: number; bestCheckinStreak: number; bestMonth?: number; monthXp?: number;
};

export function xpOf(s: Partial<ProgStats>): number {
  return Math.round(
    (s.played || 0) * 20 + (s.soupSolved || 0) * 10 + (s.dailyPlayed || 0) * 15 + (s.cocEndings || 0) * 40 +
    (s.jbsDone || 0) * 30 + (s.botcDone || 0) * 30 + (s.listens || 0) * 6 + (s.checkins || 0) * 5 + checkinLoot(s.checkins || 0).xp + (s.shares || 0) * 10,
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
  { id: 'frost', zh: '霜花', en: 'Frost', dzh: '签到大奖', den: 'Check-in reward', test: (s) => checkinLoot(s.checkins || 0).frames.includes('frost'), css: 'linear-gradient(135deg,#e8f4ff,#8fb3d9,#e8f4ff)' },
  { id: 'watch', zh: '夜巡', en: 'Night Watch', dzh: '签到大奖', den: 'Check-in reward', test: (s) => checkinLoot(s.checkins || 0).frames.includes('watch'), css: 'conic-gradient(from 90deg,#1b2340,#e6c76e,#1b2340,#6f86c9,#1b2340)' },
  { id: 'ink', zh: '墨痕', en: 'Ink', dzh: '完成 5 场剧本杀', den: 'Finish 5 murder mysteries', test: (s) => (s.jbsDone || 0) >= 5, css: 'linear-gradient(135deg,#2a2a2a,#9a9a9a,#2a2a2a)' },
  { id: 'bell', zh: '钟声', en: 'Bell', dzh: '完成 3 局血染钟楼', den: 'Finish 3 Clocktower games', test: (s) => (s.botcDone || 0) >= 3, css: 'linear-gradient(135deg,#d9b8ff,#7a4fc4,#d9b8ff)' },
  { id: 'brew', zh: '汤神', en: 'Soup Sage', dzh: '猜中 50 碗海龟汤', den: 'Crack 50 soups', test: (s) => (s.soupSolved || 0) >= 50, css: 'linear-gradient(135deg,#bff0dd,#3f9d8e,#bff0dd)' },
  { id: 'lotus', zh: '幽莲', en: 'Ghost Lotus', dzh: '签到大奖', den: 'Check-in reward', test: (s) => checkinLoot(s.checkins || 0).frames.includes('lotus'), css: 'conic-gradient(from 0deg,#f7d6ff,#9a5fd1,#f7d6ff,#5fd1c4,#f7d6ff)' },
  { id: 'starlit', zh: '星河', en: 'Starlit', dzh: '签到大奖', den: 'Check-in reward', test: (s) => checkinLoot(s.checkins || 0).frames.includes('starlit'), css: 'conic-gradient(from 45deg,#0d1640,#c9d8ff,#0d1640,#ffe9a8,#0d1640)' },
  { id: 'crimson', zh: '绯线', en: 'Crimson Thread', dzh: '签到大奖', den: 'Check-in reward', test: (s) => checkinLoot(s.checkins || 0).frames.includes('crimson'), css: 'linear-gradient(135deg,#ff8a8a,#8a0f1e,#ff8a8a)' },
  { id: 'aurora', zh: '极光', en: 'Aurora', dzh: '签到大奖', den: 'Check-in reward', test: (s) => checkinLoot(s.checkins || 0).frames.includes('aurora'), css: 'conic-gradient(from 180deg,#7cffc4,#3aa0ff,#b77cff,#7cffc4)' },
  { id: 'tide', zh: '潮汐', en: 'Tide', dzh: '签到大奖', den: 'Check-in reward', test: (s) => checkinLoot(s.checkins || 0).frames.includes('tide'), css: 'linear-gradient(135deg,#9ee7ff,#1f6f8f,#9ee7ff)' },
  { id: 'mist', zh: '晨雾', en: 'Morning Mist', dzh: '签到大奖', den: 'Check-in reward', test: (s) => checkinLoot(s.checkins || 0).frames.includes('mist'), css: 'linear-gradient(135deg,#cfe9e1,#6aa595,#cfe9e1)' },
  { id: 'candle', zh: '烛光', en: 'Candlelight', dzh: '升到 5 级', den: 'Reach level 5', test: (s) => s.level >= 5, css: 'linear-gradient(135deg,#ffe2a8,#d08a3a,#ffe2a8)' },
  { id: 'herald', zh: '信使', en: 'Herald', dzh: '分享 5 次成绩', den: 'Share your results 5 times', test: (s) => (s.shares || 0) >= 5, css: 'linear-gradient(135deg,#b9d4ff,#5b7fd6,#b9d4ff)' },
  { id: 'eclipse', zh: '月蚀', en: 'Eclipse', dzh: '连续打卡 30 天', den: 'Check in 30 days in a row', test: (s) => (s.bestCheckinStreak || 0) >= 30, css: 'conic-gradient(from 0deg,#2b2440,#c9b6ff,#2b2440,#8f7ad6,#2b2440)' },
  { id: 'bloodmoon', zh: '血月', en: 'Blood Moon', dzh: '升到 10 级', den: 'Reach level 10', test: (s) => s.level >= 10, css: 'conic-gradient(from 30deg,#5a0f12,#e05050,#5a0f12,#a83232,#5a0f12)' },
  { id: 'abyss', zh: '深渊', en: 'Abyss', dzh: '升到 20 级', den: 'Reach level 20', test: (s) => s.level >= 20, css: 'conic-gradient(from 0deg,#0b1a22,#3fd0c9,#160b22,#8f5bd6,#0b1a22)' },
];
export const frameCss = (id?: string | null) => FRAMES.find((f) => f.id === id)?.css || null;

// 签到轮:每 30 次签到一轮(漏签不清零,只是晚点拿)。每 2 次一个小奖(经验),每 5 次一个大奖:
//   5 / 20 → 下一个签到头像框    10 / 25 → 下一个签到动态背景
//   15 → 免费海龟汤 ×2            30 → 免费跑团 / 剧本杀 ×1
// 头像框、背景按 CHECKIN_FRAMES / CHECKIN_BGS 的顺序一个个解锁,一轮 2 个;全拿完以后那一格改成 +60 经验。
export const ROUND = 30;
export const CHECKIN_FRAMES = ['frost', 'mist', 'tide', 'watch', 'lotus', 'starlit', 'crimson', 'aurora'];
// 新背景只要:nightbg.js 的 THEMES 加一项 + BG_META 加一项 + 把 id 排进这里
export const CHECKIN_BGS = ['snow', 'sakura', 'storm'];
export type NodeKind = 'xp' | 'frame' | 'bg' | 'light' | 'game';
export type Node = { n: number; big: boolean; kind: NodeKind; xp?: number; count?: number };
export const ROUND_NODES: Node[] = [];
for (let n = 1; n <= ROUND; n++) {
  if (n % 5 === 0) ROUND_NODES.push({ n, big: true, kind: n === 30 ? 'game' : n === 15 ? 'light' : n === 5 || n === 20 ? 'frame' : 'bg', count: n === 15 ? 2 : n === 30 ? 1 : undefined, xp: n === 15 || n === 30 ? 50 : undefined });
  else if (n % 2 === 0) ROUND_NODES.push({ n, big: false, kind: 'xp', xp: 10 + Math.floor(n / 6) * 5 });
}
export const posOf = (k: number) => (k <= 0 ? 0 : ((k - 1) % ROUND) + 1);
export const nodeAt = (pos: number) => ROUND_NODES.find((x) => x.n === pos);
// 累计签到 total 次时:已经拿到几个框 / 几个背景 / 签到经验总共多少
export function checkinLoot(total: number) {
  let frames = 0, bgs = 0, xp = 0;
  for (let k = 1; k <= total; k++) {
    const nd = nodeAt(posOf(k)); if (!nd) continue;
    if (nd.xp) xp += nd.xp;
    if (nd.kind === 'frame') { if (frames < CHECKIN_FRAMES.length) frames++; else xp += 60; }
    if (nd.kind === 'bg') { if (bgs < CHECKIN_BGS.length) bgs++; else xp += 60; }
  }
  return { frames: CHECKIN_FRAMES.slice(0, frames), bgs: CHECKIN_BGS.slice(0, bgs), xp };
}
// 第 k 次签到时这一格具体给什么(日历上展示用)
export function rewardAt(k: number): { kind: NodeKind; big: boolean; xp?: number; count?: number; id?: string } | null {
  const nd = nodeAt(posOf(k)); if (!nd) return null;
  if (nd.kind === 'frame' || nd.kind === 'bg') {
    const before = checkinLoot(k - 1); const list = nd.kind === 'frame' ? CHECKIN_FRAMES : CHECKIN_BGS;
    const got = nd.kind === 'frame' ? before.frames.length : before.bgs.length;
    return got < list.length ? { kind: nd.kind, big: true, id: list[got] } : { kind: 'xp', big: true, xp: 60 };
  }
  return { kind: nd.kind, big: nd.big, xp: nd.xp, count: nd.count };
}
// 累计到 total 次时,一共该发多少免费局(轻玩法 / 豪华局),以及走到了几个发局的格子
export function gameNodesUpTo(total: number) {
  const hits: { kind: 'light' | 'game'; count: number }[] = [];
  for (let k = 1; k <= total; k++) { const nd = nodeAt(posOf(k)); if (nd && (nd.kind === 'light' || nd.kind === 'game')) hits.push({ kind: nd.kind, count: nd.count || 1 }); }
  return hits;
}

// 动态背景:谜夜首页的夜景换不同的天气和氛围。解锁后在「我的」里换
export type Bg = { id: string; zh: string; en: string; dzh: string; den: string; test: (s: Partial<ProgStats> & { level: number }) => boolean; swatch: string };
export const BGS: Bg[] = [
  { id: 'night', zh: '月夜', en: 'Moonlit Night', dzh: '默认', den: 'Default', test: () => true, swatch: 'linear-gradient(180deg,#080a16,#1a1c26 70%,#0a0b0f)' },
  { id: 'snow', zh: '雪夜', en: 'Snow Night', dzh: '签到大奖', den: 'Check-in reward', test: (s) => checkinLoot(s.checkins || 0).bgs.includes('snow'), swatch: 'linear-gradient(180deg,#0b1526,#2a3a52 70%,#0d1420)' },
  { id: 'sakura', zh: '樱夜', en: 'Blossom Night', dzh: '签到大奖', den: 'Check-in reward', test: (s) => checkinLoot(s.checkins || 0).bgs.includes('sakura'), swatch: 'linear-gradient(180deg,#1a0f22,#4a2a48 70%,#140b16)' },
  { id: 'storm', zh: '雷雨', en: 'Thunderstorm', dzh: '签到大奖', den: 'Check-in reward', test: (s) => checkinLoot(s.checkins || 0).bgs.includes('storm'), swatch: 'linear-gradient(180deg,#05070c,#1c2230 70%,#07080b)' },
  { id: 'bloodmoon', zh: '血月', en: 'Blood Moon', dzh: '升到 8 级', den: 'Reach level 8', test: (s) => s.level >= 8, swatch: 'linear-gradient(180deg,#14060a,#3a0f14 70%,#0b0507)' },
  { id: 'abyss', zh: '深渊', en: 'The Abyss', dzh: '升到 15 级', den: 'Reach level 15', test: (s) => s.level >= 15, swatch: 'linear-gradient(180deg,#02100f,#0b2a2c 70%,#020809)' },
];

export function streakFrom(days: string[], today: string): { current: number; best: number } {
  const set = new Set(days); const asc = Array.from(set).sort();
  let best = 0, run = 0, prev = 0;
  for (const d of asc) { const t = Date.parse(d + 'T12:00:00Z'); run = prev && t - prev <= 86400000 * 1.1 ? run + 1 : 1; best = Math.max(best, run); prev = t; }
  let current = 0; let t = Date.parse(today + 'T12:00:00Z');
  if (!set.has(today)) t -= 86400000; // 今天还没打,从昨天往回数
  while (set.has(new Date(t).toISOString().slice(0, 10))) { current++; t -= 86400000; }
  return { current, best };
}
