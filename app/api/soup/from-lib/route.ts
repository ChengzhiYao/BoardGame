// 从题库页直接开一局指定的海龟汤（按普通海龟汤计费：每天 2 碗免费 → $1 / 畅玩卡）
import { NextResponse } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';
import { lightStatus, decide, consume, PAY_ERROR } from '@/lib/billing/light';

function genToken() { return Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 6); }

export async function POST(req: Request) {
  const { data: { user } } = await createServerClient().auth.getUser();
  if (!user || (user as any).is_anonymous || !user.email) return NextResponse.json({ error: '登录后就能玩', reason: 'login' }, { status: 401 });
  const { libId } = await req.json().catch(() => ({} as any));
  const admin = createAdminClient();
  const { data: p } = await admin.from('soup_library').select('id, lang, title, surface, bottom, difficulty, plays, surface_audio').eq('id', libId).maybeSingle();
  if (!p) return NextResponse.json({ error: '没有这道题' }, { status: 404 });
  const via = decide(await lightStatus(admin, user, 'soup'));
  if (!via) return NextResponse.json(PAY_ERROR, { status: 402 });
  const { data: u } = await admin.from('users').select('display_name').eq('id', user.id).maybeSingle();
  const lang = p.lang === 'en' ? 'en' : 'zh';
  const { data: room, error } = await admin.from('rooms').insert({
    name: (u?.display_name || (lang === 'en' ? 'Player' : '玩家')) + (lang === 'en' ? '’s Lateral Mystery' : ' 的海龟汤'),
    host_user_id: user.id, status: 'waiting', mode: 'soup', language: lang, game_state: 'playing',
    invite_token: genToken(), invite_expires_at: new Date(Date.now() + 7 * 86400000).toISOString(),
  }).select().single();
  if (error || !room) return NextResponse.json({ error: error?.message || '开房失败' }, { status: 500 });
  await admin.from('players').insert({ room_id: room.id, user_id: user.id, seat: 'A', is_online: true });
  await admin.from('room_settings').insert({ room_id: room.id });
  const { data: puzzle } = await admin.from('soup_puzzles').insert({ room_id: room.id, title: p.title, surface: p.surface, difficulty: p.difficulty || '普通', status: 'playing', lib_id: p.id }).select().single();
  await admin.from('soup_bottoms').insert({ puzzle_id: puzzle.id, bottom: p.bottom });
  await admin.from('soup_library').update({ plays: (p.plays || 0) + 1 }).eq('id', p.id);
  await admin.from('messages').insert({ room_id: room.id, sender_type: 'kp', turn_no: 0, content: p.surface, payload: { type: 'soup_surface', audio: p.surface_audio || undefined, lib: p.id } });
  try { await consume(admin, user.id, 'soup', via); } catch {}
  return NextResponse.json({ url: `/room/${room.id}` });
}
