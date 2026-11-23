// 申请加入一局（POST）/ 查自己的申请结果（GET ?id=）
import { NextResponse } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';
import { openSlots } from '@/lib/rooms/open';

export const dynamic = 'force-dynamic';
const TTL = 3 * 60000;

export async function POST(req: Request) {
  const { data: { user } } = await createServerClient().auth.getUser();
  if (!user || (user as any).is_anonymous || !user.email) return NextResponse.json({ error: '登录后才能申请加入', reason: 'login' }, { status: 401 });
  const { roomId, target } = await req.json().catch(() => ({} as any));
  const admin = createAdminClient();
  const { data: room } = await admin.from('rooms').select('*').eq('id', roomId).maybeSingle();
  if (!room || room.game_state === 'ended' || room.listed === false) return NextResponse.json({ error: '这一局已经不收人了' }, { status: 404 });
  const { data: inRoom } = await admin.from('players').select('id').eq('room_id', roomId).eq('user_id', user.id).maybeSingle();
  if (inRoom) return NextResponse.json({ status: 'approved', roomId });
  const slots = await openSlots(admin, room);
  if (!slots.length) return NextResponse.json({ error: '已经没有空位了' }, { status: 409 });
  const { data: u } = await admin.from('users').select('display_name, avatar_url').eq('id', user.id).maybeSingle();
  // 同一局只留一条进行中的申请
  await admin.from('join_requests').update({ status: 'expired' }).eq('room_id', roomId).eq('user_id', user.id).eq('status', 'pending');
  const { data: row, error } = await admin.from('join_requests').insert({ room_id: roomId, user_id: user.id, name: u?.display_name || String(user.email).split('@')[0], avatar: u?.avatar_url || null, target: slots.some((s) => s.key === target) ? target : slots[0].key }).select('id').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: row.id, status: 'pending' });
}

export async function GET(req: Request) {
  const { data: { user } } = await createServerClient().auth.getUser();
  if (!user) return NextResponse.json({ status: 'none' });
  const id = new URL(req.url).searchParams.get('id');
  const admin = createAdminClient();
  const { data: r } = await admin.from('join_requests').select('id, room_id, status, created_at, note').eq('id', id).eq('user_id', user.id).maybeSingle();
  if (!r) return NextResponse.json({ status: 'none' });
  if (r.status === 'pending' && Date.now() - new Date(r.created_at).getTime() > TTL) {
    await admin.from('join_requests').update({ status: 'expired' }).eq('id', r.id);
    return NextResponse.json({ status: 'expired', roomId: r.room_id });
  }
  return NextResponse.json({ status: r.status, roomId: r.room_id, note: r.note });
}
