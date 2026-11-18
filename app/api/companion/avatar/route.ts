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
  // 用户在问卷里选的性别优先(写在人设里「【性别】男/女」),没有才用模型猜的
  const gm = String(c.persona || '').match(/【性别】\s*(男|女)/);
  const g = gm ? (gm[1] === '男' ? 'guy' : 'woman') : (pick.gender === 'm' ? 'guy' : 'woman');

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
    // 女生排除会把脸拍丑的光线(日光灯顶光、偏绿车厢、脸欠曝)
    const uglyLight = /fluorescent|greenish|underexposed|shadows under/i;
    const pool = (mirror ? mirrorScenes : scenes).filter((x) => !(female && uglyLight.test(x.light)));
    const sc = rnd(pool.length ? pool : (mirror ? mirrorScenes : scenes));

    // ② 构图随意:随机挑 2 个"不完美"
    // 一半是"认真挑过角度"的小红书式构图(真人也会这样),一半是随手拍;都保留 1~2 个真实小瑕疵
    const posed = female && Math.random() < 0.75;
    const posedFraming = mirror
      ? 'she chose a flattering pose: hip slightly popped, one leg forward, phone held to the side of her face'
      : rnd([
          'she picked her best angle: phone held slightly above, chin a little down, eyes looking up into the lens, face turned about 45 degrees',
          'a deliberate cute close-up: face fills most of the frame, head tilted, one hand touching her cheek or hair',
          'she framed herself carefully with her face in the upper third and the place visible behind her',
        ]);
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
    ], posed ? 1 : 2);
    if (posed) framing.unshift(posedFraming);
    // ⑤ 手机真实瑕疵:随机挑 2~3 个
    const flaws = pickN([
      'slight motion blur from a shaky hand',
      'visible noise and grain in the darker areas',
      'JPEG compression artifacts like an image sent over a chat app',
      'the background is sharp, not creamy portrait-mode bokeh',
      'uneven exposure, some highlights clipped',
      ...(female ? [] : ['slight front-camera wide-angle distortion']),
      'the focus is slightly soft overall',
      'a slightly off auto white balance',
    ], posed ? 1 : 2 + Math.floor(Math.random() * 2));
    // 美颜:像真人用醒图/美颜相机/手机自带美颜修过,带 App 修图的痕迹,而不是 AI 的完美
    const beauty = female && Math.random() < 0.85;
    const beautyLine = beauty ? rnd([
      'Edited with a Chinese beauty app (like Xingtu/BeautyCam): skin brightened and lightly smoothed, eyes slightly enlarged, jawline slightly slimmed — but done by an app on a phone photo, so faint pores and hair strands still show, and the background near her cheek and jaw is very slightly warped',
      'The phone\'s built-in beauty mode at a low-to-medium level: a little smoother and brighter skin, a soft pinkish fresh filter on top, with the slight halo around the face edges that beauty modes leave',
      'A popular soft filter from a photo app (milky / slightly faded / pinkish fresh), plus light skin smoothing — the look of a typical edited Xiaohongshu selfie, still clearly a phone photo',
    ]) : '';

    // 好看来自五官和年纪,不来自精修
    const look = female
      ? rnd([
          'a strikingly beautiful young Chinese woman with big bright eyes, a small V-shaped face, a delicate nose and full lips',
          'a very cute and beautiful young Chinese woman, sweet doe eyes, soft features, bangs — the girl-next-door everyone has a crush on',
          'a gorgeous young Chinese woman with elegant, slightly cool features, high nose bridge, long neck',
          'a beautiful young Chinese woman who looks like a popular Douyin/Xiaohongshu beauty influencer, refined features, bright smile',
        ])
      : rnd([
          'a good-looking young Chinese man with clean features',
          'a handsome young East Asian guy with a boyish face',
        ]);
    const hair = female
      ? rnd(['long silky black hair with a few loose strands', 'long soft wavy brown hair', 'shoulder-length hair with airy bangs', 'a cute messy bun with face-framing strands', 'a high ponytail'])
      : rnd(['short black hair, a bit messy', 'a soft middle part, slightly greasy at the roots', 'a short crop']);
    const expr = female
      ? rnd(['a sweet natural smile', 'a cute slight pout', 'a soft calm look straight into the lens', 'half-smiling, mid-laugh', 'a playful peace sign near her face', 'a shy smile'])
      : rnd(['a small natural smile', 'a neutral look', 'a slight smirk']);

    const camera = mirror
      ? `A MIRROR SELFIE: ${look}, about ${age}, stands in front of ${sc.place} and photographs her reflection with her phone. The phone is clearly in her hand in the reflection. The mirror and its surroundings are obvious in the picture.`
      : `A FRONT-CAMERA SELFIE taken by ${look}, about ${age}, with the phone in her own outstretched hand. The viewpoint IS her phone's front camera at arm's length — so the phone itself is NOT visible in the picture. She is in ${sc.place}.`;

    if (female) {
      // 参考真实中国女生头像:光是主角(真实的太阳/窗光/车窗光),角度多样,很多是朋友拍的、不看镜头
      const LIGHTS = [
        { where: 'outdoors on a sunny late afternoon', light: 'hard warm sunlight from behind and to one side: her hair is backlit and glowing gold at the edges with flyaway strands lit up, the side of her face toward the sun is bright with a slightly blown-out highlight on the cheek, the other side falls into soft warm shadow, a faint sun flare/haze in the frame' },
        { where: 'at home right next to a window', light: 'strong daylight from a window very close on one side: that side of her face and hair is bright and glowing, light falls off quickly to a darker other side, the room behind is warm and dim' },
        { where: 'outdoors under trees', light: 'sunlight filtering through leaves, leaving dappled patches of bright light and shadow across her face, hair and clothes' },
        { where: 'in the back seat of a car on a sunny day', light: 'bright sun streaming in through the car window, part of her face and hair in direct warm sunlight, high contrast, the window area overexposed' },
        { where: 'outdoors in a garden or park', light: 'she tilts her face up toward the sun with eyes closed, her whole face washed in warm direct sunlight, glowing skin, bright soft highlights' },
        { where: 'by a lake or the sea on an overcast day', light: 'soft cool overcast daylight, gentle and even but with the sky behind her bright, slightly cool blue tones' },
        { where: 'on a city street in golden hour', light: 'low golden sun behind her, strong rim light around her hair and shoulders, her face in soft shade lit by bounced light, background bright and hazy' },
        { where: 'in her room at night', light: 'one warm dim lamp to the side, moody low-key light, most of the frame in soft shadow, a little grain' },
      ];
      const L0 = rnd(LIGHTS);
      const SHOTS = [
        // 自拍
        { by: 'a selfie she took with her phone\'s front camera at arm\'s length (the phone is not visible)', frame: rnd([
          'an extreme close-up, her face fills the frame and the top of her head is cropped off',
          'a close-up from slightly above, she looks up into the lens',
          'a close-up with her face turned three-quarters, eyes glancing at the lens',
          'her chin resting on her hand, close and slightly tilted',
          'lying on a pillow, the phone held above her, hair spread around',
        ]) },
        // 朋友/对象用手机给她拍
        { by: 'a candid photo a friend took of her with a phone', frame: rnd([
          'waist-up, she is looking away to the side, not at the camera, the wind blowing her long hair across her face',
          'a three-quarter profile, gazing off into the distance',
          'she looks up at the sky, face tilted back',
          'sitting down, hugging her knees, glancing at the camera over her arm',
          'half-body, mid-movement, turning back toward the camera with a slight smile',
          'a close side profile with strands of hair across her cheek',
          'shot through out-of-focus leaves or flowers in the foreground',
          'holding a bouquet of flowers near her face, looking down',
        ]) },
      ];
      const shot = Math.random() < 0.5 ? SHOTS[0] : SHOTS[1];
      const variant = Math.random();
      const outfit = desc || rnd(['a loose white blouse', 'a soft knit sweater', 'a simple camisole dress', 'an oversized shirt', 'a light cardigan', 'a casual blazer']);
      const hairLong = rnd(['long, voluminous, slightly messy dark-brown hair', 'long flowing black hair with lots of loose strands', 'long wavy light-brown hair', 'long hair with see-through bangs', 'long hair in two loose braids']);
      const mood = rnd(['a soft faint smile', 'a calm, slightly aloof look', 'a dreamy, absent gaze', 'a gentle closed-lip smile', 'slightly parted lips, relaxed']);
      if (variant < 0.1) {
        prompt = `A Chinese girl's social-media avatar photo that does not show her full face: ${rnd(['her back view with long hair, looking at a sunset over the sea', 'her hands making a heart shape around the setting sun, her face out of frame', 'a side profile mostly hidden by her long hair, warm window light'])}. Taken on a phone, warm natural light, soft hazy tones. Photorealistic, not an illustration. No text, no watermark.`;
      } else {
        prompt = `A real photo used as a young Chinese woman's WeChat / Xiaohongshu avatar, the "atmospheric" kind (氛围感) that pretty girls post.
She: ${look}, about ${age}, ${hairLong}, wearing ${outfit}. Light natural makeup with soft blush and rosy lips. Expression: ${mood}.
How it was taken: ${shot.by}. Framing: ${shot.frame}.
Where and LIGHT (the most important part): ${L0.where} — ${L0.light}. The light has a real direction and real falloff; shadows and highlights are uneven and natural. NOT front-lit, NOT evenly lit, NOT studio lighting.
Color and feel: warm, soft, slightly hazy and dreamy, lifted shadows, gentle contrast, a light beauty-app or soft film filter — like a phone photo edited in a Chinese photo app.
Detail: phone camera quality, slightly soft, not crisp, a little grain; hair strands catch the light.
She is genuinely beautiful. Photorealistic photo of a real person, not an illustration, not anime, not a 3D render, not a professional studio shoot. One adult woman only. No text, no watermark, no logo.`;
      }
    } else {
      prompt = `${camera} ${hair}. ${expr}. ${desc ? 'Outfit and vibe: ' + desc + '.' : 'Casual everyday clothes.'}
Background: ${sc.clutter} — ordinary, a bit messy, not arranged for the photo.
Lighting: only the existing light of the place — ${sc.light}. No studio lighting.
Composition: ${framing.join('; ')}. Phone-photo imperfections: ${flaws.join('; ')}.
Skin: real skin texture, not retouched. Plain smartphone colors, no cinematic grading.
He is good-looking and youthful; this is a real selfie he posted himself — NOT a professional photo, NOT third-person view, NOT a 3D render. One adult man only. No text, no watermark.`;
      prompt = prompt.replace(/\bher\b/g, 'his').replace(/\bHer\b/g, 'His').replace(/\bshe\b/g, 'he').replace(/\bShe\b/g, 'He').replace(/\bherself\b/g, 'himself');
    }
  }

  try {
    // 中档画质 + 较重 JPEG 压缩:像手机前置拍完再经微信发出来的画质,而不是高清相机
    const buf = await generateImage(prompt, { quality: 'medium', jpeg: 58 });
    const path = `avatars/companion/${user.id}.jpg`;
    const up = await admin.storage.from('scene-images').upload(path, buf, { contentType: buf[0] === 0xff ? 'image/jpeg' : 'image/png', upsert: true });
    if (up.error) throw new Error(up.error.message);
    const { data: pub } = admin.storage.from('scene-images').getPublicUrl(path);
    const url = `${pub.publicUrl}?t=${Date.now()}`;
    await admin.from('companion').update({ avatar_url: url }).eq('user_id', user.id);
    return NextResponse.json({ ok: true, avatarUrl: url, type });
  } catch (e: any) {
    return NextResponse.json({ ok: false, reason: 'img_failed', detail: e?.message }, { status: 500 });
  }
}
