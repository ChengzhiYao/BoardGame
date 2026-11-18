// 为伴侣生成头像。以自拍为主(偶尔宠物/动漫);人物一律 21-26 岁年轻成年人,女生偏好看的网红自拍感。
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
      system: `Decide what this fictional companion uses as their profile picture, like a real young Chinese person. DEFAULT to a candid everyday selfie of themselves (most people do). Only occasionally, if it really fits the persona, use their pet or an anime avatar. Output ONLY JSON: {"type":"selfie"|"pet"|"anime","gender":"f"|"m","desc":"short concrete English description"}. Strongly prefer "selfie". The person is ALWAYS a young adult (age 21-27, never middle-aged). If female, she is genuinely beautiful — the kind of pretty girl whose selfies get tons of likes on Xiaohongshu; describe her hair, outfit and vibe in an attractive, flattering way (never plain, tired-looking or older). Do not describe age lines, wrinkles or a mature look.`,
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
    const rnd = <T,>(a: T[]): T => a[Math.floor(Math.random() * a.length)];
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
    const female = g === 'woman';
    // 女生:年轻漂亮 + 好看的角度/表情;男生:年轻清爽帅气
    const age = 21 + Math.floor(Math.random() * 6); // 21-26
    const look = female
      ? rnd([
          'a gorgeous young Chinese woman with delicate features, big bright eyes, a small V-shaped face, flawless glowing skin',
          'a very pretty young East Asian woman, sweet and cute look, doe eyes, soft rosy cheeks, glossy lips',
          'a stunning young Chinese woman with an elegant, slightly cool "goddess" vibe, sharp pretty features, clear fair skin',
          'a beautiful young Korean-style East Asian girl, fresh and youthful, airy bangs, natural pink makeup',
          'an attractive young Chinese woman with a sexy-chic city-girl vibe, defined eyeliner, glossy lips, sleek long hair',
        ])
      : rnd([
          'a handsome young Chinese man with clean sharp features, clear skin, neat hair',
          'a good-looking young East Asian guy, fresh boyish face, soft fringe',
          'an attractive young Chinese man with a cool laid-back vibe, defined jawline',
        ]);
    const hair = female
      ? rnd(['long straight black hair', 'long wavy dark-brown hair', 'shoulder-length hair with airy bangs', 'a high ponytail with face-framing strands', 'a messy cute half-up bun', 'long hair tucked behind one ear'])
      : rnd(['short textured black hair', 'a soft middle-part', 'a neat short crop']);
    const angles = female ? [
      'taken at arm\'s length from a slightly HIGH angle looking down a bit (the flattering selfie angle)',
      'taken at natural EYE LEVEL, phone straight on',
      'a three-quarter angle showing her best side',
      'held a bit off to one side, head slightly tilted, cute framing',
    ] : [
      'taken at arm\'s length from a slightly HIGH angle looking down a bit',
      'taken at natural EYE LEVEL, phone straight on',
      'taken from a slightly LOW angle looking up a touch',
      'a three-quarter side angle, face turned partly away',
    ];
    const expr = female
      ? rnd(['a sweet soft smile', 'a cute pout', 'a playful wink', 'a gentle calm look into the lens', 'a shy smile glancing slightly away', 'a cheeky grin', 'a cool confident look'])
      : rnd(['a relaxed natural half-smile', 'a cool neutral look', 'a small playful smirk', 'looking just off-camera']);
    const mirror = sc.place.includes('mirror') || Math.random() < 0.25;
    prompt = (mirror
      ? `One everyday MIRROR selfie of ${look}, age ${age}, in front of a mirror, the phone naturally visible, body slightly turned, in ${sc.place}. `
      : `One everyday front-camera SELFIE of ${look}, age ${age}, ${rnd(angles)}, ${expr}, imperfect believable framing, in ${sc.place}. `)
      + `${hair}. ${desc || (female ? 'cute stylish casual outfit, natural light makeup' : 'clean casual outfit')}. Lighting: ${sc.light} — the light direction and shadows must match this setting (do not use even studio lighting). `
      + (female
        ? `She looks genuinely beautiful and youthful, like a popular girl's selfie on Xiaohongshu/Instagram: a light phone beauty-camera filter (soft glow, slightly brightened skin, gentle warm tone), but still believable as a real phone photo with real skin texture, natural hair strands and a real background. Flattering composition. NOT middle-aged, NO wrinkles, NOT plain or average-looking, NOT plastic doll skin, NOT an over-processed 3D look, NO distorted hands or face. `
        : `He looks handsome and youthful, like a real guy's selfie on social media: realistic skin texture, subtle phone-camera noise, natural casual feel. NOT middle-aged, NOT a studio portrait, NO distorted hands, NOT a 3D render. `)
      + `Photorealistic smartphone photo, not an illustration, not an obvious AI image. One adult person only. Head and shoulders. No text, no watermark, no logo.`;
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
