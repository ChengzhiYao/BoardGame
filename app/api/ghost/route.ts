// 今夜怪谈：?lang= 今晚这篇（人人免费，不用登录）；?id= 往期（会员 / 畅玩卡 / 派对夜卡）
import { NextResponse } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';
import { tonight, publicStory } from '@/lib/ghost';

export const dynamic = 'force-dynamic';

async function canPast(admin: any, user: any) {
  if (!user) return false;
  const { data: p } = await admin.from('profiles').select('is_whitelisted, member_until, pass_until, party_until').eq('user_id', user.id).maybeSingle();
  const now = new Date();
  return !!(p?.is_whitelisted || [p?.member_until, p?.pass_until, p?.party_until].some((x: any) => x && new Date(x) > now));
}

export async function GET(req: Request) {
  const u = new URL(req.url);
  const lang = u.searchParams.get('lang') === 'en' ? 'en' : 'zh';
  const id = u.searchParams.get('id');
  const admin = createAdminClient();
  const { data: { user } } = await createServerClient().auth.getUser();
  const past = await canPast(admin, user);
  const t = await tonight(admin, lang);
  let story: any = null, locked = false;
  if (id && id !== t?.id) {
    const { data: s } = await admin.from('ghost_stories').select('*').eq('id', id).eq('status', 'ready').maybeSingle();
    if (s) { locked = !past; story = publicStory(s, !locked); }
  } else if (t) story = publicStory(t, true);
  if (story && !locked && !id) { try { await admin.from('ghost_stories').update({ plays: (t.plays || 0) + 1 }).eq('id', t.id); } catch {} }
  const { data: arc } = await admin.from('ghost_stories').select('id, title, teaser, day, no, seconds, style, fear').eq('lang', lang).not('day', 'is', null).neq('id', t?.id || '00000000-0000-0000-0000-000000000000').order('day', { ascending: false }).limit(30);
  return NextResponse.json({ ok: !!story, story, locked, canPast: past, loggedIn: !!user?.email, tonightId: t?.id || null, archive: arc || [] });
}
