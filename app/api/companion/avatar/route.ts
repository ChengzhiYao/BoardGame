// 为伴侣生成头像。不局限本人自拍:按人设挑最搭的头像类型(自拍/宠物/动漫/文艺小物),
// 更像真人用的社交头像。虚构,非真人冒用。
import { NextResponse } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';
import { ensureCompanion, isAllowed } from '@/lib/companion/engine';
import { generateImage } from '@/lib/image';
import { callLLMJson } from '@/lib/llm';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST() {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.is_anonymous || !user.email) return NextResponse.json({ ok: false }, { status: 401 });
  const admin = createAdminClient();
  if (!(await isAllowed(admin, user))) return NextResponse.json({ ok: false, reason: 'not_allowed' }, { status: 403 });
  const c = await ensureCompanion(admin, user.id);
  if (!c.persona && !c.job) return NextResponse.json({ ok: false, reason: 'no_persona' }, { status: 409 });

  // 让模型按人设挑头像类型 + 具体内容
  let pick: any = {};
  try {
    const { data } = await callLLMJson<any>({
      system: `Decide what this fictional companion uses as their profile picture, like a real young Chinese person. DEFAULT to a candid everyday selfie of themselves (most people do). Only occasionally, if it really fits the persona, use their pet or an anime avatar. Output ONLY JSON: {"type":"selfie"|"pet"|"anime","gender":"f"|"m","desc":"short concrete English description"}. Strongly prefer "selfie".`,
      messages: [{ role: 'user', content: `Name: ${c.ai_name}\nPersonality: ${c.persona}\nJob: ${c.job}` }],
      tier: 'aux', temperature: 0.95, maxTokens: 120, provider: 'deepseek',
    });
    pick = data || {};
  } catch {}
  const type = ['selfie', 'pet', 'anime'].includes(pick.type) ? pick.type : 'selfie';
  const desc = String(pick.desc || '').slice(0, 300);
  const g = pick.gender === 'm' ? 'guy' : 'woman';

  let prompt = '';
  if (type === 'pet') {
    prompt = `A cute candid phone snapshot of ${desc || 'an adorable fluffy pet (a cat or a small dog)'}, the kind of photo someone sets as their profile picture. Natural indoor lighting, cozy, real amateur phone photo, slightly imperfect, a bit of grain. Not a studio shot, not 3D render, not an obvious AI image. No text, no watermark.`;
  } else if (type === 'anime') {
    prompt = `An anime-style profile avatar illustration: ${desc || 'a gentle cute anime character, soft expression'}. Clean modern anime art, soft colors, nice composition, the kind of anime icon a young person uses online. Flat/semi-flat shading, NOT photorealistic. No text, no watermark, no signature.`;
  } else {
    const rnd = (a: string[]) => a[Math.floor(Math.random() * a.length)];
    // 场景 + 与之匹配的真实光源(成对,避免光跟环境对不上)
    const scenes = [
      { place: 'a messy bedroom', light: 'soft daylight from a side window' },
      { place: 'a bedroom at night', light: 'a warm dim bedside lamp, slightly underexposed' },
      { place: 'a cafe by the window', light: 'warm ambient cafe light mixed with window glow' },
      { place: 'an elevator with a mirror', light: 'cool white overhead fluorescent light casting a top-down shadow' },
      { place: 'a city sidewalk at dusk', light: 'fading golden-hour light with some street light' },
      { place: 'a city street at night', light: 'mixed neon and street lights, a bit noisy and dim' },
      { place: 'a park on an overcast day', light: 'flat soft overcast daylight' },
      { place: 'a park in the afternoon', light: 'bright dappled sunlight with lens flare' },
      { place: 'the passenger seat of a car', light: 'daylight through the windows, slightly backlit' },
      { place: 'a brightly lit convenience store', light: 'harsh bright white fluorescent light from above' },
      { place: 'a bathroom mirror', light: 'warm vanity light from the side' },
    ];
    const sc = rnd(scenes);
    const angles = [
      'taken at arm\'s length from a slightly HIGH angle looking down a bit',
      'taken at natural EYE LEVEL, phone straight on',
      'taken from a slightly LOW angle looking up a touch',
      'a three-quarter side angle, face turned partly away',
      'held a bit off to one side so the framing is loose and off-center',
    ];
    const expr = rnd(['a relaxed natural half-smile', 'a blank neutral look', 'mid-talk, not posing', 'slightly tired, no expression', 'a small playful smirk', 'looking just off-camera']);
    const mirror = sc.place.includes('mirror') || Math.random() < 0.25;
    prompt = (mirror
      ? `One candid everyday MIRROR selfie of a young adult East Asian ${g} in front of a mirror, the phone naturally visible, body slightly turned, in ${sc.place}. `
      : `One candid everyday front-camera SELFIE of a young adult East Asian ${g}, ${rnd(angles)}, ${expr}, imperfect believable framing, in ${sc.place}. `)
      + `${desc || 'natural relatable look, casual varied outfit, long black hair, light makeup'}. Lighting: ${sc.light} — the light direction and shadows must match this setting (do not use even studio lighting). Realistic skin texture with pores and tiny imperfections, subtle phone-camera noise and slight lens distortion, an unpolished social-media snapshot feel — like a selfie a friend posts. NOT a studio portrait, NOT a fashion model, NO heavy beauty filter, NO plastic smooth skin, NO exaggerated features, NO distorted hands, NOT a 3D render, NOT an obvious AI image. One person only. Head and shoulders. No text, no watermark, no logo.`;
  }

  try {
    const buf = await generateImage(prompt);
    const path = `avatars/companion/${user.id}.png`;
    const up = await admin.storage.from('scene-images').upload(path, buf, { contentType: 'image/png', upsert: true });
    if (up.error) throw new Error(up.error.message);
    const { data: pub } = admin.storage.from('scene-images').getPublicUrl(path);
    const url = `${pub.publicUrl}?t=${Date.now()}`;
    await admin.from('companion').update({ avatar_url: url }).eq('user_id', user.id);
    return NextResponse.json({ ok: true, avatarUrl: url, type });
  } catch (e: any) {
    return NextResponse.json({ ok: false, reason: 'img_failed', detail: e?.message }, { status: 500 });
  }
}
