// 一起听故事：发弹幕 / 表情（存进消息，房里所有人实时看到）。房里有 Linger 伴侣的话，TA 有时也会接一下。
import { NextResponse } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';
import { STICKERS } from '@/components/Sticker';
import { storyReact } from '@/lib/linger/storyReact';
export const maxDuration = 30;

export async function POST(req: Request) {
  const { data: { user } } = await createServerClient().auth.getUser();
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });
  const { roomId, kind, value, para, ask } = await req.json().catch(() => ({} as any));
  const admin = createAdminClient();
  const { data: room } = await admin.from('rooms').select('*').eq('id', roomId).maybeSingle();
  if (!room) return NextResponse.json({ error: '房间不存在' }, { status: 404 });
  const { data: me } = await admin.from('players').select('id').eq('room_id', roomId).eq('user_id', user.id).maybeSingle();
  if (!me) return NextResponse.json({ error: '你不在这个房间' }, { status: 403 });
  // 只让伴侣反应（听到吓人的段落时，由房主的页面触发）
  if (ask) { const r = await storyReact(admin, room, { para, why: ask === 'scary' || ask === 'moving' ? ask : 'periodic' }); return NextResponse.json({ ok: true, r }); }
  // 开麦说的话：大家已经直接听到了，不再存成弹幕；只交给伴侣，TA 大多会接一句
  if (kind === 'voice') {
    const said = String(value || '').trim().slice(0, 120);
    if (said && room.companion?.player_id && Math.random() < 0.85) { try { await storyReact(admin, room, { para, why: 'user', userSaid: `（说出声的）${said}` }); } catch {} }
    return NextResponse.json({ ok: true });
  }
  const k = kind === 'sticker' ? 'sticker' : 'text';
  const v = k === 'sticker' ? (STICKERS.some((s) => s.k === value) ? value : null) : String(value || '').trim().slice(0, 40);
  if (!v) return NextResponse.json({ error: '空的' }, { status: 400 });
  await admin.from('messages').insert({ room_id: roomId, sender_type: 'player', sender_player_id: me.id, action_type: 'chat', turn_no: 0, content: k === 'text' ? v : '', payload: { type: 'story_live', kind: k, value: v } });
  // 伴侣在的话：一半的时候接你一下
  if (room.companion?.player_id && Math.random() < 0.55) { try { await storyReact(admin, room, { para, why: 'user', userSaid: k === 'text' ? v : `[表情:${v}]` }); } catch {} }
  return NextResponse.json({ ok: true });
}
