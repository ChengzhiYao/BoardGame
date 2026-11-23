// 每日一汤：全站同一天同一道题（中英文各一道），每人每天一次正式挑战；成绩、连续天数、排名都在这里算。
// 断签保护：会员 / 畅玩卡 / 派对夜卡用户，每 7 天里漏掉 1 天不算断。

export type Lang = 'zh' | 'en';

// 中文按北京时间换日，英文按美东时间换日
export function dayKey(lang: Lang, d = new Date()): string {
  const tz = lang === 'en' ? 'America/New_York' : 'Asia/Shanghai';
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}
export function addDays(day: string, n: number): string {
  const t = new Date(day + 'T12:00:00Z'); t.setUTCDate(t.getUTCDate() + n);
  return t.toISOString().slice(0, 10);
}

// 今天的题：没有就从题库挑一道（优先被人猜中过的、普通难度、没当过每日题的），按日期做种子保证稳定
export async function ensureDaily(admin: any, lang: Lang, day = dayKey(lang)) {
  const { data: have } = await admin.from('daily_soup').select('day, no, lib_id').eq('day', day).eq('lang', lang).maybeSingle();
  if (have) return have;
  const { data: used } = await admin.from('daily_soup').select('lib_id, no').eq('lang', lang);
  const usedIds = new Set((used || []).map((u: any) => u.lib_id));
  const no = (used || []).reduce((m: number, u: any) => Math.max(m, u.no || 0), 0) + 1;
  const { data: lib } = await admin.from('soup_library').select('id, difficulty, plays, solved, bottom_audio').eq('lang', lang).limit(1000);
  const pool = (lib || []).filter((p: any) => !usedIds.has(p.id));
  const all = pool.length ? pool : (lib || []);
  if (!all.length) return null;
  const score = (p: any) => (p.solved > 0 ? 4 : 0) + (p.difficulty === '普通' ? 2 : 0) + (p.bottom_audio ? 1 : 0) - Math.min(3, (p.plays || 0) * 0.5);
  const best = Math.max(...all.map(score));
  const top = all.filter((p: any) => score(p) >= best - 1);
  let seed = 0; for (const ch of day + lang) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
  const pick = top[seed % top.length];
  const { error } = await admin.from('daily_soup').insert({ day, lang, no, lib_id: pick.id });
  if (error) { const { data: again } = await admin.from('daily_soup').select('day, no, lib_id').eq('day', day).eq('lang', lang).maybeSingle(); return again; }
  return { day, no, lib_id: pick.id };
}

const GRID: Record<string, string> = { '是': '🟩', '不是': '🟥', '无关': '⬜', '是也不是': '🟨' };

// 这局的成绩（只记第一次挑战）
export async function recordDaily(admin: any, roomId: string, solved: boolean) {
  try {
    const { data: room } = await admin.from('rooms').select('daily_day, language, host_user_id, created_at').eq('id', roomId).maybeSingle();
    if (!room?.daily_day) return null;
    const lang: Lang = room.language === 'en' ? 'en' : 'zh';
    // 补玩往期不进那天的排行
    if (dayKey(lang, new Date(room.created_at)) !== room.daily_day) return null;
    const { data: pz } = await admin.from('soup_puzzles').select('created_at').eq('room_id', roomId).maybeSingle();
    const { data: msgs } = await admin.from('messages').select('sender_type, content, payload').eq('room_id', roomId).order('created_at', { ascending: true }).limit(400);
    const qs = (msgs || []).filter((m: any) => m.sender_type === 'player' && !String(m.content || '').startsWith('【揭晓】')).length;
    const hints = (msgs || []).filter((m: any) => m.payload?.type === 'soup_hint' && !m.payload?.auto).length;
    const grid = (msgs || []).filter((m: any) => m.sender_type === 'kp' && m.payload?.type === 'soup_answer' && m.payload?.verdict).map((m: any) => GRID[m.payload.verdict] || '⬜').join('');
    const seconds = pz?.created_at ? Math.round((Date.now() - new Date(pz.created_at).getTime()) / 1000) : 0;
    const row = { day: room.daily_day, lang, user_id: room.host_user_id, room_id: roomId, questions: qs, hints, seconds, solved, grid: grid + (solved ? '✅' : '❌') };
    await admin.from('daily_results').upsert(row, { onConflict: 'day,lang,user_id', ignoreDuplicates: true });
    return row;
  } catch { return null; }
}

// 连续天数：从今天（没玩就从昨天）往回数；有保护的人每 7 天可以漏 1 天
export function streakOf(days: string[], today: string, protectedUser: boolean): { streak: number; savedDays: number } {
  const set = new Set(days);
  let d = set.has(today) ? today : addDays(today, -1);
  let streak = 0, saved = 0, lastSave = -99, i = 0;
  while (i < 400) {
    if (set.has(d)) { streak++; }
    else if (protectedUser && streak > 0 && i - lastSave >= 7 && set.has(addDays(d, -1))) { saved++; lastSave = i; }
    else break;
    d = addDays(d, -1); i++;
  }
  return { streak, savedDays: saved };
}

// 成绩排序：猜中的在前，问得少的在前，提示少、用时短的在前
export function rankKey(r: any) { return (r.solved ? 0 : 1e9) + (r.questions || 0) * 1e5 + (r.hints || 0) * 1e4 + Math.min(9999, r.seconds || 0); }

export function fmtSecs(s: number, en: boolean) { const m = Math.floor(s / 60), x = s % 60; return en ? `${m}m ${x}s` : `${m}分${x}秒`; }

export function shareText(r: any, no: number, en: boolean, streak: number) {
  const head = en ? `MystNight Daily Soup #${no}` : `谜夜 · 每日一汤 #${no}`;
  const line = r.solved
    ? (en ? `Solved in ${r.questions} questions${r.hints ? ` · ${r.hints} hint${r.hints > 1 ? 's' : ''}` : ' · no hints'}` : `${r.questions} 问破案${r.hints ? ` · 用了 ${r.hints} 个提示` : ' · 没看提示'}`)
    : (en ? `Couldn't crack it after ${r.questions} questions` : `问了 ${r.questions} 问，还是没猜出来`);
  const g = String(r.grid || '');
  const rows = g ? (Array.from(g).join('').match(/(?:\p{Extended_Pictographic}️?|.){1,10}/gu) || []).join('\n') : '';
  const st = streak > 1 ? (en ? `🔥 ${streak}-day streak` : `🔥 连续 ${streak} 天`) : '';
  return [head, line, rows, st, 'mystnight.com/daily'].filter(Boolean).join('\n');
}
