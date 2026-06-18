// 高音质语音。支持 OpenAI / Azure（按 TTS_PROVIDER 切换）。按性别+种子选嗓音；相同文本+嗓音命中缓存不重复生成。
import { NextResponse } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';
import { createHash } from 'crypto';
import OpenAI from 'openai';

export const maxDuration = 30;

const OAI = { female: ['nova', 'shimmer', 'alloy'], male: ['echo', 'fable'], narrator: 'onyx' };
const AZ_ZH = { female: ['zh-CN-XiaoxiaoNeural', 'zh-CN-XiaoyiNeural', 'zh-CN-XiaohanNeural'], male: ['zh-CN-YunxiNeural', 'zh-CN-YunyangNeural', 'zh-CN-YunjianNeural'], narrator: 'zh-CN-YunyeNeural' };
const AZ_EN = { female: ['en-US-JennyNeural', 'en-US-AriaNeural', 'en-US-SaraNeural'], male: ['en-US-GuyNeural', 'en-US-DavisNeural', 'en-US-TonyNeural'], narrator: 'en-US-AndrewNeural' };

function pick(pool: string[], seed: number) { return pool[Math.abs(seed) % pool.length]; }
function esc(s: string) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;'); }

export async function POST(req: Request) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });

  const body = await req.json().catch(() => ({} as any));
  const roomId = body.roomId as string | undefined;
  const text = String(body.text || '').slice(0, 1200).trim();
  const gender = body.gender === 'female' ? 'female' : 'male';
  const narrator = !!body.narrator;
  const seed = Number(body.seed) || 0;
  const zh = body.lang !== 'en';
  if (!text) return NextResponse.json({ error: '空文本' }, { status: 400 });

  const admin = createAdminClient();
  if (roomId) {
    const { data: me } = await admin.from('players').select('id').eq('room_id', roomId).eq('user_id', user.id).maybeSingle();
    if (!me) return NextResponse.json({ error: '你不在这个房间' }, { status: 403 });
  }

  const provider = (process.env.TTS_PROVIDER || 'openai').toLowerCase();
  const azureKey = process.env.AZURE_SPEECH_KEY;
  const azureRegion = process.env.AZURE_SPEECH_REGION || 'eastus';
  const useAzure = provider === 'azure' && !!azureKey;

  let voice: string;
  if (useAzure) {
    const set = zh ? AZ_ZH : AZ_EN;
    voice = narrator ? set.narrator : pick(set[gender], seed);
  } else {
    voice = narrator ? OAI.narrator : pick(OAI[gender], seed);
  }

  const tag = useAzure ? 'az' : 'oai';
  const hash = createHash('sha1').update(`${tag}|${voice}|${text}`).digest('hex');
  const path = `tts/${hash}.mp3`;

  const { data: existing } = await admin.storage.from('scene-images').list('tts', { search: `${hash}.mp3`, limit: 1 });
  if (existing && existing.length) {
    const { data: pub } = admin.storage.from('scene-images').getPublicUrl(path);
    return NextResponse.json({ url: pub.publicUrl, cached: true });
  }

  try {
    let buf: Buffer;
    if (useAzure) {
      const ssml = `<speak version='1.0' xml:lang='${zh ? 'zh-CN' : 'en-US'}'><voice name='${voice}'>${esc(text)}</voice></speak>`;
      const r = await fetch(`https://${azureRegion}.tts.speech.microsoft.com/cognitiveservices/v1`, {
        method: 'POST',
        headers: {
          'Ocp-Apim-Subscription-Key': azureKey!,
          'Content-Type': 'application/ssml+xml',
          'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3',
          'User-Agent': 'mystnight',
        },
        body: ssml,
      });
      if (!r.ok) throw new Error('Azure TTS ' + r.status + ' ' + (await r.text()).slice(0, 200));
      buf = Buffer.from(await r.arrayBuffer());
    } else {
      if (!(process.env.IMAGE_API_KEY || process.env.OPENAI_API_KEY)) return NextResponse.json({ error: '未配置 OPENAI_API_KEY' }, { status: 500 });
      const client = new OpenAI({ apiKey: process.env.IMAGE_API_KEY || process.env.OPENAI_API_KEY });
      const model = process.env.TTS_MODEL || 'gpt-4o-mini-tts';
      let res;
      try { res = await client.audio.speech.create({ model, voice: voice as any, input: text }); }
      catch { res = await client.audio.speech.create({ model: 'tts-1', voice: voice as any, input: text }); }
      buf = Buffer.from(await res.arrayBuffer());
    }

    const up = await admin.storage.from('scene-images').upload(path, buf, { contentType: 'audio/mpeg', upsert: true });
    if (up.error) throw new Error(up.error.message);
    const { data: pub } = admin.storage.from('scene-images').getPublicUrl(path);
    if (roomId) await admin.from('api_usage').insert({ room_id: roomId, kind: 'tts', model: tag + ':' + voice, prompt_tokens: text.length, cost: useAzure ? 0 : (text.length / 1000) * 0.015 });
    return NextResponse.json({ url: pub.publicUrl });
  } catch (e: any) {
    if (roomId) await admin.from('error_logs').insert({ room_id: roomId, scope: 'tts', message: e.message });
    return NextResponse.json({ error: '语音生成失败：' + e.message }, { status: 500 });
  }
}
