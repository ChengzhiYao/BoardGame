// 保存真心话大冒险的设置并开始。
import { NextResponse } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';

export async function POST(req: Request) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });

  const { roomId, settings } = await req.json().catch(() => ({} as any));
  if (!roomId) return NextResponse.json({ error: '缺少 roomId' }, { status: 400 });

  const admin = createAdminClient();
  const { data: me } = await admin.from('players').select('id').eq('room_id', roomId).eq('user_id', user.id).maybeSingle();
  if (!me) return NextResponse.json({ error: '你不在这个房间' }, { status: 403 });

  const types: string[] = Array.isArray(settings?.types) && settings.types.length ? settings.types.filter((t: string) => ['truth', 'dare'].includes(t)) : ['truth', 'dare'];
  const clean = {
    types: types.length ? types : ['truth', 'dare'],
    intensity: ['mild', 'medium', 'bold'].includes(settings?.intensity) ? settings.intensity : 'medium',
    forbidden: (settings?.forbidden || '').slice(0, 200),
    environment: (settings?.environment || '').slice(0, 100),
  };

  await admin.from('rooms').update({ td_settings: clean, game_state: 'playing' }).eq('id', roomId);
  const typeLabel = clean.types.map((t) => (t === 'truth' ? '真心话' : '大冒险')).join(' / ');
  await admin.from('messages').insert({
    room_id: roomId, sender_type: 'system', turn_no: 0,
    content: `游戏开始！模式：${typeLabel}；尺度：${clean.intensity}${clean.environment ? `；环境：${clean.environment}` : ''}${clean.forbidden ? `；避开：${clean.forbidden}` : ''}。轮到谁就点按钮抽一题吧。`,
    payload: { type: 'td_info' },
  });

  return NextResponse.json({ ok: true });
}
