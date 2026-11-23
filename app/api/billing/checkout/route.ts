// 发起购买：为选定局数包创建 Stripe Checkout 会话（一次性付款），返回支付链接。
import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { getStripe } from '@/lib/billing/stripe';
import { packById, CURRENCY } from '@/lib/billing/plans';
import { MEMBERSHIP } from '@/lib/pricing';
import { LIGHT_PRICE, PASS_PRICE } from '@/lib/billing/light';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.is_anonymous || !user.email) {
    return NextResponse.json({ error: '请先用 Google 登录再购买。' }, { status: 401 });
  }
  const body = await req.json().catch(() => ({} as any));
  const site = process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin;
  const rt = typeof body.returnTo === 'string' && body.returnTo.startsWith('/') ? body.returnTo : '/upgrade';
  const sep = rt.includes('?') ? '&' : '?';

  if (body.plan === 'monthly' || body.plan === 'yearly') {
    const m = body.plan === 'yearly' ? MEMBERSHIP.yearly : MEMBERSHIP.monthly;
    try {
      const stripe = getStripe();
      const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        line_items: [{ quantity: 1, price_data: { currency: CURRENCY, unit_amount: m.price, recurring: { interval: m.interval }, product_data: { name: `MystNight Membership (${m.interval === 'year' ? 'Yearly' : 'Monthly'})`, description: 'Unlimited play on all modes' } } }],
        success_url: `${site}${rt}${sep}member=1`,
        cancel_url: `${site}/upgrade?canceled=1`,
        client_reference_id: user.id,
        customer_email: user.email,
        metadata: { user_id: user.id, plan: body.plan, interval: m.interval },
        subscription_data: { metadata: { user_id: user.id, plan: body.plan, interval: m.interval } },
      });
      return NextResponse.json({ url: session.url });
    } catch (e: any) {
      return NextResponse.json({ error: '创建订阅会话失败：' + e.message }, { status: 500 });
    }
  }

  if (body.plan === 'light1' || body.plan === 'pass2h') {
    const one = body.plan === 'light1';
    try {
      const stripe = getStripe();
      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        line_items: [{ quantity: 1, price_data: { currency: CURRENCY, unit_amount: one ? LIGHT_PRICE : PASS_PRICE, product_data: { name: one ? 'MystNight · One more game' : 'MystNight · 2-hour pass', description: one ? 'One game of Lateral Soup or Cat Curse' : '2 hours of unlimited Lateral Soup and Cat Curse' } } }],
        success_url: `${site}${rt}${sep}paid=1`,
        cancel_url: `${site}${rt}`,
        client_reference_id: user.id,
        customer_email: user.email,
        metadata: { user_id: user.id, kind: body.plan },
      });
      return NextResponse.json({ url: session.url });
    } catch (e: any) {
      return NextResponse.json({ error: '创建支付会话失败：' + e.message }, { status: 500 });
    }
  }

  const pack = packById(body.packId);
  if (!pack) return NextResponse.json({ error: '套餐不存在' }, { status: 400 });

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
