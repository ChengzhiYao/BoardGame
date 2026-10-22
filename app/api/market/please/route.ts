// 讨好主人：若自己正被持有，随机获得一点小钱（偶尔身价微涨）。
import { NextResponse } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';
import { ensureProfile, questBump } from '@/lib/market/engine';
export const dynamic = 'force-dynamic';
export async function POST() {
  const supabase = createServerClient(); const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.is_anonymous || !user.email) return NextResponse.json({ ok: false }, { status: 401 });
  const admin = createAdminClient();
  const me = await ensureProfile(admin, user.id);
  if (!me.owner_id) return NextResponse.json({ ok: false, reason: 'free' }, { status: 400 });
  const gain = Math.round(20 + Math.random() * 60);
  const dPrice = Math.random() < 0.4 ? Math.round(me.price * 0.02) : 0;
  await admin.from('market_profiles').update({ cash: me.cash + gain, price: me.price + dPrice, exp: me.exp + 5, ...questBump(me, 'q_social') }).eq('user_id', user.id);
  return NextResponse.json({ ok: true, gain, dPrice });
}
