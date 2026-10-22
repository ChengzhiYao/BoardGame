// 赎身：付自己当前身价脱离主人，获得 3 天保护期。
import { NextResponse } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';
import { ensureProfile, OWNER_SHARE, PROTECT_DAYS, feed } from '@/lib/market/engine';
export const dynamic = 'force-dynamic';
export async function POST() {
  const supabase = createServerClient(); const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.is_anonymous || !user.email) return NextResponse.json({ ok: false }, { status: 401 });
  const admin = createAdminClient();
  const me = await ensureProfile(admin, user.id);
  if (!me.owner_id) return NextResponse.json({ ok: false, reason: 'free' }, { status: 400 });
  const cost = me.price;
  if (me.cash < cost) return NextResponse.json({ ok: false, reason: 'poor', need: cost, have: me.cash }, { status: 400 });
  const prevOwner = me.owner_id;
  const until = new Date(Date.now() + PROTECT_DAYS * 86400 * 1000).toISOString();
  await admin.from('market_profiles').update({ cash: me.cash - cost, owner_id: null, protected_until: until }).eq('user_id', user.id);
  if (prevOwner) { const { data: po } = await admin.from('market_profiles').select('cash').eq('user_id', prevOwner).maybeSingle(); await admin.from('market_profiles').update({ cash: (po?.cash || 0) + Math.round(cost * OWNER_SHARE) }).eq('user_id', prevOwner); }
  const { data: mu } = await admin.from('users').select('display_name').eq('id', user.id).maybeSingle();
  await feed(admin, `${mu?.display_name || '玩家'} 花 ${cost} 赎身,获得 ${PROTECT_DAYS} 天保护`);
  return NextResponse.json({ ok: true, cost });
}
