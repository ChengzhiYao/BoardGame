// 释放持有的玩家（恢复其自由身）。
import { NextResponse } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';
import { ensureProfile, feed } from '@/lib/market/engine';
export const dynamic = 'force-dynamic';
export async function POST(req: Request) {
  const supabase = createServerClient(); const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.is_anonymous || !user.email) return NextResponse.json({ ok: false }, { status: 401 });
  let b: any = {}; try { b = await req.json(); } catch {}
  const admin = createAdminClient();
  const t = await ensureProfile(admin, b?.targetId || '');
  if (t.owner_id !== user.id) return NextResponse.json({ ok: false, reason: 'not_yours' }, { status: 400 });
  await admin.from('market_profiles').update({ owner_id: null, nickname: null }).eq('user_id', t.user_id);
  const { data: tu } = await admin.from('users').select('display_name').eq('id', t.user_id).maybeSingle();
  const { data: mu } = await admin.from('users').select('display_name').eq('id', user.id).maybeSingle();
  await feed(admin, `${mu?.display_name || '玩家'} 释放了 ${tu?.display_name || '好友'}`);
  return NextResponse.json({ ok: true });
}
