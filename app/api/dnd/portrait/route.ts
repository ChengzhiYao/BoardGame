// D&D · 为本人英雄生成肖像（建卡后自动调用；幂等）。
import { NextResponse } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';
import { generateImage } from '@/lib/image';
import { buildDndPortraitPrompt } from '@/lib/image/style';
import { RACES, CLASSES, BACKGROUNDS, ABILITY_CN, mod, type Ability } from '@/lib/dnd/engine';
import { loadState, mutateState } from '@/lib/dnd/db';

export const maxDuration = 60;

export async function POST(req: Request) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });
  const { roomId, force } = await req.json().catch(() => ({} as any));
  if (!roomId) return NextResponse.json({ error: '缺少参数' }, { status: 400 });

  const admin = createAdminClient();
  const { data: me } = await admin.from('players').select('seat').eq('room_id', roomId).eq('user_id', user.id).maybeSingle();
  if (!me) return NextResponse.json({ error: '你不在这个房间' }, { status: 403 });

  const state = await loadState(admin, roomId);
  const c: any = state?.chars?.[me.seat];
  if (!c) return NextResponse.json({ error: '请先创建角色' }, { status: 409 });
  if (c.avatar && !force) return NextResponse.json({ ok: true, skipped: true });

  try {
    const abil = (['str', 'dex', 'con', 'int', 'wis', 'cha'] as Ability[]).slice().sort((a, b) => (c.scores[b] || 0) - (c.scores[a] || 0));
    const top = abil.slice(0, 2).map((a) => ABILITY_CN[a]).join('、');
    const subject = `${c.name}，${RACES[c.race]?.cn || ''}${CLASSES[c.cls]?.cn || ''}（${BACKGROUNDS[c.background]?.cn || ''}出身，擅长${top}）`;
    const buf = await generateImage(buildDndPortraitPrompt(subject, state?.theme));
    const path = `avatars/dnd/${roomId}-${me.seat}.png`;
    const up = await admin.storage.from('scene-images').upload(path, buf, { contentType: 'image/png', upsert: true });
    if (up.error) throw new Error(up.error.message);
    const { data: pub } = admin.storage.from('scene-images').getPublicUrl(path);
    await mutateState(admin, roomId, (s) => { if (s.chars[me.seat]) s.chars[me.seat].avatar = `${pub.publicUrl}?t=${Date.now()}`; return { ok: true }; });
    await admin.from('api_usage').insert({ room_id: roomId, kind: 'image', model: process.env.IMAGE_MODEL || 'gpt-image-1-mini', image_count: 1, cost: 0.005 });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    await admin.from('error_logs').insert({ room_id: roomId, scope: 'image', message: 'DnD肖像:' + e.message });
    return NextResponse.json({ error: '出图失败：' + e.message }, { status: 500 });
  }
}
