// 生成角色头像（套用全局锁定风格 + 模组时代）。幂等：已有头像则直接返回。
import { NextResponse } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';
import { generateImage } from '@/lib/image';
import { buildAvatarPrompt } from '@/lib/image/style';

export const maxDuration = 60;

export async function POST(req: Request) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });

  const { roomId } = await req.json().catch(() => ({} as any));
  if (!roomId) return NextResponse.json({ error: '缺少 roomId' }, { status: 400 });

  const admin = createAdminClient();
  const { data: me } = await admin.from('players').select('id').eq('room_id', roomId).eq('user_id', user.id).maybeSingle();
  if (!me) return NextResponse.json({ error: '你不在这个房间' }, { status: 403 });

  const { data: ch } = await admin.from('characters').select('*').eq('player_id', me.id).maybeSingle();
  if (!ch) return NextResponse.json({ error: '尚无角色卡' }, { status: 404 });
  if (ch.avatar_url) return NextResponse.json({ ok: true, url: ch.avatar_url });

  // 模组时代 + 题材
  let era: string | undefined;
  let theme: string | undefined;
  const { data: room } = await admin.from('rooms').select('campaign_id').eq('id', roomId).maybeSingle();
  if (room?.campaign_id) {
    const { data: campaign } = await admin.from('campaigns').select('setting').eq('id', room.campaign_id).maybeSingle();
    era = campaign?.setting?.era;
    theme = campaign?.setting?.theme;
  }

  try {
    const buf = await generateImage(buildAvatarPrompt(ch, era, theme));
    const path = `avatars/${ch.id}.png`;
    const up = await admin.storage.from('scene-images').upload(path, buf, { contentType: 'image/png', upsert: true });
    if (up.error) throw new Error('上传失败：' + up.error.message);
    const { data: pub } = admin.storage.from('scene-images').getPublicUrl(path);

    await admin.from('characters').update({ avatar_url: pub.publicUrl }).eq('id', ch.id);
    await admin.from('api_usage').insert({ room_id: roomId, kind: 'image', model: process.env.IMAGE_MODEL || 'gpt-image-1-mini', image_count: 1, cost: 0.005 });

    return NextResponse.json({ ok: true, url: pub.publicUrl });
  } catch (e: any) {
    await admin.from('error_logs').insert({ room_id: roomId, scope: 'image', message: e.message });
    return NextResponse.json({ error: '头像生成失败：' + e.message }, { status: 500 });
  }
}
