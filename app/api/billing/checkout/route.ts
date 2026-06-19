// 发起购买：为选定局数包创建 Stripe Checkout 会话（一次性付款），返回支付链接。
import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { getStripe } from '@/lib/billing/stripe';
import { packById, CURRENCY } from '@/lib/billing/plans';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.is_anonymous || !user.email) {
    return NextResponse.json({ error: '请先用 Google 登录再购买。' }, { status: 401 });
  }
  const { packId } = await req.json().catch(() => ({} as any));
  const pack = packById(packId);
  if (!pack) return NextResponse.json({ error: '套餐不存在' }, { status: 400 });

  const site = process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin;
  try {
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{
        quantity: 1,
        price_data: {
          currency: CURRENCY,
          unit_amount: pack.price,
          product_data: { name: `MystNight · ${pack.label.en}`, description: `+${pack.games} hosting credits (all modes)` },
        },
      }],
      success_url: `${site}/upgrade?paid=1`,
      cancel_url: `${site}/upgrade?canceled=1`,
      client_reference_id: user.id,
      customer_email: user.email,
      metadata: { user_id: user.id, games: String(pack.games), pack: pack.id },
    });
    return NextResponse.json({ url: session.url });
  } catch (e: any) {
    return NextResponse.json({ error: '创建支付会话失败：' + e.message }, { status: 500 });
  }
}
