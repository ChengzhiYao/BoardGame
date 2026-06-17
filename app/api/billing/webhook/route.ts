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

  if (event.type === 'checkout.session.completed') {
    const s = event.data.object;
    const userId = s.metadata?.user_id || s.client_reference_id;
    const games = parseInt(s.metadata?.games || '0', 10);
    if (userId && games > 0) {
      const { data: p } = await admin.from('profiles').select('credits').eq('user_id', userId).maybeSingle();
      const cur = p?.credits || 0;
      await admin.from('profiles').upsert(
        { user_id: userId, credits: cur + games, stripe_customer_id: typeof s.customer === 'string' ? s.customer : null },
        { onConflict: 'user_id' }
      );
    }
  }
  return NextResponse.json({ received: true });
}
