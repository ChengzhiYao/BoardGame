// MCC · 开局：洗牌发牌，初始化对局（仅房主，≥2 名玩家）。
import { NextResponse } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';
import { newGame } from '@/lib/mcc/engine';
import { persist } from '@/lib/mcc/db';

export async function POST(req: Request) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });
  const { roomId } = await req.json().catch(() => ({} as any));
  if (!roomId) return NextResponse.json({ error: '缺少参数' }, { status: 400 });

  const admin = createAdminClient();
  const { data: room } = await admin.from('rooms').select('host_user_id, mcc_phase').eq('id', roomId).maybeSingle();
  if (!room) return NextResponse.json({ error: '房间不存在' }, { status: 404 });
  if (room.host_user_id !== user.id) return NextResponse.json({ error: '只有房主可以开始' }, { status: 403 });
  if (room.mcc_phase === 'playing') return NextResponse.json({ ok: true });

  const { data: players } = await admin.from('players').select('seat, user_id').eq('room_id', roomId);
  const real = (players || []).filter((p: any) => /^[A-H]$/.test(p.seat));
  if (real.length < 2) return NextResponse.json({ error: '至少需要 2 名玩家' }, { status: 409 });
  const { data: users } = await admin.from('users').select('id, display_name').in('id', real.map((p: any) => p.user_id));
  const list = real.map((p: any) => ({ seat: p.seat, name: users?.find((u: any) => u.id === p.user_id)?.display_name || `玩家${p.seat}` })).sort((a, b) => a.seat.localeCompare(b.seat));

  await admin.from('mcc_hands').delete().eq('room_id', roomId);
  const state = newGame(list);
  await persist(admin, roomId, state);
  return NextResponse.json({ ok: true });
}
