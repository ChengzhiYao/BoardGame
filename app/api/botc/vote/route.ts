// 血染 · 提名/投票：真人提交（或更改）今日的指认目标。
import { NextResponse } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';

export async function POST(req: Request) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });
  const { roomId, target } = await req.json().catch(() => ({} as any));
  if (!roomId || !target) return NextResponse.json({ error: '缺少参数' }, { status: 400 });

  const admin = createAdminClient();
  const { data: room } = await admin.from('rooms').select('botc_day, botc_phase, language').eq('id', roomId).maybeSingle();
  if (!room || room.botc_phase !== 'day') return NextResponse.json({ error: '现在不是投票阶段' }, { status: 409 });
  const { data: me } = await admin.from('players').select('seat').eq('room_id', roomId).eq('user_id', user.id).maybeSingle();
  if (!me) return NextResponse.json({ error: '你不在这个房间' }, { status: 403 });
  // 死亡玩家不能投（鬼票从简：本版死亡即不可投）
  const { data: mine } = await admin.from('botc_players').select('alive').eq('room_id', roomId).eq('seat', me.seat).maybeSingle();
  if (mine && mine.alive === false) return NextResponse.json({ error: '你已出局，无法投票。' }, { status: 409 });

  await admin.from('botc_votes').delete().eq('room_id', roomId).eq('day', room.botc_day).eq('voter', me.seat);
  await admin.from('botc_votes').insert({ room_id: roomId, day: room.botc_day, voter: me.seat, target });
  const en = room.language === 'en';
  await admin.from('messages').insert({ room_id: roomId, sender_type: 'system', turn_no: room.botc_day, content: (en ? `🗳️ ${me.seat} accuses ` : `🗳️ ${me.seat} 指认 `) + (target === 'skip' ? (en ? '(skip)' : '（弃票）') : target), payload: { type: 'botc_vote' } });
  return NextResponse.json({ ok: true });
}
