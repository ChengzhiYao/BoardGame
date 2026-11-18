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
      system: `Decide what this fictional companion uses as their profile picture, like a real young Chinese person. DEFAULT to a candid everyday selfie of themselves (most people do). Only occasionally, if it really fits the persona, use their pet or an anime avatar. Output ONLY JSON: {"type":"selfie"|"pet"|"anime","gender":"f"|"m","desc":"short concrete English description"}. Strongly prefer "selfie". The person is ALWAYS a young adult (age 21-27, never middle-aged). If female, she is genuinely beautiful — the kind of pretty girl whose selfies get tons of likes on Xiaohongshu; desc must ONLY describe outfit and vibe in a few words (e.g. "oversized grey hoodie, sleepy weekend vibe") — never lighting, camera, photography style, background, age, or skin.`,
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
    const pickN = <T,>(a: T[], n: number): T[] => [...a].sort(() => Math.random() - 0.5).slice(0, n);
    const female = g === 'woman';
    const age = 21 + Math.floor(Math.random() * 5); // 21-25

    // ④ 背景:普通、杂乱、不为人物服务;光源跟场景走(③ 不要电影布光)
    const scenes = [
      { place: 'her own bedroom', clutter: 'an unmade bed, a phone charger cable, clothes on a chair, a half-open wardrobe', light: 'flat daylight from a window off to one side, one side of the face a bit darker' },
      { place: 'her bedroom at night', clutter: 'a messy desk, a desk lamp, skincare bottles, a poster slightly crooked', light: 'one warm desk lamp only, the room behind falls into murky noisy darkness' },
      { place: 'a chain coffee shop', clutter: 'other customers partly in frame, cups and a tray, a menu board, chairs', light: 'mixed: cool overhead ceiling lights plus window light, slightly uneven white balance' },
      { place: 'an office building elevator', clutter: 'scratched steel walls, a floor-number panel, an inspection notice taped up', light: 'harsh flat overhead fluorescent light, slightly greenish, shadows under the eyes and nose' },
      { place: 'a subway car', clutter: 'handrails, ads, a few strangers looking at their phones', light: 'flat cold fluorescent light, a little greenish' },
      { place: 'a city street during the day', clutter: 'parked e-bikes, shop signs, random pedestrians, a trash bin', light: 'plain midday daylight, a bit contrasty, the sky behind slightly blown out' },
      { place: 'a street at night', clutter: 'shop fronts, a passing scooter blurred, signs, a convenience store glow', light: 'uneven street and shop light from one side, dark noisy shadows, face slightly underexposed' },
      { place: 'the back seat of a ride-hailing car', clutter: 'the headrest in front, seatbelt, window with buildings outside', light: 'daylight through the window behind her, the face a bit underexposed, window partly blown out' },
      { place: 'a university classroom or library', clutter: 'desks, a laptop, a water bottle, other students in the background', light: 'flat overhead tube lighting' },
      { place: 'a restaurant table with friends', clutter: 'dishes, chopsticks, drink cans, a friend\'s arm in frame', light: 'warm-ish restaurant ceiling light, slightly yellow cast' },
    ];
    const mirrorScenes = [
      { place: 'a full-length mirror at home', clutter: 'a messy room reflected behind her, shoes on the floor, a door', light: 'ordinary room light, slightly dim' },
      { place: 'a mall restroom mirror', clutter: 'sinks, a hand dryer, other mirrors, a cleaning sign', light: 'bright overhead restroom light' },
      { place: 'an elevator mirror wall', clutter: 'the floor-number panel and handrail visible in the reflection', light: 'flat overhead elevator light' },
      { place: 'a fitting-room mirror', clutter: 'hooks with clothes, a curtain, a small stool', light: 'top-down fitting-room spotlight, a bit harsh' },
    ];
    // ⑥ 拍摄逻辑二选一,写死:前置=手机就是镜头;对镜=必须有明确的镜子
    const mirror = Math.random() < 0.3;
    const sc = mirror ? rnd(mirrorScenes) : rnd(scenes);

    // ② 构图随意:随机挑 2 个"不完美"
    const framing = pickN(mirror ? [
      'the phone held in front of her chest/face, partly covering her chin',
      'the photo is tilted a few degrees',
      'her body is off-center, the frame cuts off her feet or one shoulder',
      'smudges and fingerprints on the mirror',
      'the phone\'s flash reflection is visible in the mirror as a glare spot',
    ] : [
      'her face is off-center, closer to one edge of the frame',
      'the top of her head is cut off by the frame',
      'the photo is tilted a few degrees',
      'her extended arm enters the frame from the bottom corner and is cut off',
      'shot from slightly above at arm\'s length, the classic phone angle',
      'part of her shoulder or hair fills a corner of the frame',
    ], 2);
    // ⑤ 手机真实瑕疵:随机挑 2~3 个
    const flaws = pickN([
      'slight motion blur from a shaky hand',
      'visible noise and grain in the darker areas',
      'JPEG compression artifacts like an image sent over a chat app',
      'the background is sharp, not creamy portrait-mode bokeh',
      'uneven exposure, some highlights clipped',
      'slight front-camera wide-angle distortion — the nose and face nearest the lens look a little bigger',
      'the focus is slightly soft overall',
      'a slightly off auto white balance',
    ], 2 + Math.floor(Math.random() * 2));

    // 好看来自五官和年纪,不来自精修
    const look = female
      ? rnd([
          'a naturally very pretty young Chinese woman with big eyes and a small face',
          'a cute, pretty young Chinese woman with soft round eyes and bangs',
          'a pretty young Chinese woman with sharp delicate features, slightly cool vibe',
          'a pretty, sweet-looking young East Asian woman with a bright smile',
        ])
      : rnd([
          'a good-looking young Chinese man with clean features',
          'a handsome young East Asian guy with a boyish face',
        ]);
    const hair = female
      ? rnd(['long straight black hair, a few loose flyaway strands', 'long dark-brown hair, slightly messy', 'shoulder-length hair with bangs, a bit uneven', 'hair tied up in a messy bun with loose strands', 'a low ponytail, some hair escaping'])
      : rnd(['short black hair, a bit messy', 'a soft middle part, slightly greasy at the roots', 'a short crop']);
    const expr = female
      ? rnd(['a small natural smile', 'a slight pout', 'a neutral look straight into the lens', 'half-smiling, mid-laugh', 'a playful peace sign near her face', 'eyes slightly squinting from the light'])
      : rnd(['a small natural smile', 'a neutral look', 'a slight smirk']);

    const camera = mirror
      ? `A MIRROR SELFIE: ${look}, about ${age}, stands in front of ${sc.place} and photographs her reflection with her phone. The phone is clearly in her hand in the reflection. The mirror and its surroundings are obvious in the picture.`
      : `A FRONT-CAMERA SELFIE taken by ${look}, about ${age}, with the phone in her own outstretched hand. The viewpoint IS her phone's front camera at arm's length (about 40-60 cm from her face) — so the phone itself is NOT visible in the picture. She is in ${sc.place}.`;

    prompt = `${camera} ${hair}. ${expr}. ${desc ? 'Outfit and vibe: ' + desc + '.' : 'Casual everyday clothes.'} Light everyday makeup at most.
Background: ${sc.clutter} — ordinary, a bit messy, NOT arranged for the photo.
Lighting: only the existing light of the place — ${sc.light}. No photographer lighting, no fill light, no rim light.
Composition: ${framing.join('; ')}.
Phone-photo imperfections: ${flaws.join('; ')}.
Skin: real skin with visible pores on the nose and cheeks, slight unevenness in skin tone, maybe a tiny blemish — not smoothed, not retouched.
Colors: plain smartphone colors straight out of the camera app, no cinematic color grading, no golden film look, no teal-orange.
The person is ${female ? 'genuinely pretty and youthful' : 'good-looking and youthful'}, but this is an unedited snapshot sent to a friend on WeChat — NOT a professional photo, NOT a magazine or ad, NOT third-person view, NOT a DSLR portrait with shallow depth of field, NOT a 3D render. One adult person only. No text, no watermark.`;
    if (!female) prompt = prompt.replace(/\bher\b/g, 'his').replace(/\bHer\b/g, 'His').replace(/\bshe\b/g, 'he').replace(/\bShe\b/g, 'He').replace(/\bherself\b/g, 'himself');
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
