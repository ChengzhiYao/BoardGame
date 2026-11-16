// 为伴侣生成写实头像(虚构人物,非真人冒用)。根据人设/职业先转外貌描述,再出图,存 Supabase。
import { NextResponse } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';
import { ensureCompanion, isAllowed } from '@/lib/companion/engine';
import { generateImage } from '@/lib/image';
import { callLLM } from '@/lib/llm';
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

  // 1) 人设 → 简短外貌描述(英文,便于出图)
  let look = '';
  try {
    const r = await callLLM({
      system: 'From a character persona, write a SHORT English visual description for a realistic phone selfie portrait of an ORIGINAL FICTIONAL person (not any real individual): apparent gender, age range, hair, style/clothing, expression/vibe, setting hint. One line, comma-separated, no names.',
      messages: [{ role: 'user', content: `Name: ${c.ai_name}\nPersonality: ${c.persona}\nJob: ${c.job}` }],
      tier: 'aux', temperature: 0.7, maxTokens: 120, provider: 'deepseek',
    });
    look = r.text.trim().replace(/\n/g, ' ').slice(0, 300);
  } catch {}

  const prompt = `A candid, photorealistic portrait photo of an original fictional person (not a real individual), looks like a real casual phone selfie: ${look || 'an ordinary approachable person'}. Natural lighting, soft focus background, warm realistic skin, everyday authentic look, head and shoulders, looking at camera. Not a cartoon, not an illustration, no text, no watermark.`;

  try {
    const buf = await generateImage(prompt);
    const path = `avatars/companion/${user.id}.png`;
    const up = await admin.storage.from('scene-images').upload(path, buf, { contentType: 'image/png', upsert: true });
    if (up.error) throw new Error(up.error.message);
    const { data: pub } = admin.storage.from('scene-images').getPublicUrl(path);
    const url = `${pub.publicUrl}?t=${Date.now()}`;
    await admin.from('companion').update({ avatar_url: url }).eq('user_id', user.id);
    return NextResponse.json({ ok: true, avatarUrl: url });
  } catch (e: any) {
    return NextResponse.json({ ok: false, reason: 'img_failed', detail: e?.message }, { status: 500 });
  }
}
