// 发起购买：为选定局数包创建 Stripe Checkout 会话（一次性付款），返回支付链接。
import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { getStripe } from '@/lib/billing/stripe';
import { packById, CURRENCY } from '@/lib/billing/plans';
import { MEMBERSHIP } from '@/lib/pricing';
import { LIGHT_PRICE, PASS_PRICE, PARTY_PRICE } from '@/lib/billing/light';

export const runtime = 'nodejs';

// 一次性付款(局数、畅玩卡、会员卡……)同时开放支付宝和微信支付,方便没有外币信用卡的中国玩家。
// Stripe 只支持这两种做一次性付款,不支持自动续费,所以订阅仍然只能刷卡。
// 需要在 Stripe 后台「设置 → 付款方式」里打开 Alipay 和 WeChat Pay;没打开时这里会报错,自动退回只用卡,不影响购买。
async function oneTime(stripe: any, params: any) {
  // 哪个还没开通(比如还在审核)就只去掉哪个,另一个照样能用
  let types = ['card', 'alipay', 'wechat_pay'];
  for (let i = 0; i < 3; i++) {
    try {
      return await stripe.checkout.sessions.create({ ...params, payment_method_types: types, ...(types.includes('wechat_pay') ? { payment_method_options: { wechat_pay: { client: 'web' } } } : {}) });
    } catch (e: any) {
      const msg = String(e?.message || '');
      const bad = types.find((t) => t !== 'card' && msg.includes(`type provided: ${t} `));
      console.warn('[checkout] payment method unavailable:', bad || 'unknown', '-', msg.slice(0, 160));
      if (!bad) break;
      types = types.filter((t) => t !== bad);
      if (types.length === 1) break;
    }
  }
  return await stripe.checkout.sessions.create(params);
}

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

  // 会员卡:一次性付款买 30 天 / 365 天会员,不自动续费(给用支付宝、微信支付的玩家;到期后可以再买)
  if (body.plan === 'card30' || body.plan === 'card365') {
    const yr = body.plan === 'card365';
    try {
      const stripe = getStripe();
      const session = await oneTime(stripe, {
        mode: 'payment',
        line_items: [{ quantity: 1, price_data: { currency: CURRENCY, unit_amount: yr ? MEMBERSHIP.yearly.price : MEMBERSHIP.monthly.price, product_data: { name: yr ? 'MystNight Membership · 365 days' : 'MystNight Membership · 30 days', description: 'One-time payment, no auto-renewal' } } }],
        success_url: `${site}${rt}${sep}member=1`, cancel_url: `${site}/upgrade?canceled=1`,
        client_reference_id: user.id, customer_email: user.email, metadata: { user_id: user.id, kind: body.plan },
      });
      return NextResponse.json({ url: session.url });
    } catch (e: any) { return NextResponse.json({ error: '创建支付会话失败：' + e.message }, { status: 500 }); }
  }

  if (body.plan === 'custom1') {
    try {
      const stripe = getStripe();
      const session = await oneTime(stripe, {
        mode: 'payment',
        line_items: [{ quantity: 1, price_data: { currency: CURRENCY, unit_amount: 990, product_data: { name: 'MystNight · Custom murder mystery', description: 'A murder mystery written around your friends — their names, nicknames and inside jokes' } } }],
        success_url: `${site}${rt}${sep}paid=1`, cancel_url: `${site}${rt}`,
        client_reference_id: user.id, customer_email: user.email, metadata: { user_id: user.id, kind: 'custom1' },
      });
      return NextResponse.json({ url: session.url });
    } catch (e: any) { return NextResponse.json({ error: '创建支付会话失败：' + e.message }, { status: 500 }); }
  }
  if (body.plan === 'party3h') {
    try {
      const stripe = getStripe();
      const session = await oneTime(stripe, {
        mode: 'payment',
        line_items: [{ quantity: 1, price_data: { currency: CURRENCY, unit_amount: PARTY_PRICE, product_data: { name: 'MystNight · Party Night Pass', description: '3 hours: every game including Murder Mystery and Call of Cthulhu — your friends play free' } } }],
        success_url: `${site}${rt}${sep}paid=1`, cancel_url: `${site}${rt}`,
        client_reference_id: user.id, customer_email: user.email, metadata: { user_id: user.id, kind: 'party3h' },
      });
      return NextResponse.json({ url: session.url });
    } catch (e: any) { return NextResponse.json({ error: '创建支付会话失败：' + e.message }, { status: 500 }); }
  }
  if (body.plan === 'light1' || body.plan === 'pass2h') {
    const one = body.plan === 'light1';
    try {
      const stripe = getStripe();
      const session = await oneTime(stripe, {
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
    const session = await oneTime(stripe, {
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
