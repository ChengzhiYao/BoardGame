// 克苏鲁的海报与人物肖像：画一次存起来，永久复用（低画质 + JPEG 压缩，手机上看足够，最省钱）。
import { generateImage } from '@/lib/image';
import { artStyleFor, buildAvatarPrompt } from '@/lib/image/style';

async function store(admin: any, path: string, buf: Buffer): Promise<string | null> {
  const up = await admin.storage.from('scene-images').upload(path, buf, { contentType: 'image/jpeg', upsert: true });
  if (up.error) return null;
  return admin.storage.from('scene-images').getPublicUrl(path).data.publicUrl;
}

export async function makePoster(admin: any, m: { id: string; title?: string; hook?: string; tagline?: string; genre?: string; era?: string; place?: string }) {
  const style = artStyleFor(`${m.genre || ''} ${m.place || ''} ${m.era || ''}`);
  const prompt = `${style}\n恐怖电影海报的主视觉（只要画面，不要任何文字、标题、字母）：竖向构图，一个令人不安的标志性画面，留出上方大片暗部。\n故事：《${m.title || ''}》${m.tagline ? '——' + m.tagline : ''}。${(m.hook || '').slice(0, 160)}\n时代：${m.era || ''}；地点：${m.place || ''}。不要出现可辨认的真实人物。`;
  const buf = await generateImage(prompt, { quality: 'low', jpeg: 62 });
  const url = await store(admin, `posters/${m.id}.jpg`, buf);
  if (url) await admin.from('module_library').update({ poster_url: url }).eq('id', m.id);
  return url;
}

export async function makePortrait(admin: any, key: string, c: any, era?: string, theme?: string) {
  const buf = await generateImage(buildAvatarPrompt(c, era, theme), { quality: 'low', jpeg: 62 });
  return store(admin, `cast/${key}.jpg`, buf);
}
