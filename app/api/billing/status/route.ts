// 当前账号的开房额度状态（给收费页 / 落地页用）。走 getEntitlement，确保一次性免费额度在登录看首页时就发放。
import { NextResponse } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';
import { getEntitlement } from '@/lib/billing/entitlement';

export async function GET(req: Request) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.is_anonymous || !user.email) {
    return NextResponse.json({ loggedIn: false });
  }
  const admin = createAdminClient();
  const ent = await getEntitlement(admin, user);
  // 顺便记录最近在线 + 城市（Vercel geo header），不依赖前端 JS 版本
  try {
    const dec = (h: string) => { const v = req.headers.get(h) || ''; try { return decodeURIComponent(v); } catch { return v; } };
    const city = dec('x-vercel-ip-city');
    const region = (req.headers.get('x-vercel-ip-country-region') || '').toUpperCase();
    const country = (req.headers.get('x-vercel-ip-country') || '').toUpperCase();
    const patch: any = { last_seen: new Date().toISOString() };
    if (city) patch.city = city;
    if (region) patch.region = region;
    if (country) patch.country = country;
    admin.from('users').update(patch).eq('id', user.id).then(() => {}, () => {});
  } catch { admin.from('users').update({ last_seen: new Date().toISOString() }).eq('id', user.id).then(() => {}, () => {}); }
  const { data: prof } = await admin.from('users').select('display_name, bio, avatar_url').eq('id', user.id).maybeSingle();
  return NextResponse.json({ loggedIn: true, userId: user.id, email: ent.email, whitelisted: ent.whitelisted, member: ent.member, credits: ent.credits, freeSecondsUsed: ent.freeSecondsUsed, freeSecondsLimit: ent.freeSecondsLimit, memberPremiumUsed: ent.memberPremiumUsed, memberPremiumLimit: ent.memberPremiumLimit, displayName: prof?.display_name || null, bio: prof?.bio || null, avatarUrl: prof?.avatar_url || null });
}
