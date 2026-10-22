// 退出 / 重新加入市场。退出时解除被持有。
import { NextResponse } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';
import { ensureProfile } from '@/lib/market/engine';
export const dynamic = 'force-dynamic';
export async function POST(req: Request) {
  const supabase = createServerClient(); const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.is_anonymous || !user.email) return NextResponse.json({ ok: false }, { status: 401 });
  let b: any = {}; try { b = await req.json(); } catch {}
  const out = !!b?.out;
  const admin = createAdminClient();
  await ensureProfile(admin, user.id);
  const patch: any = { opted_out: out };
  if (out) patch.owner_id = null;
  await admin.from('market_profiles').update(patch).eq('user_id', user.id);
  return NextResponse.json({ ok: true, optedOut: out });
}
