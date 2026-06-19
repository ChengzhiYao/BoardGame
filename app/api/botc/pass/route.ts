// 血染 · 真人"发言完毕"：轮到自己时点它，发言权交给下一位；最后一位完成则进入投票阶段。
import { NextResponse } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';

export async function POST(req: Request) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });
  const { roomId } = await req.json().catch(() => ({} as any));
  if (!roomId) return NextResponse.json({ error: '缺少参数' }, { status: 400 });

  const admin = createAdminClient();
  const { data: room } = await admin.from('rooms').select('botc_phase, botc_day, waiting_for').eq('id', roomId).maybeSingle();
  if (!room || room.botc_phase !== 'day') return NextResponse.json({ error: '现在不是发言阶段' }, { status: 409 });
  const { data: meP } = await admin.from('players').select('seat').eq('room_id', roomId).eq('user_id', user.id).maybeSingle();
  if (!meP) return NextResponse.json({ error: '你不在这个房间' }, { status: 403 });
  if (room.waiting_for !== meP.seat) return NextResponse.json({ ok: true, notyou: true });

  const { data: bps } = await admin.from('botc_players').select('seat, alive').eq('room_id', roomId);
  const order = (bps || []).filter((p: any) => p.alive).map((p: any) => p.seat).sort();
  const idx = order.indexOf(meP.seat);
  const next = order[idx + 1];
  if (next) await admin.from('rooms').update({ waiting_for: next }).eq('id', roomId);
  else await admin.from('rooms').update({ botc_phase: 'vote', waiting_for: null }).eq('id', roomId);
  return NextResponse.json({ ok: true, next: next || 'vote' });
}
