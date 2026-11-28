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
    // 推广分成:这笔付款(含订阅的第一期)
    if (userId && s.payment_status !== 'unpaid' && Number(s.amount_total) > 0) {
      try { const { recordCommission } = await import('@/lib/referral'); await recordCommission(admin, { key: s.id, userId, amount: Number(s.amount_total), currency: s.currency, paymentIntent: typeof s.payment_intent === 'string' ? s.payment_intent : null, invoice: typeof s.invoice === 'string' ? s.invoice : null, what: s.mode === 'subscription' ? `member_${s.metadata?.interval || 'month'}` : (s.metadata?.kind || (s.metadata?.games ? `games${s.metadata.games}` : 'payment')) }); } catch {}
    }
    if (s.mode === 'subscription' && userId) {
      const interval = s.metadata?.interval || 'month';
      const until = addInterval(new Date(), interval);
      await admin.from('profiles').upsert(
        { user_id: userId, member_until: until.toISOString(), member_interval: interval, stripe_customer_id: customer, stripe_subscription_id: typeof s.subscription === 'string' ? s.subscription : null },
        { onConflict: 'user_id' }
      );
    } else if (userId && (s.metadata?.kind === 'card30' || s.metadata?.kind === 'card365')) {
      // 一次性会员卡(支付宝 / 微信支付 / 卡):从现有会员到期日往后加 30 / 365 天,不动订阅信息
      const { data: p } = await admin.from('profiles').select('member_until').eq('user_id', userId).maybeSingle();
      const base = p?.member_until && new Date(p.member_until) > new Date() ? new Date(p.member_until) : new Date();
      const days = s.metadata.kind === 'card365' ? 365 : 30;
      await admin.from('profiles').upsert({ user_id: userId, member_until: new Date(base.getTime() + days * 86400000).toISOString(), ...(customer ? { stripe_customer_id: customer } : {}) }, { onConflict: 'user_id' });
    } else if (userId && s.metadata?.kind === 'custom1') {
      const { data: p } = await admin.from('profiles').select('custom_credits').eq('user_id', userId).maybeSingle();
      await admin.from('profiles').upsert({ user_id: userId, custom_credits: (p?.custom_credits || 0) + 1, ...(customer ? { stripe_customer_id: customer } : {}) }, { onConflict: 'user_id' });
    } else if (userId && s.metadata?.kind === 'party3h') {
      const { data: p } = await admin.from('profiles').select('party_until').eq('user_id', userId).maybeSingle();
      const base = p?.party_until && new Date(p.party_until) > new Date() ? new Date(p.party_until) : new Date();
      await admin.from('profiles').upsert({ user_id: userId, party_until: new Date(base.getTime() + 3 * 3600 * 1000).toISOString(), ...(customer ? { stripe_customer_id: customer } : {}) }, { onConflict: 'user_id' });
    } else if (userId && (s.metadata?.kind === 'light1' || s.metadata?.kind === 'pass2h')) {
      const { data: p } = await admin.from('profiles').select('light_credits, pass_until').eq('user_id', userId).maybeSingle();
      if (s.metadata.kind === 'light1') {
        await admin.from('profiles').upsert({ user_id: userId, light_credits: (p?.light_credits || 0) + 1, ...(customer ? { stripe_customer_id: customer } : {}) }, { onConflict: 'user_id' });
      } else {
        // 2 小时：从现在算；已有未用完的畅玩卡就接着往后加
        const base = p?.pass_until && new Date(p.pass_until) > new Date() ? new Date(p.pass_until) : new Date();
        await admin.from('profiles').upsert({ user_id: userId, pass_until: new Date(base.getTime() + 2 * 3600 * 1000).toISOString(), ...(customer ? { stripe_customer_id: customer } : {}) }, { onConflict: 'user_id' });
      }
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
          // 推广分成:会员续费
          try { const { recordCommission } = await import('@/lib/referral'); await recordCommission(admin, { key: inv.id, userId: p.user_id, amount: Number(inv.amount_paid), currency: inv.currency, paymentIntent: typeof inv.payment_intent === 'string' ? inv.payment_intent : null, invoice: inv.id, what: `renew_${p.member_interval || 'month'}` }); } catch {}
          const base = p.member_until && new Date(p.member_until) > new Date() ? new Date(p.member_until) : new Date();
          await admin.from('profiles').update({ member_until: addInterval(base, p.member_interval || 'month').toISOString() }).eq('user_id', p.user_id);
        }
      }
    }
  } else if (event.type === 'charge.refunded') {
    // 退款:对应的推广分成作废
    const ch = event.data.object;
    try { const { reverseCommission } = await import('@/lib/referral'); await reverseCommission(admin, typeof ch.payment_intent === 'string' ? ch.payment_intent : null, typeof ch.invoice === 'string' ? ch.invoice : null); } catch {}
  } else if (event.type === 'customer.subscription.deleted') {
    const sub = event.data.object;
    const customer = typeof sub.customer === 'string' ? sub.customer : null;
    if (customer) await admin.from('profiles').update({ member_until: new Date().toISOString() }).eq('stripe_customer_id', customer);
  }
  return NextResponse.json({ received: true });
}
