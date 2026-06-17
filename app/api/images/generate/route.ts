// 玩家确认配图建议 → 用 OpenAI 出图 → 上传 Storage → 入画廊；含预算控制。
import { NextResponse } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';
import { generateImage } from '@/lib/image';
import { buildImagePrompt } from '@/lib/image/style';

export const maxDuration = 60;

export async function POST(req: Request) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });

  const { roomId, imageId } = await req.json().catch(() => ({} as any));
  if (!roomId || !imageId) return NextResponse.json({ error: '缺少参数' }, { status: 400 });

  const admin = createAdminClient();
  const { data: me } = await admin.from('players').select('id').eq('room_id', roomId).eq('user_id', user.id).maybeSingle();
  if (!me) return NextResponse.json({ error: '你不在这个房间' }, { status: 403 });

  const { data: room } = await admin.from('rooms').select('image_budget, image_used').eq('id', roomId).maybeSingle();
  if (!room) return NextResponse.json({ error: '房间不存在' }, { status: 404 });
  if ((room.image_used || 0) >= (room.image_budget || 0)) {
    return NextResponse.json({ error: '本场配图额度已用尽' }, { status: 409 });
  }

  const { data: img } = await admin.from('images').select('*').eq('id', imageId).eq('room_id', roomId).maybeSingle();
  if (!img) return NextResponse.json({ error: '图片记录不存在' }, { status: 404 });
  if (img.status === 'done' || img.status === 'generating') {
    return NextResponse.json({ ok: true, url: img.storage_url });
  }

  await admin.from('images').update({ status: 'generating', approved_by: me.id }).eq('id', imageId);

  // 取模组时代与题材，套对应画风
  let era: string | undefined;
  let theme: string | undefined;
  const { data: roomFull } = await admin.from('rooms').select('campaign_id').eq('id', roomId).maybeSingle();
  if (roomFull?.campaign_id) {
    const { data: campaign } = await admin.from('campaigns').select('setting').eq('id', roomFull.campaign_id).maybeSingle();
    era = campaign?.setting?.era;
    theme = campaign?.setting?.theme;
  }

  try {
    const buf = await generateImage(buildImagePrompt(img.image_type || 'scene_image', img.prompt || '一处不安的场景', era, theme));
    const path = `${roomId}/${imageId}.png`;
    const up = await admin.storage.from('scene-images').upload(path, buf, { contentType: 'image/png', upsert: true });
    if (up.error) throw new Error('上传失败：' + up.error.message);
    const { data: pub } = admin.storage.from('scene-images').getPublicUrl(path);

    await admin.from('images').update({ status: 'done', storage_url: pub.publicUrl, cost: 0.04 }).eq('id', imageId);
    await admin.from('rooms').update({ image_used: (room.image_used || 0) + 1 }).eq('id', roomId);
    await admin.from('api_usage').insert({ room_id: roomId, kind: 'image', model: process.env.IMAGE_MODEL || 'gpt-image-1', image_count: 1, cost: 0.04 });

    return NextResponse.json({ ok: true, url: pub.publicUrl });
  } catch (e: any) {
    await admin.from('images').update({ status: 'failed' }).eq('id', imageId);
    await admin.from('error_logs').insert({ room_id: roomId, scope: 'image', message: e.message });
    return NextResponse.json({ error: '出图失败：' + e.message }, { status: 500 });
  }
}
