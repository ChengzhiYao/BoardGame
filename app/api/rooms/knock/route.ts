// 敲门：房内玩家批准某人加入房间 → 用 admin 给对方分配空座。
import { NextResponse } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });

  const body = await req.json().catch(() => ({} as any));
  const roomId = (body.roomId || '').trim();
  const targetId = (body.userId || '').trim();
  if (!roomId || !targetId) return NextResponse.json({ error: '参数缺失' }, { status: 400 });

  const admin = createAdminClient();
  const { data: room } = await admin.from('rooms').select('*').eq('id', roomId).maybeSingle();
  if (!room) return NextResponse.json({ error: '房间不存在' }, { status: 404 });

  const { data: players } = await admin.from('players').select('*').eq('room_id', roomId);
  if (!players?.some((p) => p.user_id === user.id)) return NextResponse.json({ error: '无权批准', reason: 'forbidden' }, { status: 403 });
  if (players?.some((p) => p.user_id === targetId)) return NextResponse.json({ ok: true, roomId });

  const SEATS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
  const cap = (room.mode === 'jbs' || room.mode === 'botc') ? 8 : (room.mode === 'coc' || room.mode === 'mcc' || room.mode === 'dnd') ? 6 : 2;
  if ((players?.length || 0) >= cap) return NextResponse.json({ error: `房间已满（${cap}/${cap}）`, reason: 'full' }, { status: 403 });

  const taken = new Set(players?.map((p) => p.seat));
  const seat = SEATS.slice(0, cap).find((s) => !taken.has(s)) || 'B';
  const { error } = await admin.from('players').insert({ room_id: roomId, user_id: targetId, seat, is_online: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, roomId });
}
