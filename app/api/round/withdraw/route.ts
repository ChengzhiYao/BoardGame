// 撤回本回合已提交的行动（仅在尚未开始结算时允许）。
import { NextResponse } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';

export async function POST(req: Request) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });

  const { roomId } = await req.json().catch(() => ({} as any));
  if (!roomId) return NextResponse.json({ error: '缺少 roomId' }, { status: 400 });

  const admin = createAdminClient();
  const { data: me } = await admin.from('players').select('seat').eq('room_id', roomId).eq('user_id', user.id).maybeSingle();
  if (!me) return NextResponse.json({ error: '你不在这个房间' }, { status: 403 });

  const { data: room } = await admin.from('rooms').select('pending_actions, player_a_ready, player_b_ready, resolution_status').eq('id', roomId).maybeSingle();
  if (!room) return NextResponse.json({ error: '房间不存在' }, { status: 404 });
  if (room.resolution_status === 'resolving') return NextResponse.json({ error: '已开始结算，无法撤回。' }, { status: 409 });

  const pending = { ...(room.pending_actions || {}) };
  delete pending[me.seat];
  // 就绪状态改为从 pending_actions 推导（支持 1~6 人），撤回只需移除本座位的行动。
  await admin.from('rooms').update({ pending_actions: pending, waiting_for: me.seat }).eq('id', roomId);

  return NextResponse.json({ ok: true });
}
