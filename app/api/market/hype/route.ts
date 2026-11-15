// 炒作身价：花现金主动拉高自己的身价（现金 → 身价的途径）。成本随身价上涨而变贵。
import { NextResponse } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';
import { ensureProfile, feed } from '@/lib/market/engine';
export const dynamic = 'force-dynamic';
export async function POST() {
  const supabase = createServerClient(); const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.is_anonymous || !user.email) return NextResponse.json({ ok: false }, { status: 401 });
  const admin = createAdminClient();
  const me = await ensureProfile(admin, user.id);
  const cost = Math.round(me.price * 0.5);
  const gain = Math.round(me.price * 0.25);
  if (me.cash < cost) return NextResponse.json({ ok: false, reason: 'poor', need: cost, have: me.cash }, { status: 400 });
  const newCash = me.cash - cost; const newPrice = me.price + gain;
  await admin.from('market_profiles').update({ cash: newCash, price: newPrice, exp: me.exp + 5 }).eq('user_id', user.id);
  const { data: mu } = await admin.from('users').select('display_name').eq('id', user.id).maybeSingle();
  await feed(admin, `${mu?.display_name || '玩家'} 炒作身价 +${gain}`);
  return NextResponse.json({ ok: true, text: `炒作成功 · 身价 +${gain}`, cost, newPrice });
}
