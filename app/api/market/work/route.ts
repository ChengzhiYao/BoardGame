// 派持有的好友去打工：owner 得随机现金，期间对方受保护不可被买。
import { NextResponse } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';
import { ensureProfile, isWorking, feed, questBump } from '@/lib/market/engine';
export const dynamic = 'force-dynamic';
export async function POST(req: Request) {
  const supabase = createServerClient(); const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.is_anonymous || !user.email) return NextResponse.json({ ok: false }, { status: 401 });
  let b: any = {}; try { b = await req.json(); } catch {}
  const admin = createAdminClient();
  const t = await ensureProfile(admin, b?.targetId || '');
  if (t.owner_id !== user.id) return NextResponse.json({ ok: false, reason: 'not_yours' }, { status: 400 });
  if (isWorking(t)) return NextResponse.json({ ok: false, reason: 'busy' }, { status: 400 });
  const me = await ensureProfile(admin, user.id);
  const earn = Math.round(t.price * (0.06 + Math.random() * 0.1)); // 身价的 6%~16%
  const until = new Date(Date.now() + 2 * 3600 * 1000).toISOString();
  await admin.from('market_profiles').update({ working_until: until }).eq('user_id', t.user_id);
  await admin.from('market_profiles').update({ cash: me.cash + earn, exp: me.exp + 8, ...questBump(me, 'q_work') }).eq('user_id', user.id);
  const { data: tu } = await admin.from('users').select('display_name').eq('id', t.user_id).maybeSingle();
  const { data: mu } = await admin.from('users').select('display_name').eq('id', user.id).maybeSingle();
  await feed(admin, `${mu?.display_name || '玩家'} 派 ${tu?.display_name || '好友'} 去打工,赚了 ${earn}`);
  return NextResponse.json({ ok: true, earn });
}
