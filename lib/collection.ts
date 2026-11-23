// 成长与收藏：从一个人玩过的所有局里算出战绩、称号、汤谱、结局、调查员档案。
import { streakOf, dayKey } from '@/lib/soup/daily';

export type Badge = { id: string; icon: string; zh: string; en: string; dzh: string; den: string; dark?: boolean; test: (s: Stats) => boolean };
export type Stats = {
  played: number; modes: number; soupPlayed: number; soupSolved: number; soupNoHint: number; soupSharp: number;
  dailyPlayed: number; dailyTop: number; streak: number; bestStreak: number;
  cocEndings: number; cocGood: number; cocBad: number; cocMad: number; cocVet: number;
  jbsDone: number; botcDone: number; mccPlayed: number; companion: number; bigHost: number;
  soupPeek: number; soupGrind: number; soupWrong: number; dailyFail: number; cocDead: number; cocInsane: number;
};

export const BADGES: Badge[] = [
  { id: 'first_soup', icon: '🥣', zh: '第一口汤', en: 'First Sip', dzh: '猜中第一碗海龟汤', den: 'Crack your first soup', test: (s) => s.soupSolved >= 1 },
  { id: 'soup10', icon: '🍲', zh: '老饕', en: 'Regular', dzh: '猜中 10 碗海龟汤', den: 'Crack 10 soups', test: (s) => s.soupSolved >= 10 },
  { id: 'soup50', icon: '👑', zh: '汤神', en: 'Soup Sage', dzh: '猜中 50 碗海龟汤', den: 'Crack 50 soups', test: (s) => s.soupSolved >= 50 },
  { id: 'nohint', icon: '🕯️', zh: '不靠提示', en: 'No Hints Needed', dzh: '不看提示猜中 5 碗', den: 'Crack 5 soups without hints', test: (s) => s.soupNoHint >= 5 },
  { id: 'sharp', icon: '👁️', zh: '一眼看穿', en: 'Sharp Eye', dzh: '5 问以内猜中一碗', den: 'Crack a soup in 5 questions or fewer', test: (s) => s.soupSharp >= 1 },
  { id: 'daily1', icon: '📅', zh: '今日之汤', en: 'Daily Diner', dzh: '完成一次每日一汤', den: 'Finish a Daily Soup', test: (s) => s.dailyPlayed >= 1 },
  { id: 'streak3', icon: '🔥', zh: '三日不断', en: 'Three in a Row', dzh: '每日一汤连续 3 天', den: '3-day Daily Soup streak', test: (s) => s.bestStreak >= 3 },
  { id: 'streak7', icon: '🔥', zh: '一周不断', en: 'Full Week', dzh: '每日一汤连续 7 天', den: '7-day streak', test: (s) => s.bestStreak >= 7 },
  { id: 'streak30', icon: '🌕', zh: '月月有汤', en: 'Moon Cycle', dzh: '每日一汤连续 30 天', den: '30-day streak', test: (s) => s.bestStreak >= 30 },
  { id: 'daily_top', icon: '🥇', zh: '今日榜首', en: 'Top of the Day', dzh: '在每日一汤拿过第一名', den: 'Finish #1 on a Daily Soup', test: (s) => s.dailyTop >= 1 },
  { id: 'coc_end', icon: '🗝️', zh: '走到结局', en: 'Saw It Through', dzh: '把一局克苏鲁跑团打到结局', den: 'Reach the end of a Call of Cthulhu story', test: (s) => s.cocEndings >= 1 },
  { id: 'coc_good', icon: '🌅', zh: '拨云见日', en: 'Dawn Breaks', dzh: '跑团打出好结局', den: 'Get a good ending', test: (s) => s.cocGood >= 1 },
  { id: 'coc_bad', icon: '🌑', zh: '深渊回望', en: 'The Abyss Looks Back', dzh: '跑团打出坏结局', den: 'Get a bad ending', test: (s) => s.cocBad >= 1 },
  { id: 'coc_mad', icon: '🌀', zh: '疯狂边缘', en: 'On the Edge', dzh: '理智不到 15 还撑到了结局', den: 'Reach an ending with Sanity under 15', test: (s) => s.cocMad >= 1 },
  { id: 'coc_vet', icon: '🎖️', zh: '老调查员', en: 'Veteran', dzh: '带同一个调查员走完两个故事', den: 'Take one investigator through two stories', test: (s) => s.cocVet >= 1 },
  { id: 'jbs1', icon: '🎭', zh: '落幕', en: 'Curtain Call', dzh: '完成一场剧本杀', den: 'Finish a murder mystery', test: (s) => s.jbsDone >= 1 },
  { id: 'jbs5', icon: '📜', zh: '老剧本人', en: 'Mystery Buff', dzh: '完成 5 场剧本杀', den: 'Finish 5 murder mysteries', test: (s) => s.jbsDone >= 5 },
  { id: 'botc', icon: '🕰️', zh: '钟楼常客', en: 'Bell Ringer', dzh: '完成一局血染钟楼', den: 'Finish a Bloodbound game', test: (s) => s.botcDone >= 1 },
  { id: 'mcc', icon: '🐈‍⬛', zh: '九命猫', en: 'Nine Lives', dzh: '玩一局猫猫炸弹', den: 'Play Cat Curse', test: (s) => s.mccPlayed >= 1 },
  { id: 'modes4', icon: '🎲', zh: '百戏通', en: 'Jack of All Games', dzh: '玩过 4 种不同玩法', den: 'Play 4 different games', test: (s) => s.modes >= 4 },
  { id: 'companion', icon: '💞', zh: '和 TA 一起', en: 'Together', dzh: '和 Linger 里的 TA 玩过一局', den: 'Play with your Linger companion', test: (s) => s.companion >= 1 },
  // —— 黑历史：没通关也算一种经历
  { id: 'peek1', icon: '🫣', zh: '偷看了一眼', en: 'Just a Peek', dzh: '第一次直接看了汤底', den: 'Peek at the truth for the first time', dark: true, test: (s) => s.soupPeek >= 1 },
  { id: 'peek10', icon: '🙈', zh: '好奇心害死猫', en: 'Curiosity Killed the Cat', dzh: '看了 10 次汤底', den: 'Peek at the truth 10 times', dark: true, test: (s) => s.soupPeek >= 10 },
  { id: 'grind', icon: '🪨', zh: '死磕到底', en: 'Stubborn', dzh: '问了 30 问以上才猜中', den: 'Crack a soup after 30+ questions', dark: true, test: (s) => s.soupGrind >= 1 },
  { id: 'wrong3', icon: '🌀', zh: '越猜越歪', en: 'Way Off', dzh: '一碗汤里说错 3 次真相', den: 'Guess wrong 3 times in one soup', dark: true, test: (s) => s.soupWrong >= 1 },
  { id: 'daily_fail', icon: '🥀', zh: '今日败北', en: 'Not Today', dzh: '每日一汤没猜出来', den: 'Miss a Daily Soup', dark: true, test: (s) => s.dailyFail >= 1 },
  { id: 'coc_dead', icon: '🪦', zh: '安息', en: 'Rest in Peace', dzh: '调查员死在了故事里', den: 'Lose an investigator to death', dark: true, test: (s) => s.cocDead >= 1 },
  { id: 'coc_insane', icon: '🫥', zh: '再也回不来', en: 'Gone Mad', dzh: '调查员彻底疯了', den: 'Lose an investigator to madness', dark: true, test: (s) => s.cocInsane >= 1 },
  { id: 'host', icon: '🏮', zh: '局长', en: 'The Organizer', dzh: '开过一局 3 个真人以上的局', den: 'Host a game with 3+ people', test: (s) => s.bigHost >= 1 },
];

