// 当前账号的开房额度状态（给收费页 / 落地页用）。走 getEntitlement，确保一次性免费额度在登录看首页时就发放。
import { NextResponse } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';
import { getEntitlement } from '@/lib/billing/entitlement';

export async function GET() {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.is_anonymous || !user.email) {
    return NextResponse.json({ loggedIn: false });
  }
  const admin = createAdminClient();
  const ent = await getEntitlement(admin, user);
  admin.from('users').update({ last_seen: new Date().toISOString() }).eq('id', user.id).then(() => {}, () => {});
  const { data: prof } = await admin.from('users').select('display_name, bio, avatar_url').eq('id', user.id).maybeSingle();
  return NextResponse.json({ loggedIn: true, userId: user.id, email: ent.email, whitelisted: ent.whitelisted, member: ent.member, credits: ent.credits, freeSecondsUsed: ent.freeSecondsUsed, freeSecondsLimit: ent.freeSecondsLimit, memberPremiumUsed: ent.memberPremiumUsed, memberPremiumLimit: ent.memberPremiumLimit, displayName: prof?.display_name || null, bio: prof?.bio || null, avatarUrl: prof?.avatar_url || null });
}
