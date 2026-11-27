// 海龟汤题库配音：汤面 / 汤底各合成一次（Fish 免费模型，经 Linger 桥），存进 storage，地址写回题库。
import { createHash } from 'crypto';
import { store } from '@/lib/store';
import { LINGER_URL } from '@/lib/linger/companion';

export async function voiceLine(admin: any, text: string, lang: 'zh' | 'en'): Promise<string | null> {
  const clean = String(text || '').trim().slice(0, 600);
  if (!clean) return null;
  const hash = createHash('sha1').update(`soup|v1|${lang}|${clean}`).digest('hex');
  const path = `tts/soup-${hash}.mp3`;
  const url = store(admin).from('scene-images').getPublicUrl(path).data.publicUrl;
  const { data: hit } = await store(admin).from('scene-images').list('tts', { search: `soup-${hash}.mp3`, limit: 1 });
  if (hit && hit.length) return url;
  const r = await fetch(`${LINGER_URL}/api/mystnight/tts`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-linger-key': process.env.LINGER_BRIDGE_KEY || '' }, body: JSON.stringify({ text: clean, narrator: true, lang }) });
  if (r.status === 429) throw new Error('quota');
  if (!r.ok) return null;
  const buf = Buffer.from(await r.arrayBuffer());
  const up = await store(admin).from('scene-images').upload(path, buf, { contentType: 'audio/mpeg', upsert: true });
  return up.error ? null : url;
}

export async function voicePuzzle(admin: any, row: { id: string; lang: string; surface: string; bottom: string; surface_audio?: string | null; bottom_audio?: string | null }) {
  const lang = row.lang === 'en' ? 'en' : 'zh';
  const s = row.surface_audio || await voiceLine(admin, row.surface, lang);
  const b = row.bottom_audio || await voiceLine(admin, row.bottom, lang);
  if (s || b) await admin.from('soup_library').update({ surface_audio: s, bottom_audio: b }).eq('id', row.id);
  return { s, b };
}
