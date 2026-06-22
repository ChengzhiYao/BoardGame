// 讲故事 · 听下一个：回到选择页（保留已生成的 3 个推荐），清掉当前在读的故事。同一局内不另扣额度。
import { NextResponse } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';
import { loadStory, persistStory } from '@/lib/story/db';

export const maxDuration = 20;

export async function POST(req: Request) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });
  const { roomId } = await req.json().catch(() => ({} as any));
  if (!roomId) return NextResponse.json({ error: '缺少参数' }, { status: 400 });

  const admin = createAdminClient();
  const { data: room } = await admin.from('rooms').select('host_user_id').eq('id', roomId).maybeSingle();
  if (!room) return NextResponse.json({ error: '房间不存在' }, { status: 404 });
  const { data: me } = await admin.from('players').select('id').eq('room_id', roomId).eq('user_id', user.id).maybeSingle();
  if (!me) return NextResponse.json({ error: '你不在这个房间' }, { status: 403 });

  const state = await loadStory(admin, roomId);
  if (!state) return NextResponse.json({ error: '无故事状态' }, { status: 409 });
  const hasOptions = Array.isArray(state.options) && state.options.length > 0;
  await persistStory(admin, roomId, {
    ...state,
    phase: hasOptions ? 'select' : 'setup',
    chosen: null, full: null, rating: null, prevRating: null, revisedFrom: null, reviseCount: 0,
    narration: null, playback: null,
  });
  return NextResponse.json({ ok: true });
}
