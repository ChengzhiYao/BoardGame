// 图片生成适配器（OpenAI）。风格由调用方通过 lib/image/style 的 builder 注入，
// 保证头像与场景图共用同一套锁定风格。
import OpenAI from 'openai';

let _client: OpenAI | null = null;
function client() {
  if (!_client)
    _client = new OpenAI({ apiKey: process.env.IMAGE_API_KEY || process.env.OPENAI_API_KEY });
  return _client;
}

// prompt 应已由 buildScenePrompt / buildAvatarPrompt 套好统一风格。
// 不传 response_format（不同模型支持不一）：返回 b64 就解码，返回 url 就下载，通用。
export async function generateImage(prompt: string): Promise<Buffer> {
  const model = process.env.IMAGE_MODEL || 'gpt-image-1-mini';
  const res = await client().images.generate({ model, prompt, size: '1024x1024', n: 1 });
  const d: any = res.data?.[0];
  if (d?.b64_json) return Buffer.from(d.b64_json, 'base64');
  if (d?.url) {
    const r = await fetch(d.url);
    if (!r.ok) throw new Error('下载生成图片失败');
    return Buffer.from(await r.arrayBuffer());
  }
  throw new Error('图片生成未返回数据');
}
