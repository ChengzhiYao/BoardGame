// 讲故事：故事写好的同时就把声音和配乐线索做好（不用再手动点"生成朗读"）。
// 声音用 Fish 免费真人声音，按段合成后拼成一条；记下每段在整条音频里的起止位置（按字节比例，mp3 恒定码率时就是时间比例），
// 前端据此做"念到哪、字就从哪冒出来"的大字效果。
import { createHash } from 'crypto';
import { LINGER_URL } from '@/lib/linger/companion';
import { callLLMJson } from '@/lib/llm';
import { buildStoryCuesPrompt, STORY_MOODS, STORY_SFX } from '@/lib/story/prompt';

export const FISH_VOICES: Record<string, { zh: string; en: string; speed: number }> = {
  gentle_f: { zh: '26c259f0f07247c98899ae4cfa1774be', en: '933563129e564b19a115bedd57b7406a', speed: 0.97 },
  deep_m: { zh: '591cbde691fd40ebac212f16d05bf334', en: 'c5f56a6cc2ec4fa8920cb4c5889a3fb7', speed: 0.95 },
  healing: { zh: '7b577042ea3d46e0a152e0172cef78c8', en: 'b347db033a6549378b48d00acb0d06cd', speed: 0.95 },
  eerie: { zh: '22dd5bf942eb4aab962cc45c2211cb38', en: '3778d9610ede45cda7976d2dc51ed369', speed: 0.92 },
  whisper: { zh: '9a57d4b15e80433da1191abd881ed6ea', en: 'f48d143a59a946ab87c0130fd081f349', speed: 0.93 },
};

export function presetFor(genre: string, params?: any): string {
  const g = String(genre || '') + ' ' + (Array.isArray(params?.genres) ? params.genres.join(' ') : '');
  if (/horror|恐怖|惊悚|克苏鲁|怪谈|诡|灵异|真实经历/.test(g)) return 'eerie';
  if (/治愈|温馨|温情|healing|cozy/.test(g)) return 'healing';
  if (/悬疑|mystery|noir/.test(g)) return 'deep_m';
  return 'gentle_f';
}

const paragraphs = (story: string) => String(story || '').split(/\n+/).map((p) => p.trim()).filter(Boolean);

async function tts(text: string, voice: string, lang: string, speed: number): Promise<Buffer> {
  const r = await fetch(`${LINGER_URL}/api/mystnight/tts`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-linger-key': process.env.LINGER_BRIDGE_KEY || '' }, body: JSON.stringify({ text, voice, lang, speed }) });
  if (!r.ok) throw new Error('fish ' + r.status);
  return Buffer.from(await r.arrayBuffer());
}

// 返回 { url, segs: [{ i: 段落序号, a: 开始比例, b: 结束比例 }] }
export async function narrateStory(admin: any, story: string, lang: 'zh' | 'en', preset: string, ghostLines?: any[]): Promise<{ url: string; segs: { i: number; a: number; b: number }[]; voice: string; preset: string } | null> {
  const paras = paragraphs(story);
  if (!paras.length) return null;
  const v = FISH_VOICES[preset] || FISH_VOICES.gentle_f;
  const voice = v[lang];
  // 怪谈库里的故事每句都已经配好音（还是分角色的不同声音）：直接拼起来，不再花额度
  let bufs: Buffer[] | null = null;
  if (ghostLines?.length && ghostLines.length === paras.length && ghostLines.every((l) => l.audio)) {
    try { bufs = await Promise.all(ghostLines.map(async (l) => Buffer.from(await (await fetch(l.audio)).arrayBuffer()))); } catch { bufs = null; }
  }
  const hash = createHash('sha1').update(`story2|${ghostLines?.length ? 'ghost' : voice}|${story}`).digest('hex');
  const path = `story-tts/${hash}.mp3`;
  if (!bufs) {
    bufs = new Array(paras.length);
    for (let k = 0; k < paras.length; k += 4) {
      const res = await Promise.all(paras.slice(k, k + 4).map(async (p) => {
        // 段落太长就拆开念，再拼回这一段
        const parts: string[] = []; let rest = p;
        while (rest.length > 480) { const cut = Math.max(rest.lastIndexOf('。', 480), rest.lastIndexOf('！', 480), rest.lastIndexOf('？', 480), rest.lastIndexOf('. ', 480)); const n = cut > 120 ? cut + 1 : 480; parts.push(rest.slice(0, n)); rest = rest.slice(n); }
        if (rest.trim()) parts.push(rest);
        const b = await Promise.all(parts.map((t) => tts(t, voice, lang, v.speed)));
        return Buffer.concat(b);
      }));
      res.forEach((b, n) => { bufs![k + n] = b; });
    }
  }
  const total = bufs.reduce((a, b) => a + b.length, 0);
  if (total < 4000) return null;
  let acc = 0;
  const segs = bufs.map((b, i) => { const a = acc / total; acc += b.length; return { i, a: Math.round(a * 10000) / 10000, b: Math.round((acc / total) * 10000) / 10000 }; });
  const up = await admin.storage.from('scene-images').upload(path, Buffer.concat(bufs), { contentType: 'audio/mpeg', upsert: true });
  if (up.error) return null;
  return { url: admin.storage.from('scene-images').getPublicUrl(path).data.publicUrl, segs, voice, preset };
}

export async function cueStory(story: string, genre: string, lang: string) {
  const paras = paragraphs(story);
  try {
    const { data } = await callLLMJson<any>({ system: buildStoryCuesPrompt(paras, genre, lang), messages: [{ role: 'user', content: '请逐段配乐。' }], tier: 'aux', temperature: 0.4, maxTokens: 2400, retry: true });
    const raw: any[] = Array.isArray(data?.cues) ? data.cues : [];
    const words = STORY_MOODS.map((m) => m.word);
    return paras.map((_, i) => { const c = raw.find((x) => Number(x?.i) === i) || raw[i] || {}; return { mood: words.includes(c?.mood) ? c.mood : 'calm', sfx: (Array.isArray(c?.sfx) ? c.sfx : []).filter((k: string) => STORY_SFX.includes(k)).slice(0, 2), stinger: !!c?.stinger }; });
  } catch { return null; }
}
