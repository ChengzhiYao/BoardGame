// 命运卡：每天一次，随机现金或身价变化。
import { NextResponse } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';
import { ensureProfile, today, feed } from '@/lib/market/engine';
export const dynamic = 'force-dynamic';
export async function POST() {
  const supabase = createServerClient(); const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.is_anonymous || !user.email) return NextResponse.json({ ok: false }, { status: 401 });
  const admin = createAdminClient();
  const me = await ensureProfile(admin, user.id);
  if (me.last_fate === today()) return NextResponse.json({ ok: false, reason: 'used' });
  const roll = Math.random();
  let text = '', dCash = 0, dPrice = 0;
  if (roll < 0.45) { dCash = Math.round(100 + Math.random() * 300); text = `天降横财 +${dCash}`; }
  else if (roll < 0.7) { dCash = -Math.round(50 + Math.random() * 150); text = `破财 ${dCash}`; }
  else if (roll < 0.9) { dPrice = Math.round(me.price * (0.1 + Math.random() * 0.2)); text = `身价暴涨 +${dPrice}`; }
  else { dPrice = -Math.round(me.price * (0.05 + Math.random() * 0.1)); text = `身价下跌 ${dPrice}`; }
  const newCash = Math.max(0, me.cash + dCash); const newPrice = Math.max(100, me.price + dPrice);
  await admin.from('market_profiles').update({ cash: newCash, price: newPrice, last_fate: today() }).eq('user_id', user.id);
  const { data: mu } = await admin.from('users').select('display_name').eq('id', user.id).maybeSingle();
  await feed(admin, `${mu?.display_name || '玩家'} 抽到命运卡:${text}`);
  return NextResponse.json({ ok: true, text, dCash, dPrice });
}
