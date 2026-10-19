// Stripe webhook：支付完成 → 给对应账号充值局数。带事件去重，避免重复充值。
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { getStripe } from '@/lib/billing/stripe';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const sig = req.headers.get('stripe-signature') || '';
  const whSecret = process.env.STRIPE_WEBHOOK_SECRET || '';
  const body = await req.text();

  let event: any;
  try {
    const stripe = getStripe();
    event = stripe.webhooks.constructEvent(body, sig, whSecret);
  } catch (e: any) {
    return NextResponse.json({ error: '签名校验失败：' + e.message }, { status: 400 });
  }

  const admin = createAdminClient();
  // 去重：同一事件只处理一次
  const { error: dupErr } = await admin.from('billing_events').insert({ id: event.id });
  if (dupErr) return NextResponse.json({ received: true, duplicate: true });

  function addInterval(from: Date, interval: string) {
    const d = new Date(from);
    if (interval === 'year') d.setUTCFullYear(d.getUTCFullYear() + 1);
    else d.setUTCMonth(d.getUTCMonth() + 1);
    return d;
  }

  if (event.type === 'checkout.session.completed') {
    const s = event.data.object;
    const userId = s.metadata?.user_id || s.client_reference_id;
    const customer = typeof s.customer === 'string' ? s.customer : null;
    if (s.mode === 'subscription' && userId) {
      const interval = s.metadata?.interval || 'month';
      const until = addInterval(new Date(), interval);
      await admin.from('profiles').upsert(
        { user_id: userId, member_until: until.toISOString(), member_interval: interval, stripe_customer_id: customer, stripe_subscription_id: typeof s.subscription === 'string' ? s.subscription : null },
        { onConflict: 'user_id' }
      );
    } else {
      const games = parseInt(s.metadata?.games || '0', 10);
      if (userId && games > 0) {
        const { data: p } = await admin.from('profiles').select('credits').eq('user_id', userId).maybeSingle();
        await admin.from('profiles').upsert(
          { user_id: userId, credits: (p?.credits || 0) + games, stripe_customer_id: customer },
          { onConflict: 'user_id' }
        );
      }
    }
  } else if (event.type === 'invoice.paid') {
    const inv = event.data.object;
    if (inv.billing_reason === 'subscription_cycle') {
      const customer = typeof inv.customer === 'string' ? inv.customer : null;
      if (customer) {
        const { data: p } = await admin.from('profiles').select('user_id, member_until, member_interval').eq('stripe_customer_id', customer).maybeSingle();
        if (p) {
          const base = p.member_until && new Date(p.member_until) > new Date() ? new Date(p.member_until) : new Date();
          await admin.from('profiles').update({ member_until: addInterval(base, p.member_interval || 'month').toISOString() }).eq('user_id', p.user_id);
        }
      }
    }
  } else if (event.type === 'customer.subscription.deleted') {
    const sub = event.data.object;
    const customer = typeof sub.customer === 'string' ? sub.customer : null;
    if (customer) await admin.from('profiles').update({ member_until: new Date().toISOString() }).eq('stripe_customer_id', customer);
  }
  return NextResponse.json({ received: true });
}
