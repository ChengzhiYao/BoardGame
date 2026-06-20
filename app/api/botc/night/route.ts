// 血染 · 夜间行动：拥有主动夜间能力（kill/poison/protect/inspect）的真人选择目标（保密）。inspect 的查验结果于天亮结算时私下送达。
import { NextResponse } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';

export async function POST(req: Request) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });
  const { roomId, target } = await req.json().catch(() => ({} as any));
  if (!roomId || !target) return NextResponse.json({ error: '缺少参数' }, { status: 400 });

  const admin = createAdminClient();
  const { data: room } = await admin.from('rooms').select('botc_phase, botc_day').eq('id', roomId).maybeSingle();
  if (!room || room.botc_phase !== 'night') return NextResponse.json({ error: '现在不是夜晚' }, { status: 409 });
  const { data: meP } = await admin.from('players').select('seat').eq('room_id', roomId).eq('user_id', user.id).maybeSingle();
  if (!meP) return NextResponse.json({ error: '你不在这个房间' }, { status: 403 });
  const { data: mine } = await admin.from('botc_players').select('alive').eq('room_id', roomId).eq('seat', meP.seat).maybeSingle();
  if (mine && mine.alive === false) return NextResponse.json({ error: '你已出局，无法行动。' }, { status: 409 });

  const { data: setupRow } = await admin.from('botc_setup').select('data').eq('room_id', roomId).maybeSingle();
  const myRole = (setupRow?.data?.roles || []).find((r: any) => r.seat === meP.seat);
  const action = myRole?.night_action;
  if (!['kill', 'poison', 'protect', 'inspect'].includes(action)) return NextResponse.json({ error: '你没有主动夜间能力。' }, { status: 409 });

  await admin.from('botc_night').delete().eq('room_id', roomId).eq('day', room.botc_day).eq('actor', meP.seat);
  await admin.from('botc_night').insert({ room_id: roomId, day: room.botc_day, actor: meP.seat, action, target });
  return NextResponse.json({ ok: true });
}
