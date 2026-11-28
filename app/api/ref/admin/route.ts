// 站长:所有推广人、待付金额、标记已付、调整分成比例 / 期限
import { NextResponse } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';
import { partnerStats, cleanCode, newCode } from '@/lib/referral';
export const dynamic = 'force-dynamic';

const ADMIN = (process.env.ADMIN_EMAIL || 'yxhzdm@gmail.com').toLowerCase();
async function owner() { const { data: { user } } = await createServerClient().auth.getUser(); return user && String(user.email || '').toLowerCase() === ADMIN ? user : null; }
export async function GET() {
  if (!(await owner())) return NextResponse.json({ ok: false }, { status: 403 });
  const admin = createAdminClient();
  const { data: ps } = await admin.from('ref_partners').select('*').order('created_at', { ascending: false }).limit(200);
  const out = [];
  for (const p of ps || []) out.push({ code: p.code, name: p.name || '', note: p.note || '', bound: !!p.user_id, email: p.email, rate: Number(p.rate), months: p.months, payout: p.payout || '', clicks: p.clicks, created: p.created_at, ...(await partnerStats(admin, p.code)) });
  return NextResponse.json({ ok: true, partners: out });
}
export async function POST(req: Request) {
  if (!(await owner())) return NextResponse.json({ ok: false }, { status: 403 });
  const b = await req.json().catch(() => ({} as any));
  const admin = createAdminClient();
  const code = String(b?.code || '');
  if (b?.action === 'create') {
    const email = String(b?.email || '').trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return NextResponse.json({ ok: false, reason: 'email' }, { status: 400 });
    const c = cleanCode(b?.code) || newCode();
    if (c.length < 3) return NextResponse.json({ ok: false, reason: 'short' }, { status: 400 });
    const { data: taken } = await admin.from('ref_partners').select('code').eq('code', c).maybeSingle();
    if (taken) return NextResponse.json({ ok: false, reason: 'taken' }, { status: 409 });
    const { data: ex } = await admin.from('ref_partners').select('code').ilike('email', email).maybeSingle();
    if (ex) return NextResponse.json({ ok: false, reason: 'exists' }, { status: 409 });
    // 对方已经注册过谜夜就直接绑上;没注册的话第一次登录 /partner 时绑定
    const { data: u } = await admin.from('users').select('id').ilike('email', email).maybeSingle();
    const rate = Math.min(0.9, Math.max(0, Number(b?.rate ?? 0.4))); const months = Math.min(120, Math.max(1, Math.round(Number(b?.months ?? 3))));
    const { error } = await admin.from('ref_partners').insert({ code: c, email, user_id: u?.id || null, name: String(b?.name || '').slice(0, 60) || null, note: String(b?.note || '').slice(0, 300) || null, rate, months, payout: String(b?.payout || '').slice(0, 200) || null });
    if (error) return NextResponse.json({ ok: false, reason: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, code: c });
  }
  if (b?.action === 'paid') { await admin.from('ref_commissions').update({ status: 'paid', paid_at: new Date().toISOString() }).eq('code', code).eq('status', 'pending'); return NextResponse.json({ ok: true }); }
  if (b?.action === 'terms') {
    const rate = Math.min(0.9, Math.max(0, Number(b?.rate))); const months = Math.min(120, Math.max(1, Math.round(Number(b?.months))));
    if (!Number.isFinite(rate) || !Number.isFinite(months)) return NextResponse.json({ ok: false }, { status: 400 });
    await admin.from('ref_partners').update({ rate, months }).eq('code', code); return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ ok: false }, { status: 400 });
}
