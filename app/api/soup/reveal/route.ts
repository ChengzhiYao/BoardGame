// 放弃 / 看答案：直接揭晓汤底并结束。
import { NextResponse } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';

export async function POST(req: Request) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });

  const { roomId } = await req.json().catch(() => ({} as any));
  if (!roomId) return NextResponse.json({ error: '缺少 roomId' }, { status: 400 });

  const admin = createAdminClient();
  const { data: me } = await admin.from('players').select('id').eq('room_id', roomId).eq('user_id', user.id).maybeSingle();
  if (!me) return NextResponse.json({ error: '你不在这个房间' }, { status: 403 });

  const { data: puzzle } = await admin.from('soup_puzzles').select('*').eq('room_id', roomId).maybeSingle();
  if (!puzzle) return NextResponse.json({ error: '没有谜题' }, { status: 404 });
  const { data: bot } = await admin.from('soup_bottoms').select('bottom').eq('puzzle_id', puzzle.id).maybeSingle();
  const { data: rm } = await admin.from('rooms').select('language').eq('id', roomId).maybeSingle();
  const lang = rm?.language || 'zh';

  await admin.from('soup_puzzles').update({ status: 'revealed' }).eq('id', puzzle.id);
  await admin.from('rooms').update({ game_state: 'ended' }).eq('id', roomId);
  await admin.from('messages').insert({ room_id: roomId, sender_type: 'system', turn_no: 0, content: (lang === 'en' ? '[Answer] ' : '【汤底揭晓】') + (bot?.bottom || ''), payload: { type: 'soup_reveal' } });

  return NextResponse.json({ ok: true });
}
