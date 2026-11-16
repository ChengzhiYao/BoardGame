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
      system: `Decide what this fictional companion would use as their social-media profile picture, like a real young Chinese person on WeChat/Xiaohongshu — it is often NOT their own face. Choose one type that fits the persona and describe the image concretely. Output ONLY JSON: {"type":"selfie"|"pet"|"anime"|"object","gender":"f"|"m","desc":"short concrete English description of the picture"}. selfie=a candid everyday phone selfie of themselves; pet=a cute photo of their pet (cat/dog/bunny/hamster...); anime=an anime-style avatar in a fitting substyle; object=an aesthetic cozy object/scene (plushie, latte, flowers, sky, film still vibe).`,
      messages: [{ role: 'user', content: `Name: ${c.ai_name}\nPersonality: ${c.persona}\nJob: ${c.job}` }],
      tier: 'aux', temperature: 0.95, maxTokens: 120, provider: 'deepseek',
    });
    pick = data || {};
  } catch {}
  const type = ['selfie', 'pet', 'anime', 'object'].includes(pick.type) ? pick.type : 'selfie';
  const desc = String(pick.desc || '').slice(0, 300);
  const g = pick.gender === 'm' ? 'guy' : 'woman';

  let prompt = '';
  if (type === 'pet') {
    prompt = `A cute candid phone snapshot of ${desc || 'an adorable fluffy pet (a cat or a small dog)'}, the kind of photo someone sets as their profile picture. Natural indoor lighting, cozy, real amateur phone photo, slightly imperfect, a bit of grain. Not a studio shot, not 3D render, not an obvious AI image. No text, no watermark.`;
  } else if (type === 'anime') {
    prompt = `An anime-style profile avatar illustration: ${desc || 'a gentle cute anime character, soft expression'}. Clean modern anime art, soft colors, nice composition, the kind of anime icon a young person uses online. Flat/semi-flat shading, NOT photorealistic. No text, no watermark, no signature.`;
  } else if (type === 'object') {
    prompt = `An aesthetic, cozy phone photo used as a social-media avatar: ${desc || 'a cute plushie / a latte / soft flowers / a dreamy sky'}. Warm lifestyle vibe, soft natural light with a gentle filter, slightly imperfect real phone photo, film-like grain. Not a render, not an obvious AI image. No text, no watermark.`;
  } else {
    prompt = `An everyday candid SELFIE of a young Chinese ${g}, a real amateur front-camera phone photo like the ones posted on Xiaohongshu/Weibo. ${desc || 'natural relatable look, casual outfit'}. Messy-real setting (bedroom/street/cafe/car/mirror), soft natural light with a light everyday filter, casual slightly-off composition and angle, real skin texture with pores and tiny imperfections, a bit of phone-camera grain and softness — candid and imperfect, NOT a studio portrait, NOT retouched, NOT overly smooth, NOT 3D, NOT an obvious AI render. Real East Asian features. Looking at camera, head and shoulders. No text, no watermark, no logo.`;
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
