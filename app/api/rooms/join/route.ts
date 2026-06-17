// 加入房间：用邀请 token 找房间，校验是否已满，给新玩家分配空座（A/B）。
import { NextResponse } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';

export async function POST(req: Request) {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });

  const body = await req.json().catch(() => ({} as any));
  const token = (body.token || '').trim();
  if (!token) return NextResponse.json({ error: '缺少邀请码' }, { status: 400 });

  const admin = createAdminClient();
  const { data: room } = await admin
    .from('rooms')
    .select('*')
    .eq('invite_token', token)
    .maybeSingle();
  if (!room) return NextResponse.json({ error: '邀请码无效或已失效' }, { status: 404 });

  const { data: players } = await admin.from('players').select('*').eq('room_id', room.id);
  const mine = players?.find((p) => p.user_id === user.id);
  if (mine) {
    // 已在房间里，直接进
    if (body.displayName) {
      await admin.from('users').update({ display_name: body.displayName }).eq('id', user.id);
    }
    return NextResponse.json({ roomId: room.id });
  }

  if ((players?.length || 0) >= 2) {
    return NextResponse.json({ error: '房间已满（2/2）' }, { status: 403 });
  }

  const taken = new Set(players?.map((p) => p.seat));
  const seat = taken.has('A') ? 'B' : 'A';
  const { error } = await admin
    .from('players')
    .insert({ room_id: room.id, user_id: user.id, seat, is_online: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (body.displayName) {
    await admin.from('users').update({ display_name: body.displayName }).eq('id', user.id);
  }

  // 满员后进入模组选择阶段（仅 CoC 模式；海龟汤由房主手动开始，不跳步）
  if (room.mode !== 'soup' && (players?.length || 0) + 1 >= 2) {
    await admin
      .from('rooms')
      .update({ status: 'character_creation', game_state: 'module_selection' })
      .eq('id', room.id);
  }