const isOut = (c: any) => { const f = c?.status_flags || {}; return !!(f.dead || f.retired) || (c?.hp_current ?? 1) <= 0 || (c?.san_current ?? 1) <= 0; };

export async function collect(admin: any, userId: string, lang: 'zh' | 'en' = 'zh', full = true) {
  const { data: mp } = await admin.from('players').select('id, room_id, seat').eq('user_id', userId).order('joined_at', { ascending: false }).limit(800);
  const myPlayers = mp || [];
  const roomIds = Array.from(new Set(myPlayers.map((p: any) => p.room_id)));
  const { data: rs } = roomIds.length ? await admin.from('rooms').select('id, mode, name, game_state, created_at, companion, host_user_id, campaign_id, scene_state, language').in('id', roomIds) : { data: [] as any[] };
  const rooms = rs || [];
  const byMode = (m: string) => rooms.filter((r: any) => r.mode === m);
  const ended = (r: any) => r.game_state === 'ended';

  // —— 海龟汤
  const soupRooms = byMode('soup');
  const { data: pz } = soupRooms.length ? await admin.from('soup_puzzles').select('id, room_id, title, surface, status, created_at').in('room_id', soupRooms.map((r: any) => r.id)) : { data: [] as any[] };
  const puzzles = pz || [];
  const solvedP = puzzles.filter((p: any) => p.status === 'solved');
  const doneP = puzzles.filter((p: any) => p.status === 'solved' || p.status === 'revealed');
  const { data: sm } = doneP.length ? await admin.from('messages').select('room_id, sender_type, content, payload').in('room_id', doneP.slice(0, 300).map((p: any) => p.room_id)).in('sender_type', ['player', 'kp']).limit(12000) : { data: [] as any[] };
  const per: Record<string, { q: number; h: number; w: number }> = {};
  for (const m of sm || []) {
    const k = per[m.room_id] || (per[m.room_id] = { q: 0, h: 0, w: 0 });
    if (m.sender_type === 'player' && !String(m.content || '').startsWith('【揭晓】')) k.q++;
    if (m.payload?.type === 'soup_hint' && !m.payload?.auto) k.h++;
    if (m.sender_type === 'kp' && m.payload?.type === 'soup_answer' && /^❌/.test(String(m.content || ''))) k.w++;
  }
  const soupNoHint = solvedP.filter((p: any) => (per[p.room_id]?.h || 0) === 0).length;
  const soupSharp = solvedP.filter((p: any) => (per[p.room_id]?.q ?? 99) <= 5).length;

  // —— 每日一汤
  const { data: dr } = await admin.from('daily_results').select('day, lang, solved, questions, hints, seconds').eq('user_id', userId).order('day', { ascending: false }).limit(800);
  const dailyMine = (dr || []).filter((r: any) => r.lang === lang);
  const days = dailyMine.map((r: any) => String(r.day));
  let best = 0, run = 0; const asc = days.slice().sort();
  for (let i = 0; i < asc.length; i++) { const prev = i ? new Date(asc[i - 1] + 'T12:00:00Z').getTime() : 0; const cur = new Date(asc[i] + 'T12:00:00Z').getTime(); run = i && cur - prev <= 86400000 * 1.1 ? run + 1 : 1; best = Math.max(best, run); }
  const { streak } = streakOf(days, dayKey(lang), false);
  let dailyTop = 0;
  const solvedDays = dailyMine.filter((r: any) => r.solved).map((r: any) => r.day).slice(0, 60);
  if (solvedDays.length) {
    const { data: all } = await admin.from('daily_results').select('day, user_id, questions, hints, seconds, solved').eq('lang', lang).in('day', solvedDays).limit(5000);
    const { rankKey } = await import('@/lib/soup/daily');
    for (const d of solvedDays) { const l = (all || []).filter((x: any) => x.day === d).sort((a: any, b: any) => rankKey(a) - rankKey(b)); if (l[0]?.user_id === userId) dailyTop++; }
  }

  // —— 克苏鲁
  const cocRooms = byMode('coc');
  const myPids = myPlayers.map((p: any) => p.id);
  const { data: chs } = myPids.length ? await admin.from('characters').select('id, room_id, name, occupation, avatar_url, hp_current, hp_max, san_current, san_max, san_start, status_flags, veteran, is_complete').in('player_id', myPids) : { data: [] as any[] };
  const cocIds = new Set(cocRooms.map((r: any) => r.id));
  const chars = (chs || []).filter((c: any) => cocIds.has(c.room_id) && c.is_complete);
  const { data: em } = cocRooms.length ? await admin.from('messages').select('room_id, content, created_at').in('room_id', cocRooms.map((r: any) => r.id)).eq('payload->>type', 'ending').limit(500) : { data: [] as any[] };
  const camps = cocRooms.map((r: any) => r.campaign_id).filter(Boolean);
  const { data: cps } = camps.length ? await admin.from('campaigns').select('id, title').in('id', camps) : { data: [] as any[] };
  const endings = (em || []).map((m: any) => {
    const r = cocRooms.find((x: any) => x.id === m.room_id);
    const txt = String(m.content || '').replace(/^【结局】/, '');
    const nm = txt.match(/^《+([^》]+)》+（([^）]+)）/);
    const kind = /好结局|good/i.test(nm?.[2] || '') ? 'good' : /坏结局|bad/i.test(nm?.[2] || '') || r?.scene_state === 'BAD_ENDING' ? 'bad' : /隐藏/.test(nm?.[2] || '') ? 'hidden' : 'bitter';
    const ch = chars.find((c: any) => c.room_id === m.room_id);
    return { room: m.room_id, at: m.created_at, story: (cps || []).find((c: any) => c.id === r?.campaign_id)?.title || r?.name || '', name: nm?.[1] || '', kind, label: nm?.[2] || '', text: txt.replace(/^《+[^》]+》+（[^）]+）\n?/, '').slice(0, 280), who: ch ? { name: ch.name, alive: !isOut(ch), san: ch.san_current } : null };
  });
  const endedRooms = new Set(endings.map((e: any) => e.room));
  const cocMad = chars.filter((c: any) => endedRooms.has(c.room_id) && !isOut(c) && (c.san_current ?? 99) < 15).length;
  const investigators = chars.map((c: any) => {
    const r = cocRooms.find((x: any) => x.id === c.room_id);
    const done = endedRooms.has(c.room_id);
    const fate = isOut(c) ? ((c.status_flags?.dead || (c.hp_current ?? 1) <= 0) ? 'dead' : 'mad') : done ? 'survived' : r && ended(r) ? 'left' : 'playing';
    return { id: c.id, name: c.name, occupation: c.occupation, avatar: c.avatar_url, hp: c.hp_current, hpMax: c.hp_max, san: c.san_current, sanMax: c.san_max, sanStart: c.san_start, fate, story: (cps || []).find((x: any) => x.id === r?.campaign_id)?.title || r?.name || '', runs: c.veteran?.runs || 1, at: r?.created_at };
  }).sort((a: any, b: any) => String(b.at).localeCompare(String(a.at)));

  // —— 剧本杀 / 血染 / 猫
  const jbsEnded = byMode('jbs').filter(ended);
  const stats: Stats = {
    played: rooms.length,
    modes: new Set(rooms.filter((r: any) => r.mode !== 'soup' || puzzles.some((p: any) => p.room_id === r.id)).map((r: any) => r.mode)).size,
    soupPlayed: doneP.length, soupSolved: solvedP.length, soupNoHint, soupSharp,
    dailyPlayed: dailyMine.length, dailyTop, streak, bestStreak: best,
    cocEndings: endings.length, cocGood: endings.filter((e: any) => e.kind === 'good').length, cocBad: endings.filter((e: any) => e.kind === 'bad').length, cocMad,
    cocVet: chars.filter((c: any) => (c.veteran?.runs || 1) >= 2 && endedRooms.has(c.room_id)).length,
    jbsDone: jbsEnded.length, botcDone: byMode('botc').filter(ended).length, mccPlayed: byMode('mcc').length,
    companion: rooms.filter((r: any) => r.companion?.name).length, bigHost: 0,
    soupPeek: doneP.length - solvedP.length,
    soupGrind: solvedP.filter((p: any) => (per[p.room_id]?.q || 0) >= 30).length,
    soupWrong: doneP.filter((p: any) => (per[p.room_id]?.w || 0) >= 3).length,
    dailyFail: dailyMine.filter((r: any) => !r.solved).length,
    cocDead: chars.filter((c: any) => !!c.status_flags?.dead || (c.hp_current ?? 1) <= 0).length,
    cocInsane: chars.filter((c: any) => !(c.status_flags?.dead || (c.hp_current ?? 1) <= 0) && (c.status_flags?.retired || (c.san_current ?? 1) <= 0)).length,
  };
  const hosted = rooms.filter((r: any) => r.host_user_id === userId && !r.companion).map((r: any) => r.id).slice(0, 300);
  if (hosted.length) {
    const { data: pc } = await admin.from('players').select('room_id').in('room_id', hosted).limit(3000);
    const cnt: Record<string, number> = {}; for (const p of pc || []) cnt[p.room_id] = (cnt[p.room_id] || 0) + 1;
    stats.bigHost = Object.values(cnt).filter((n) => n >= 3).length;
  }
  const earned = BADGES.filter((b) => b.test(stats)).map((b) => b.id);
  if (!full) return { stats, earned };

  // 汤谱（结束的汤，含汤底）
  const { data: bots } = doneP.length ? await admin.from('soup_bottoms').select('puzzle_id, bottom').in('puzzle_id', doneP.slice(0, 200).map((p: any) => p.id)) : { data: [] as any[] };
  const soups = doneP.slice(0, 200).sort((a: any, b: any) => String(b.created_at).localeCompare(String(a.created_at))).map((p: any) => ({
    id: p.id, title: p.title, surface: String(p.surface || '').replace(/^【汤面】/, '').replace(/\n\n你们可以提是非题[\s\S]*$/, '').trim(), bottom: (bots || []).find((b: any) => b.puzzle_id === p.id)?.bottom || '',
    solved: p.status === 'solved', questions: per[p.room_id]?.q ?? null, hints: per[p.room_id]?.h ?? null, at: p.created_at,
  }));
  const jbs = jbsEnded.slice(0, 50).map((r: any) => ({ room: r.id, name: r.name, at: r.created_at }));
  return { stats, earned, soups, endings: endings.sort((a: any, b: any) => String(b.at).localeCompare(String(a.at))), investigators, jbs };
}
