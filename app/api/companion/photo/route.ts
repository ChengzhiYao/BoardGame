// TA 发来的生活照:从 TA 的视角拍眼前的东西(不拍脸),手机随手拍画质。每天有上限。
import { NextResponse } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';
import { ensureCompanion, isAllowed } from '@/lib/companion/engine';
import { verifyPhoto, photosToday, PHOTO_DAILY_LIMIT } from '@/lib/companion/photo';
import { generateImage } from '@/lib/image';
import { sendPush } from '@/lib/push';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: Request) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.is_anonymous || !user.email) return NextResponse.json({ ok: false }, { status: 401 });
  const admin = createAdminClient();
  if (!(await isAllowed(admin, user))) return NextResponse.json({ ok: false }, { status: 403 });
  const b = await req.json().catch(() => ({} as any));
  const desc = String(b?.desc || '').slice(0, 300); const ts = Number(b?.ts) || 0;
  if (!desc || !verifyPhoto(user.id, desc, ts, String(b?.sig || ''))) return NextResponse.json({ ok: false, reason: 'bad_token' }, { status: 400 });
  if ((await photosToday(admin, user.id)) >= PHOTO_DAILY_LIMIT) return NextResponse.json({ ok: false, reason: 'limit' });
  const c = await ensureCompanion(admin, user.id);

  const prompt = `A casual photo taken with a smartphone by a young Chinese ${/【性别】\s*男/.test(c.persona || '') ? 'man' : 'woman'} to show a friend on WeChat what she is doing right now: ${desc}.
Her point of view, handheld, a little tilted, ordinary real-life scene in China${c.job ? ` (her job: ${c.job})` : ''}. No face visible — at most her hand or arm in the frame. Real messy everyday details, natural existing light with a real direction, phone camera quality: slightly soft, a bit of noise, ordinary composition.
Photorealistic, not an illustration, not a 3D render, not a professional or stock photo, no cinematic grading. No text overlays, no watermark.`;
  try {
    const buf = await generateImage(prompt, { quality: 'low', jpeg: 60 });
    const path = `avatars/companion/photos/${user.id}/${Date.now()}.jpg`;
    const up = await admin.storage.from('scene-images').upload(path, buf, { contentType: buf[0] === 0xff ? 'image/jpeg' : 'image/png', upsert: true });
    if (up.error) throw new Error(up.error.message);
    const { data: pub } = admin.storage.from('scene-images').getPublicUrl(path);
    const text = `[photo:${pub.publicUrl}|${desc.replace(/[\]|]/g, ' ')}]`;
    await admin.from('companion_msgs').insert({ user_id: user.id, role: 'ai', text });
    await admin.from('companion').update({ last_ai_at: new Date().toISOString() }).eq('user_id', user.id);
    if (b?.push) {
      const { data: subs } = await admin.from('push_subs').select('*').eq('user_id', user.id);
      for (const s of (subs || [])) await sendPush({ endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth }, { title: c.ai_name, body: '[图片]', url: '/companion?src=app', icon: c.avatar_url || undefined });
    }
    return NextResponse.json({ ok: true, text });
  } catch (e: any) {
    return NextResponse.json({ ok: false, reason: 'img_failed', detail: e?.message }, { status: 500 });
  }
}
