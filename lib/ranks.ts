// 排行榜：每个人的局数 / 猜中 / 猜中率 / 每日一汤 / 结局 / 称号，按本周或全部时间排名，算出"超过了多少玩家"
export const CATS = ['games', 'solved', 'rate', 'daily', 'endings', 'badges'] as const;
export type Cat = typeof CATS[number];
export const CAT_LABEL: Record<Cat, [string, string, string, string]> = {
  games: ['游玩局数', 'Games played', '局', 'games'],
  solved: ['猜中海龟汤', 'Soups cracked', '碗', 'soups'],
  rate: ['猜中率', 'Crack rate', '%', '%'],
  daily: ['每日一汤', 'Daily Soups cracked', '天', 'days'],
  endings: ['打到结局', 'Endings reached', '个', 'endings'],
  badges: ['称号', 'Titles', '个', 'titles'],
};
export const RATE_MIN = 5;

export function valueOf(r: any, c: Cat): number | null {
  if (c === 'games') return r.games;
  if (c === 'solved') return r.soup_solved;
  if (c === 'rate') return r.soup_done >= RATE_MIN ? Math.round((r.soup_solved / r.soup_done) * 100) : null;
  if (c === 'daily') return r.daily_solved;
  if (c === 'endings') return r.endings;
  return r.badges;
}

export async function rankAll(admin: any, win: 'week' | 'all') {
  const since = win === 'week' ? new Date(Date.now() - 7 * 86400000).toISOString() : '2000-01-01T00:00:00Z';
  const { data } = await admin.rpc('lb_stats', { since });
  return (data || []) as any[];
}

// 一个分类里：排好序的列表 + 某人的名次和"超过 x%"
export function rankCat(rows: any[], c: Cat, me?: string | null) {
  const list = rows.map((r) => ({ id: r.user_id, v: valueOf(r, c), sub: c === 'rate' ? r.soup_done : null })).filter((x) => x.v !== null && (x.v as number) > 0) as { id: string; v: number; sub: number | null }[];
  list.sort((a, b) => b.v - a.v || (b.sub || 0) - (a.sub || 0));
  const total = list.length;
  let mine: any = null;
  if (me) {
    const m = list.find((x) => x.id === me);
    if (m) {
      const rank = list.filter((x) => x.v > m.v).length + 1;
      const below = list.filter((x) => x.v < m.v).length;
      // 全站玩过的人都算进"超过"的分母（没上这个榜的人也被你超过了）
      const everyone = rows.length;
      const beat = everyone > 1 ? Math.round(((below + (everyone - total)) / (everyone - 1)) * 100) : 100;
      mine = { rank, value: m.v, beat: Math.min(99, beat), total };
    } else mine = { rank: null, value: 0, beat: 0, total };
  }
  return { list, total, mine };
}
