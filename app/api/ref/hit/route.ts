// 有人点了推广链接:记一次点击,浏览器记住这个推广代码 30 天(已经记过别的推广人就不覆盖)
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createAdminClient } from '@/lib/supabase/server';
import { REF_COOKIE, cleanCode } from '@/lib/referral';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const b = await req.json().catch(() => ({} as any));
  const code = cleanCode(b?.code);
  const res = NextResponse.json({ ok: true });
  if (!code || cookies().get(REF_COOKIE)?.value) return res;
  const admin = createAdminClient();
  const { data: p } = await admin.from('ref_partners').select('code, clicks').eq('code', code).maybeSingle();
  if (!p) return res;
  await admin.from('ref_partners').update({ clicks: (p.clicks || 0) + 1 }).eq('code', code);
  res.cookies.set(REF_COOKIE, code, { path: '/', maxAge: 30 * 86400, sameSite: 'lax', secure: true, httpOnly: true });
  return res;
}
