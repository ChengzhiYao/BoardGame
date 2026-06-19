// 血染 · 提名/投票：真人提交（或更改）今日的指认目标。死亡玩家保留一张"鬼票"（仅一次）。
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
  const { data: meP } = await admin.from('players').select('seat').eq('room_id', roomId).eq('user_id', user.id).maybeSingle();
  if (!meP) return NextResponse.json({ error: '你不在这个房间' }, { status: 403 });
  const { data: mine } = await admin.from('botc_players').select('alive, used_ghost_vote').eq('room_id', roomId).eq('seat', meP.seat).maybeSingle();
  const dead = mine && mine.alive === false;
  if (dead && mine?.used_ghost_vote) return NextResponse.json({ error: '你的鬼票已经用过了。' }, { status: 409 });

  await admin.from('botc_votes').delete().eq('room_id', roomId).eq('day', room.botc_day).eq('voter', meP.seat);
  await admin.from('botc_votes').insert({ room_id: roomId, day: room.botc_day, voter: meP.seat, target });
  if (dead) await admin.from('botc_players').update({ used_ghost_vote: true }).eq('room_id', roomId).eq('seat', meP.seat);

  const en = room.language === 'en';
  await admin.from('messages').insert({ room_id: roomId, sender_type: 'system', turn_no: room.botc_day, content: (dead ? (en ? '👻 ' : '👻 ') : '') + (en ? `${meP.seat} accuses ` : `${meP.seat} 指认 `) + (target === 'skip' ? (en ? '(skip)' : '（弃票）') : target), payload: { type: 'botc_vote' } });
  return NextResponse.json({ ok: true });
}
