// 讲故事 · 整篇朗读合成。优先 Azure（若配置），否则用 OpenAI TTS（与 CoC 语音同一套 key）。都返回 MP3，可拖动进度。
import { NextResponse } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';
import { createHash } from 'crypto';
import OpenAI from 'openai';
import { loadStory, persistStory } from '@/lib/story/db';
import { LINGER_URL } from '@/lib/linger/companion';

// 真人感 Fish 声音（经 Linger 桥、只用免费模型），按用户选的音色挑
const FISH: Record<string, { zh: string; en: string; speed: number }> = {
  gentle_f: { zh: '26c259f0f07247c98899ae4cfa1774be', en: '933563129e564b19a115bedd57b7406a', speed: 0.97 },
  deep_m: { zh: '591cbde691fd40ebac212f16d05bf334', en: 'c5f56a6cc2ec4fa8920cb4c5889a3fb7', speed: 0.95 },
  healing: { zh: '7b577042ea3d46e0a152e0172cef78c8', en: 'b347db033a6549378b48d00acb0d06cd', speed: 0.95 },
  eerie: { zh: '22dd5bf942eb4aab962cc45c2211cb38', en: '3778d9610ede45cda7976d2dc51ed369', speed: 0.92 },
  whisper: { zh: '9a57d4b15e80433da1191abd881ed6ea', en: 'f48d143a59a946ab87c0130fd081f349', speed: 0.93 },
};
async function fishStory(text: string, voice: string, lang: string, speed: number): Promise<Buffer | null> {
  const paras = text.split(/\n+/).map((p) => p.trim()).filter(Boolean);
  const parts: string[] = [];
  for (const p of paras) { let rest = p; while (rest.length > 480) { const cut = Math.max(rest.lastIndexOf('。', 480), rest.lastIndexOf('！', 480), rest.lastIndexOf('？', 480), rest.lastIndexOf('. ', 480)); const k = cut > 120 ? cut + 1 : 480; parts.push(rest.slice(0, k)); rest = rest.slice(k); } if (rest.trim()) parts.push(rest); }
  const out: (Buffer | null)[] = new Array(parts.length).fill(null);
  for (let k = 0; k < parts.length; k += 4) {
    const res = await Promise.all(parts.slice(k, k + 4).map(async (t) => {
      const r = await fetch(`${LINGER_URL}/api/mystnight/tts`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-linger-key': process.env.LINGER_BRIDGE_KEY || '' }, body: JSON.stringify({ text: t, voice, lang, speed }) });
      if (!r.ok) throw new Error('fish ' + r.status);
      return Buffer.from(await r.arrayBuffer());
    }));
    res.forEach((b, n) => { out[k + n] = b; });
  }
  return out.every(Boolean) ? Buffer.concat(out as Buffer[]) : null;
}

export const maxDuration = 300;

type Preset = { voice: string; style?: string; pitch?: string };
const AZ: Record<string, { zh: Preset; en: Preset }> = {
  gentle_f: { zh: { voice: 'zh-CN-XiaoxiaoNeural', style: 'gentle' }, en: { voice: 'en-US-JennyNeural', style: 'friendly' } },
  deep_m:   { zh: { voice: 'zh-CN-YunjianNeural', style: 'narration-relaxed', pitch: '-4%' }, en: { voice: 'en-US-GuyNeural', pitch: '-4%' } },
  healing:  { zh: { voice: 'zh-CN-XiaoxiaoNeural', style: 'affectionate' }, en: { voice: 'en-US-AriaNeural', style: 'calm' } },
  eerie:    { zh: { voice: 'zh-CN-YunjianNeural', style: 'serious', pitch: '-6%' }, en: { voice: 'en-US-GuyNeural', pitch: '-6%' } },
  whisper:  { zh: { voice: 'zh-CN-XiaoxiaoNeural', style: 'fearful', pitch: '-2%' }, en: { voice: 'en-US-JennyNeural', style: 'whispering' } },
};
const OAI_VOICE: Record<string, string> = { gentle_f: 'shimmer', deep_m: 'onyx', healing: 'nova', eerie: 'onyx', whisper: 'echo' };

function esc(s: string) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;'); }
function ratePct(rate: number) { const r = Math.round((Math.max(0.7, Math.min(1.2, rate || 0.9)) - 1) * 100); return (r >= 0 ? '+' : '') + r + '%'; }
function chunk(text: string, max: number): string[] {
  const parts = text.replace(/\r/g, '').split(/(?<=[。！？!?.\n])/);
  const out: string[] = []; let cur = '';
  for (const p of parts) { if ((cur + p).length > max && cur) { out.push(cur); cur = p; } else cur += p; }
  if (cur.trim()) out.push(cur);
  return out.length ? out : [text];
}

export async function POST(req: Request) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });
  const { roomId, voice: voiceKey, rate } = await req.json().catch(() => ({} as any));
  if (!roomId) return NextResponse.json({ error: '缺少参数' }, { status: 400 });

  const admin = createAdminClient();
  const { data: room } = await admin.from('rooms').select('host_user_id, language').eq('id', roomId).maybeSingle();
  if (!room) return NextResponse.json({ error: '房间不存在' }, { status: 404 });
  const { data: me } = await admin.from('players').select('id').eq('room_id', roomId).eq('user_id', user.id).maybeSingle();
  if (!me) return NextResponse.json({ error: '你不在这个房间' }, { status: 403 });

  const azureKey = process.env.AZURE_SPEECH_KEY;
  const azureRegion = process.env.AZURE_SPEECH_REGION || 'eastus';
  const openaiKey = process.env.IMAGE_API_KEY || process.env.OPENAI_API_KEY;
  const useAzure = !!azureKey; // 讲故事朗读：只要配了 Azure key 就用 Azure（与 CoC 的 TTS_PROVIDER 解耦）
  if (!useAzure && !openaiKey) return NextResponse.json({ error: '未配置语音服务：需要 AZURE_SPEECH_KEY 或 OPENAI_API_KEY 其中之一' }, { status: 500 });

  const state = await loadStory(admin, roomId);
  const story = String(state?.full?.story || '').trim();
  if (!story) return NextResponse.json({ error: '还没有故事正文' }, { status: 409 });

  const zh = room.language !== 'en';
  const presetKey = OAI_VOICE[voiceKey] ? voiceKey : 'gentle_f';
  const speed = Number(rate) || 0.9;
  const preset: Preset = AZ[presetKey][zh ? 'zh' : 'en'];
  const voice = useAzure ? preset.voice : OAI_VOICE[presetKey];
  const tag = useAzure ? 'az' : 'oai';
  const hash = createHash('sha1').update(`story|${tag}|${voice}|${preset.style || ''}|${preset.pitch || ''}|${speed}|${story}`).digest('hex');
  const path = `story-tts/${hash}.mp3`;

  const persist = async (url: string) => persistStory(admin, roomId, { ...state, phase: 'reading', narration: { url, voice, preset: presetKey, speed, provider: tag, ts: Date.now() }, playback: { playing: false, position: 0, ts: Date.now() } });

  // 先用 Fish 免费真人声音（整篇按段合成再拼起来）；失败或额度用完再退回原来的声音
  const fv = (FISH[presetKey] || FISH.gentle_f)[zh ? 'zh' : 'en'];
  const fhash = createHash('sha1').update(`story|fish|${fv}|${story}`).digest('hex');
  const fpath = `story-tts/${fhash}.mp3`;
  try {
    const { data: fx } = await admin.storage.from('scene-images').list('story-tts', { search: `${fhash}.mp3`, limit: 1 });
    let furl: string | null = fx && fx.length ? admin.storage.from('scene-images').getPublicUrl(fpath).data.publicUrl : null;
    if (!furl) {
      const fb = await fishStory(story, fv, zh ? 'zh' : 'en', (FISH[presetKey] || FISH.gentle_f).speed);
      if (fb && fb.length > 4000) { const up = await admin.storage.from('scene-images').upload(fpath, fb, { contentType: 'audio/mpeg', upsert: true }); if (!up.error) furl = admin.storage.from('scene-images').getPublicUrl(fpath).data.publicUrl; }
    }
    if (furl) {
      await persistStory(admin, roomId, { ...state, phase: 'reading', narration: { url: furl, voice: fv, preset: presetKey, speed, provider: 'fish', ts: Date.now() }, playback: { playing: false, position: 0, ts: Date.now() } });
      return NextResponse.json({ ok: true, url: furl, provider: 'fish' });
    }
  } catch (e: any) { await admin.from('error_logs').insert({ room_id: roomId, scope: 'tts', message: '讲故事 Fish 朗读失败，退回旧声音:' + String(e?.message || e).slice(0, 120) }); }

  const { data: existing } = await admin.storage.from('scene-images').list('story-tts', { search: `${hash}.mp3`, limit: 1 });
  if (existing && existing.length) {
    const { data: pub } = admin.storage.from('scene-images').getPublicUrl(path);
    await persist(pub.publicUrl);
    return NextResponse.json({ ok: true, url: pub.publicUrl, cached: true });
  }

  try {
    const bufs: Buffer[] = [];
    if (useAzure) {
      for (const seg of chunk(story, 1500)) {
        const inner = `<prosody rate='${ratePct(speed)}'${preset.pitch ? ` pitch='${preset.pitch}'` : ''}>${esc(seg)}</prosody>`;
        const body = preset.style ? `<mstts:express-as style='${preset.style}'>${inner}</mstts:express-as>` : inner;
        const ssml = `<speak version='1.0' xmlns:mstts='https://www.w3.org/2001/mstts' xml:lang='${zh ? 'zh-CN' : 'en-US'}'><voice name='${voice}'>${body}</voice></speak>`;
        const r = await fetch(`https://${azureRegion}.tts.speech.microsoft.com/cognitiveservices/v1`, {
          method: 'POST',
          headers: { 'Ocp-Apim-Subscription-Key': azureKey!, 'Content-Type': 'application/ssml+xml', 'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3', 'User-Agent': 'mystnight' },
          body: ssml,
        });
        if (!r.ok) throw new Error('Azure TTS ' + r.status + ' ' + (await r.text()).slice(0, 160));
        bufs.push(Buffer.from(await r.arrayBuffer()));
      }
    } else {
      const client = new OpenAI({ apiKey: openaiKey });
      const model = process.env.TTS_MODEL || 'gpt-4o-mini-tts';
      for (const seg of chunk(story, 3800)) {
        let res;
        try { res = await client.audio.speech.create({ model, voice: voice as any, input: seg, speed } as any); }
        catch { res = await client.audio.speech.create({ model: 'tts-1', voice: voice as any, input: seg, speed } as any); }
        bufs.push(Buffer.from(await res.arrayBuffer()));
      }
    }
    const buf = Buffer.concat(bufs);
    const up = await admin.storage.from('scene-images').upload(path, buf, { contentType: 'audio/mpeg', upsert: true });
    if (up.error) throw new Error(up.error.message);
    const { data: pub } = admin.storage.from('scene-images').getPublicUrl(path);
    await admin.from('api_usage').insert({ room_id: roomId, kind: 'tts', model: tag + ':' + voice, prompt_tokens: story.length, cost: useAzure ? 0 : (story.length / 1000) * 0.015 });
    await persist(pub.publicUrl);
    return NextResponse.json({ ok: true, url: pub.publicUrl });
  } catch (e: any) {
    await admin.from('error_logs').insert({ room_id: roomId, scope: 'tts', message: '讲故事朗读:' + e.message });
    return NextResponse.json({ error: '朗读生成失败：' + e.message }, { status: 500 });
  }
}
