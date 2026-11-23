// 我的收藏：战绩、称号、汤谱、结局、调查员档案
import { NextResponse } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';
import { collect, BADGES } from '@/lib/collection';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function GET(req: Request) {
  const { data: { user } } = await createServerClient().auth.getUser();
  if (!user) return NextResponse.json({ loggedIn: false });
  const lang = new URL(req.url).searchParams.get('lang') === 'en' ? 'en' : 'zh';
  const admin = createAdminClient();
  const c: any = await collect(admin, user.id, lang, true);
  // 打开收藏页也顺便把称号记下来（以后不重复弹）
  try { await admin.from('profiles').update({ badges: c.earned }).eq('user_id', user.id); } catch {}
  const badges = BADGES.map((b) => ({ id: b.id, icon: b.icon, zh: b.zh, en: b.en, dzh: b.dzh, den: b.den, earned: c.earned.includes(b.id) }));
  const { data: u } = await admin.from('users').select('display_name, avatar_url').eq('id', user.id).maybeSingle();
  return NextResponse.json({ loggedIn: true, name: u?.display_name || '', avatar: u?.avatar_url || '', ...c, badges });
}
