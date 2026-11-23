// 每日一汤：开今天的题（永久免费，不占每天 2 碗）；也能补玩往期（按普通海龟汤计费）。
// 今天已经挑战过 / 有进行中的局 → 直接回到那一局。
import { NextResponse } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';
import { ensureDaily, dayKey, type Lang } from '@/lib/soup/daily';
import { lightStatus, decide, consume, PAY_ERROR } from '@/lib/billing/light';

export const maxDuration = 30;

function genToken() { return Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 6); }

export async function POST(req: Request) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: '未登录', reason: 'login' }, { status: 401 });
  if (!user.email) return NextResponse.json({ error: '登录后就能挑战每日一汤', reason: 'login' }, { status: 402 });

  const body = await req.json().catch(() => ({} as any));
  const lang: Lang = body.lang === 'en' ? 'en' : 'zh';
  const today = dayKey(lang);
  const day: string = /^\d{4}-\d{2}-\d{2}$/.test(body.day || '') && body.day <= today ? body.day : today;
  const isToday = day === today;
  const admin = createAdminClient();

  // 已有这一天的局 → 回去
  const { data: mine } = await admin.from('rooms').select('id, created_at').eq('host_user_id', user.id).eq('daily_day', day).eq('language', lang).order('created_at', { ascending: false }).limit(1);
  if (mine?.[0]) return NextResponse.json({ roomId: mine[0].id, url: `/room/${mine[0].id}` });

  const daily = isToday ? await ensureDaily(admin, lang, day) : (await admin.from('daily_soup').select('day, no, lib_id').eq('day', day).eq('lang', lang).maybeSingle()).data;
  if (!daily) return NextResponse.json({ error: lang === 'en' ? 'No puzzle for that day' : '那天没有每日一汤' }, { status: 404 });

  // 往期：和普通海龟汤一样算（每天 2 碗免费 → 之后 $1 / 畅玩卡）
  let via: any = null;
  if (!isToday) {
    via = decide(await lightStatus(admin, user, 'soup'));
    if (!via) return NextResponse.json(PAY_ERROR, { status: 402 });
  }

  const { data: p } = await admin.from('soup_library').select('id, title, surface, bottom, difficulty, plays, surface_audio').eq('id', daily.lib_id).maybeSingle();
  if (!p) return NextResponse.json({ error: '题目不见了' }, { status: 500 });

  const { data: room, error } = await admin.from('rooms').insert({
    name: lang === 'en' ? `Daily Soup #${daily.no}` : `每日一汤 #${daily.no}`,
    host_user_id: user.id, status: 'waiting', mode: 'soup', language: lang, daily_day: day,
    invite_token: genToken(), invite_expires_at: new Date(Date.now() + 2 * 86400000).toISOString(),
    game_state: 'playing',
  }).select().single();
  if (error || !room) return NextResponse.json({ error: error?.message || '开房失败' }, { status: 500 });
  await admin.from('players').insert({ room_id: room.id, user_id: user.id, seat: 'A', is_online: true });
  await admin.from('room_settings').insert({ room_id: room.id });

  const { data: puzzle } = await admin.from('soup_puzzles').insert({ room_id: room.id, title: p.title, surface: p.surface, difficulty: p.difficulty || '普通', status: 'playing', lib_id: p.id }).select().single();
  await admin.from('soup_bottoms').insert({ puzzle_id: puzzle.id, bottom: p.bottom });
  await admin.from('soup_library').update({ plays: (p.plays || 0) + 1 }).eq('id', p.id);
  await admin.from('messages').insert({ room_id: room.id, sender_type: 'kp', turn_no: 0, content: p.surface, payload: { type: 'soup_surface', audio: p.surface_audio || undefined, lib: p.id, daily: daily.no } });
  if (via) { try { await consume(admin, user.id, 'soup', via); } catch {} }
  return NextResponse.json({ roomId: room.id, url: `/room/${room.id}` });
}
