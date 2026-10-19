// 发好友请求。若对方已给我发过请求，则直接互相通过。hattie 不参与公共好友图。
import { NextResponse } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
const HIDDEN = 'hattieichinose@gmail.com';

export async function POST(req: Request) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.is_anonymous || !user.email || user.email === HIDDEN) return NextResponse.json({ ok: false, reason: 'login' }, { status: 401 });
  let body: any = {}; try { body = await req.json(); } catch {}
  const toUserId = body?.toUserId;
  if (!toUserId || typeof toUserId !== 'string' || toUserId === user.id) return NextResponse.json({ ok: false, reason: 'bad' }, { status: 400 });
  const admin = createAdminClient();
  const { data: target } = await admin.from('users').select('id, email').eq('id', toUserId).maybeSingle();
  if (!target || !target.email || target.email === HIDDEN) return NextResponse.json({ ok: false, reason: 'notfound' }, { status: 404 });

  // 对方已经请求过我 → 直接通过
  const { data: rev } = await admin.from('friendships').select('id, status').eq('from_user', toUserId).eq('to_user', user.id).maybeSingle();
  if (rev) {
    if (rev.status !== 'accepted') await admin.from('friendships').update({ status: 'accepted', updated_at: new Date().toISOString() }).eq('id', rev.id);
    return NextResponse.json({ ok: true, accepted: true });
  }
  // 已存在我→对方的关系：幂等
  const { data: mine } = await admin.from('friendships').select('id, status').eq('from_user', user.id).eq('to_user', toUserId).maybeSingle();
  if (mine) return NextResponse.json({ ok: true, already: mine.status });
  const { error: insErr } = await admin.from('friendships').insert({ from_user: user.id, to_user: toUserId, status: 'pending' });
  if (insErr) return NextResponse.json({ ok: false, reason: 'db', detail: insErr.message }, { status: 500 });
  return NextResponse.json({ ok: true, requested: true });
}
