// 房主这边：看有谁想加入（GET ?roomId=），同意 / 拒绝 / 不再公开（POST）
import { NextResponse } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';
import { seatNewcomer, openSlots } from '@/lib/rooms/open';

export const dynamic = 'force-dynamic';
const TTL = 3 * 60000;

async function hostRoom(roomId: string) {
  const { data: { user } } = await createServerClient().auth.getUser();
  if (!user) return { error: NextResponse.json({ error: '未登录' }, { status: 401 }) };
  const admin = createAdminClient();
  const { data: room } = await admin.from('rooms').select('*').eq('id', roomId).maybeSingle();
  if (!room) return { error: NextResponse.json({ error: '房间不存在' }, { status: 404 }) };
  if (room.host_user_id !== user.id) return { error: NextResponse.json({ requests: [] }) };
  return { admin, room };
}

export async function GET(req: Request) {
  const roomId = new URL(req.url).searchParams.get('roomId') || '';
  const h: any = await hostRoom(roomId); if (h.error) return h.error;
  const { data } = await h.admin.from('join_requests').select('id, name, avatar, target, created_at').eq('room_id', roomId).eq('status', 'pending').gte('created_at', new Date(Date.now() - TTL).toISOString()).order('created_at');
  const slots = await openSlots(h.admin, h.room);
  return NextResponse.json({ listed: h.room.listed !== false, requests: (data || []).map((r: any) => ({ ...r, slot: slots.find((s) => s.key === r.target) || slots[0] || null })) });
}

export async function POST(req: Request) {
  const { roomId, id, ok, listed } = await req.json().catch(() => ({} as any));
  const h: any = await hostRoom(roomId); if (h.error) return h.error;
  const { admin, room } = h;
  if (typeof listed === 'boolean') {
    await admin.from('rooms').update({ listed }).eq('id', roomId);
    if (!listed) await admin.from('join_requests').update({ status: 'declined', decided_at: new Date().toISOString() }).eq('room_id', roomId).eq('status', 'pending');
    return NextResponse.json({ ok: true });
  }
  const { data: r } = await admin.from('join_requests').select('*').eq('id', id).eq('room_id', roomId).maybeSingle();
  if (!r || r.status !== 'pending') return NextResponse.json({ error: '这条申请已经处理过了' }, { status: 409 });
  if (!ok) {
    await admin.from('join_requests').update({ status: 'declined', decided_at: new Date().toISOString() }).eq('id', id);
    return NextResponse.json({ ok: true });
  }
  try {
    const res = await seatNewcomer(admin, room, r.user_id, r.name || '玩家', r.target);
    await admin.from('join_requests').update({ status: 'approved', seat: res.seat, note: res.replaced || null, decided_at: new Date().toISOString() }).eq('id', id);
    return NextResponse.json({ ok: true, ...res });
  } catch (e: any) {
    await admin.from('join_requests').update({ status: 'declined', note: e.message, decided_at: new Date().toISOString() }).eq('id', id);
    return NextResponse.json({ error: e.message }, { status: 409 });
  }
}
