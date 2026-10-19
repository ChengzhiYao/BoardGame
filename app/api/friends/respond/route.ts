// 同意/拒绝一条收到的好友请求。
import { NextResponse } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.is_anonymous || !user.email) return NextResponse.json({ ok: false, reason: 'login' }, { status: 401 });
  let body: any = {}; try { body = await req.json(); } catch {}
  const fromUserId = body?.fromUserId; const accept = !!body?.accept;
  if (!fromUserId || typeof fromUserId !== 'string') return NextResponse.json({ ok: false, reason: 'bad' }, { status: 400 });
  const admin = createAdminClient();
  const { data: row } = await admin.from('friendships').select('id, status').eq('from_user', fromUserId).eq('to_user', user.id).eq('status', 'pending').maybeSingle();
  if (!row) return NextResponse.json({ ok: false, reason: 'notfound' }, { status: 404 });
  if (accept) await admin.from('friendships').update({ status: 'accepted', updated_at: new Date().toISOString() }).eq('id', row.id);
  else await admin.from('friendships').delete().eq('id', row.id);
  return NextResponse.json({ ok: true });
}
