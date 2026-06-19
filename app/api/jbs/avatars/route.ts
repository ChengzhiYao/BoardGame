// 为剧本杀全部角色生成头像（含 AI 角色）。画风按本剧设定 + 角色描述自适应，不套固定风格。
// 房主触发；幂等：已有头像的角色跳过，可重复点击补齐剩余。
import { NextResponse } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';
import { generateImage } from '@/lib/image';
import { buildJbsPortraitPrompt } from '@/lib/image/style';

export const maxDuration = 60;

export async function POST(req: Request) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });

  const { roomId, force } = await req.json().catch(() => ({} as any));
  if (!roomId) return NextResponse.json({ error: '缺少 roomId' }, { status: 400 });

  const admin = createAdminClient();
  const { data: room } = await admin.from('rooms').select('id, host_user_id').eq('id', roomId).maybeSingle();
  if (!room) return NextResponse.json({ error: '房间不存在' }, { status: 404 });
  if (room.host_user_id !== user.id) return NextResponse.json({ error: '只有房主可以生成头像' }, { status: 403 });

  const { data: kaseRows } = await admin.from('jbs_cases').select('case_file').eq('room_id', roomId).order('created_at', { ascending: false }).limit(1);
  const kase = kaseRows?.[0];
  if (!kase) return NextResponse.json({ error: '案件未生成' }, { status: 409 });
  const cf = kase.case_file || {};
  const meta = { type: cf.type, genre: cf.genre || cf.title, era: cf.era, place: cf.place };
  const byName: Record<string, any> = {};
  for (const c of cf.characters || []) byName[c.name] = c;

  const { data: chars } = await admin.from('jbs_characters').select('id, name, age, occupation, public_info, avatar_url').eq('room_id', roomId);
  const todo = (chars || []).filter((c: any) => force || !c.avatar_url);
  if (!todo.length) return NextResponse.json({ ok: true, done: 0 });

  // 并行生成（每个角色独立出图+上传+落库；realtime 会让头像逐个出现）
  const errors: string[] = [];
  const results = await Promise.allSettled(todo.map(async (c: any) => {
    const full = { ...(byName[c.name] || {}), name: c.name, age: c.age, occupation: c.occupation, public_info: c.public_info };
    const buf = await generateImage(buildJbsPortraitPrompt(full, meta));
    const path = `avatars/jbs/${c.id}.png`;
    const up = await admin.storage.from('scene-images').upload(path, buf, { contentType: 'image/png', upsert: true });
    if (up.error) throw new Error(up.error.message);
    const { data: pub } = admin.storage.from('scene-images').getPublicUrl(path);
    await admin.from('jbs_characters').update({ avatar_url: pub.publicUrl }).eq('id', c.id);
    await admin.from('api_usage').insert({ room_id: roomId, kind: 'image', model: process.env.IMAGE_MODEL || 'gpt-image-1-mini', image_count: 1, cost: 0.005 });
  }));
  let done = 0;
  results.forEach((r, i) => { if (r.status === 'fulfilled') done++; else errors.push(`${todo[i].name}: ${r.reason?.message || r.reason}`); });

  if (errors.length) await admin.from('error_logs').insert({ room_id: roomId, scope: 'image', message: '剧本杀头像:' + errors.join(' | ') });
  return NextResponse.json({ ok: true, done, remaining: todo.length - done, errors: errors.slice(0, 3) });
}
