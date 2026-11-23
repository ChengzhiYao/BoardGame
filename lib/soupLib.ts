// 海龟汤题库的公开页面（SEO）：列表 + 单题页。汤底只公开"已经当过每日一汤"的题（往期），其余要自己玩才揭晓。
import { createAdminClient } from '@/lib/supabase/server';

export const clean = (s: string) => String(s || '').replace(/^【汤面】/, '').replace(/\n\n你们可以提是非题[\s\S]*$/, '').trim();
export const TONE_ZH: Record<string, string> = { 悬疑: '悬疑', 惊悚: '惊悚', 温情: '温情', 黑色幽默: '黑色幽默', 搞笑: '搞笑' };

export async function listSoups(lang: 'zh' | 'en') {
  const admin = createAdminClient();
  const { data } = await admin.from('soup_library').select('id, title, surface, difficulty, tone, supernatural, horror, plays, solved, created_at').eq('lang', lang).order('created_at', { ascending: false }).limit(1000);
  const { data: past } = await admin.from('daily_soup').select('lib_id, no, day').eq('lang', lang);
  const today = new Date().toISOString().slice(0, 10);
  const answered = new Map<string, number>(((past || []) as any[]).filter((p) => String(p.day) < today).map((p) => [p.lib_id, p.no]));
  return ((data || []) as any[]).filter((p) => p.title && p.surface).map((p) => ({ ...p, surface: clean(p.surface), dailyNo: answered.get(p.id) || null }));
}

export async function getSoup(lang: 'zh' | 'en', id: string) {
  const admin = createAdminClient();
  const { data: p } = await admin.from('soup_library').select('id, lang, title, surface, bottom, difficulty, tone, supernatural, horror, gore, plays, solved, created_at').eq('id', id).maybeSingle();
  if (!p || p.lang !== lang || !p.title) return null;
  const { data: d } = await admin.from('daily_soup').select('no, day').eq('lib_id', id).eq('lang', lang).maybeSingle();
  const today = new Date().toISOString().slice(0, 10);
  const showAnswer = !!(d && String(d.day) < today);
  return { ...p, surface: clean(p.surface), bottom: showAnswer ? p.bottom : null, dailyNo: d?.no || null };
}

export function tagsOf(p: any, en: boolean) {
  const t: string[] = [];
  if (p.difficulty) t.push(en ? ({ 普通: 'Normal', 困难: 'Hard', 地狱: 'Brutal' } as any)[p.difficulty] || p.difficulty : p.difficulty);
  if (p.tone && p.tone !== 'any') t.push(en ? ({ 悬疑: 'Mystery', 惊悚: 'Thriller', 温情: 'Heartwarming', 黑色幽默: 'Dark humor', 搞笑: 'Funny' } as any)[p.tone] || p.tone : p.tone);
  if (p.supernatural === 'allow') t.push(en ? 'Supernatural' : '灵异');
  if (p.supernatural === 'real') t.push(en ? 'Realistic' : '纯现实');
  if ((p.horror || 0) >= 50) t.push(en ? 'Scary' : '恐怖');
  return t;
}
