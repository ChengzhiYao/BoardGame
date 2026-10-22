// 给持有的玩家起绰号（或清空自己的绰号）。
import { NextResponse } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';
import { ensureProfile } from '@/lib/market/engine';
export const dynamic = 'force-dynamic';
export async function POST(req: Request) {
  const supabase = createServerClient(); const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.is_anonymous || !user.email) return NextResponse.json({ ok: false }, { status: 401 });
  let b: any = {}; try { b = await req.json(); } catch {}
  const targetId = b?.targetId || user.id;
  const name = (b?.name || '').toString().trim().slice(0, 16) || null;
  const admin = createAdminClient();
  if (targetId !== user.id) {
    const t = await ensureProfile(admin, targetId);
    if (t.owner_id !== user.id) return NextResponse.json({ ok: false, reason: 'not_yours' }, { status: 400 });
  } else { await ensureProfile(admin, user.id); }
  await admin.from('market_profiles').update({ nickname: name }).eq('user_id', targetId);
  return NextResponse.json({ ok: true, nickname: name });
}
