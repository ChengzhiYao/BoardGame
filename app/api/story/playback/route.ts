// 讲故事 · 同步播放状态（任何房间成员都能控制：播放/暂停/拖动进度）。写入 story_state.playback，realtime 广播给双方。
import { NextResponse } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';
import { loadStory } from '@/lib/story/db';

export const maxDuration = 20;

export async function POST(req: Request) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });
  const { roomId, playing, position } = await req.json().catch(() => ({} as any));
  if (!roomId) return NextResponse.json({ error: '缺少参数' }, { status: 400 });

  const admin = createAdminClient();
  const { data: me } = await admin.from('players').select('id').eq('room_id', roomId).eq('user_id', user.id).maybeSingle();
  if (!me) return NextResponse.json({ error: '你不在这个房间' }, { status: 403 });

  const state = await loadStory(admin, roomId);
  if (!state) return NextResponse.json({ error: '无故事状态' }, { status: 409 });
  const playback = { playing: !!playing, position: Math.max(0, Number(position) || 0), ts: Date.now(), by: user.id };
  await admin.from('story_state').upsert({ room_id: roomId, state: { ...state, playback }, updated_at: new Date().toISOString() });
  return NextResponse.json({ ok: true });
}
