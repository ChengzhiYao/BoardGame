// 推广人自己:生成推广链接、看数据、填收款方式
import { NextResponse } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';
import { newCode, cleanCode, partnerStats, MIN_PAYOUT_USD } from '@/lib/referral';
export const dynamic = 'force-dynamic';

const ADMIN = (process.env.ADMIN_EMAIL || 'yxhzdm@gmail.com').toLowerCase();
async function me() {
  const { data: { user } } = await createServerClient().auth.getUser();
  return user && !user.is_anonymous && user.email ? user : null;
}
export async function GET() {
  const user = await me();
  if (!user) return NextResponse.json({ loggedIn: false });
  const admin = createAdminClient();
  const isAdmin = String(user.email).toLowerCase() === ADMIN;
  const { data: p } = await admin.from('ref_partners').select('*').eq('user_id', user.id).maybeSingle();
  const origin = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.mystnight.com';
  if (!p) return NextResponse.json({ loggedIn: true, email: user.email, isAdmin, partner: null });
  return NextResponse.json({ loggedIn: true, email: user.email, isAdmin, minPayout: MIN_PAYOUT_USD, partner: { code: p.code, link: `${origin}/?ref=${p.code}`, rate: Number(p.rate), months: p.months, payout: p.payout || '', clicks: p.clicks }, stats: await partnerStats(admin, p.code) });
}
export async function POST(req: Request) {
  const user = await me();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  const b = await req.json().catch(() => ({} as any));
  const admin = createAdminClient();
  if (b?.action === 'create') {
    const { data: ex } = await admin.from('ref_partners').select('code').eq('user_id', user.id).maybeSingle();
    if (ex) return NextResponse.json({ ok: true });
    const payoutInfo = String(b?.payout || '').trim().slice(0, 200);
    if (payoutInfo.length < 3) return NextResponse.json({ ok: false, reason: 'payout' }, { status: 400 });
    let code = cleanCode(b?.code);
    if (code && code.length < 3) return NextResponse.json({ ok: false, reason: 'short' }, { status: 400 });
    if (code) { const { data: taken } = await admin.from('ref_partners').select('code').eq('code', code).maybeSingle(); if (taken) return NextResponse.json({ ok: false, reason: 'taken' }, { status: 409 }); }
    for (let i = 0; i < 5; i++) {
      const c = code || newCode();
      const { error } = await admin.from('ref_partners').insert({ code: c, user_id: user.id, email: user.email, payout: payoutInfo });
      if (!error) return NextResponse.json({ ok: true });
      if (code) break;
    }
    return NextResponse.json({ ok: false }, { status: 500 });
  }
  if (b?.action === 'payout') {
    await admin.from('ref_partners').update({ payout: String(b?.payout || '').slice(0, 200) }).eq('user_id', user.id);
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ ok: false }, { status: 400 });
}
