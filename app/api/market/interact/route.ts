// 安抚 / 折磨 持有的好友：随机结果（现金与身价小幅变化，整体接近中性）。
import { NextResponse } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';
import { ensureProfile } from '@/lib/market/engine';
export const dynamic = 'force-dynamic';
export async function POST(req: Request) {
  const supabase = createServerClient(); const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.is_anonymous || !user.email) return NextResponse.json({ ok: false }, { status: 401 });
  let b: any = {}; try { b = await req.json(); } catch {}
  const kind = b?.kind === 'torment' ? 'torment' : 'soothe';
  const admin = createAdminClient();
  const t = await ensureProfile(admin, b?.targetId || '');
  if (t.owner_id !== user.id) return NextResponse.json({ ok: false, reason: 'not_yours' }, { status: 400 });
  const me = await ensureProfile(admin, user.id);
  let dCash = Math.round((Math.random() * 80) - 30);     // -30 ~ +50
  let dPrice = kind === 'soothe' ? Math.round(t.price * 0.03) : Math.round((Math.random() - 0.4) * t.price * 0.08);
  const newCash = Math.max(0, me.cash + dCash);
  const newPrice = Math.max(100, t.price + dPrice);
  await admin.from('market_profiles').update({ cash: newCash }).eq('user_id', user.id);
  await admin.from('market_profiles').update({ price: newPrice }).eq('user_id', t.user_id);
  return NextResponse.json({ ok: true, dCash, dPrice, kind });
}
