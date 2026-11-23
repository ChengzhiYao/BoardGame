// 介绍配音：只合成 lib/intro.ts 里的固定稿子，用 Fish 免费模型（经 Linger 桥），第一次生成后存起来反复用。
import { NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { createAdminClient } from '@/lib/supabase/server';
import { LINGER_URL } from '@/lib/linger/companion';
import { INTRO } from '@/lib/intro';
export const maxDuration = 60;

export async function GET(req: Request) {
  const u = new URL(req.url);
  const k = u.searchParams.get('k') || '';
  const lang = u.searchParams.get('lang') === 'en' ? 'en' : 'zh';
  const text = INTRO[k]?.[lang];
  if (!text) return NextResponse.json({ error: 'unknown' }, { status: 404 });
  const admin = createAdminClient();
  const hash = createHash('sha1').update(`intro|v1|${lang}|${text}`).digest('hex');
  const path = `tts/intro-${hash}.mp3`;
  const pub = admin.storage.from('scene-images').getPublicUrl(path).data.publicUrl;
  const { data: hit } = await admin.storage.from('scene-images').list('tts', { search: `intro-${hash}.mp3`, limit: 1 });
  if (hit && hit.length) return NextResponse.json({ url: pub }, { headers: { 'Cache-Control': 's-maxage=86400' } });
  try {
    const r = await fetch(`${LINGER_URL}/api/mystnight/tts`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-linger-key': process.env.LINGER_BRIDGE_KEY || '' }, body: JSON.stringify({ text, narrator: true, lang }) });
    if (!r.ok) return NextResponse.json({ error: r.status === 429 ? 'quota' : 'voice' }, { status: r.status === 429 ? 429 : 502 });
    const buf = Buffer.from(await r.arrayBuffer());
    const up = await admin.storage.from('scene-images').upload(path, buf, { contentType: 'audio/mpeg', upsert: true });
    if (up.error) return NextResponse.json({ error: up.error.message }, { status: 500 });
    return NextResponse.json({ url: pub }, { headers: { 'Cache-Control': 's-maxage=86400' } });
  } catch { return NextResponse.json({ error: 'voice' }, { status: 502 }); }
}
