// 合作方自己:看专属链接、数据、填收款方式。邀请制:站长在 /partner/admin 用对方邮箱加好,对方第一次登录时绑定到账号
import { NextResponse } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';
import { partnerStats, MIN_PAYOUT_USD } from '@/lib/referral';
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
  let { data: p } = await admin.from('ref_partners').select('*').eq('user_id', user.id).maybeSingle();
  if (!p) { // 站长用邮箱加的,第一次登录绑定
    const { data: inv } = await admin.from('ref_partners').select('*').ilike('email', String(user.email)).is('user_id', null).maybeSingle();
    if (inv) { await admin.from('ref_partners').update({ user_id: user.id }).eq('code', inv.code); p = { ...inv, user_id: user.id }; }
  }
  const origin = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.mystnight.com';
  if (!p) return NextResponse.json({ loggedIn: true, email: user.email, isAdmin, partner: null });
  return NextResponse.json({ loggedIn: true, email: user.email, isAdmin, minPayout: MIN_PAYOUT_USD, partner: { code: p.code, name: p.name || '', link: `${origin}/?ref=${p.code}`, rate: Number(p.rate), months: p.months, payout: p.payout || '', clicks: p.clicks }, stats: await partnerStats(admin, p.code) });
}
export async function POST(req: Request) {
  const user = await me();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  const b = await req.json().catch(() => ({} as any));
  const admin = createAdminClient();
  if (b?.action === 'payout') {
    const { error } = await admin.from('ref_partners').update({ payout: String(b?.payout || '').slice(0, 200) }).eq('user_id', user.id);
    if (error) return NextResponse.json({ ok: false }, { status: 400 });
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ ok: false }, { status: 400 });
}
