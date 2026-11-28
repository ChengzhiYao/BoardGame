// 站长:所有推广人、待付金额、标记已付、调整分成比例 / 期限
import { NextResponse } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';
import { partnerStats } from '@/lib/referral';
export const dynamic = 'force-dynamic';

const ADMIN = (process.env.ADMIN_EMAIL || 'yxhzdm@gmail.com').toLowerCase();
async function owner() { const { data: { user } } = await createServerClient().auth.getUser(); return user && String(user.email || '').toLowerCase() === ADMIN ? user : null; }
export async function GET() {
  if (!(await owner())) return NextResponse.json({ ok: false }, { status: 403 });
  const admin = createAdminClient();
  const { data: ps } = await admin.from('ref_partners').select('*').order('created_at', { ascending: false }).limit(200);
  const out = [];
  for (const p of ps || []) out.push({ code: p.code, email: p.email, rate: Number(p.rate), months: p.months, payout: p.payout || '', clicks: p.clicks, created: p.created_at, ...(await partnerStats(admin, p.code)) });
  return NextResponse.json({ ok: true, partners: out });
}
export async function POST(req: Request) {
  if (!(await owner())) return NextResponse.json({ ok: false }, { status: 403 });
  const b = await req.json().catch(() => ({} as any));
  const admin = createAdminClient();
  const code = String(b?.code || '');
  if (b?.action === 'paid') { await admin.from('ref_commissions').update({ status: 'paid', paid_at: new Date().toISOString() }).eq('code', code).eq('status', 'pending'); return NextResponse.json({ ok: true }); }
  if (b?.action === 'terms') {
    const rate = Math.min(0.9, Math.max(0, Number(b?.rate))); const months = Math.min(120, Math.max(1, Math.round(Number(b?.months))));
    if (!Number.isFinite(rate) || !Number.isFinite(months)) return NextResponse.json({ ok: false }, { status: 400 });
    await admin.from('ref_partners').update({ rate, months }).eq('code', code); return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ ok: false }, { status: 400 });
}
