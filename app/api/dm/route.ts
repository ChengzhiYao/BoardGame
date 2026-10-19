// 持久化私信：GET ?with=<userId> 取与某人的历史并标记已读；POST {toUserId,text} 发送。
// 非好友：从我发给对方的消息累计 ≤1 条，互相加好友后解除。hattie 不参与公共私信。
import { NextResponse } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
const HIDDEN = 'hattieichinose@gmail.com';

async function areFriends(admin: any, a: string, b: string) {
  const { data } = await admin.from('friendships').select('id')
    .eq('status', 'accepted')
    .or(`and(from_user.eq.${a},to_user.eq.${b}),and(from_user.eq.${b},to_user.eq.${a})`)
    .maybeSingle();
  return !!data;
}

export async function GET(req: Request) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.is_anonymous || !user.email) return NextResponse.json({ messages: [] });
  const withId = new URL(req.url).searchParams.get('with');
  if (!withId) return NextResponse.json({ messages: [] });
  const admin = createAdminClient();
  const { data } = await admin.from('dms').select('id, from_user, text, created_at')
    .or(`and(from_user.eq.${user.id},to_user.eq.${withId}),and(from_user.eq.${withId},to_user.eq.${user.id})`)
    .order('created_at', { ascending: true }).limit(300);
  const messages = (data || []).map((m: any) => ({ id: m.id, mine: m.from_user === user.id, text: m.text, ts: new Date(m.created_at).getTime() }));
  // 标记对方发给我的为已读
  await admin.from('dms').update({ read_at: new Date().toISOString() }).eq('from_user', withId).eq('to_user', user.id).is('read_at', null);
  return NextResponse.json({ messages });
}

export async function POST(req: Request) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.is_anonymous || !user.email || user.email === HIDDEN) return NextResponse.json({ ok: false, reason: 'login' }, { status: 401 });
  let body: any = {}; try { body = await req.json(); } catch {}
  const toUserId = body?.toUserId; const text = (body?.text || '').toString().trim().slice(0, 1000);
  if (!toUserId || typeof toUserId !== 'string' || !text || toUserId === user.id) return NextResponse.json({ ok: false, reason: 'bad' }, { status: 400 });
  const admin = createAdminClient();
  const { data: target } = await admin.from('users').select('id, email').eq('id', toUserId).maybeSingle();
  if (!target || !target.email || target.email === HIDDEN) return NextResponse.json({ ok: false, reason: 'notfound' }, { status: 404 });

  const friends = await areFriends(admin, user.id, toUserId);
  if (!friends) {
    const { count } = await admin.from('dms').select('id', { count: 'exact', head: true }).eq('from_user', user.id).eq('to_user', toUserId);
    if ((count || 0) >= 1) return NextResponse.json({ ok: false, reason: 'gated' }, { status: 403 });
  }
  const { error } = await admin.from('dms').insert({ from_user: user.id, to_user: toUserId, text });
  if (error) return NextResponse.json({ ok: false, reason: 'db', detail: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
