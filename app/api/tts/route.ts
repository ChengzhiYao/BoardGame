// 高音质语音（OpenAI TTS）。把一句话合成为 mp3，存到存储桶并返回 URL；相同文本+嗓音命中缓存不重复生成。
import { NextResponse } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';
import { createHash } from 'crypto';
import OpenAI from 'openai';

export const maxDuration = 30;

const VOICES = ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'];

export async function POST(req: Request) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });

  const body = await req.json().catch(() => ({} as any));
  const roomId = body.roomId as string | undefined;
  const text = String(body.text || '').slice(0, 1200).trim();
  const voice = VOICES.includes(body.voice) ? body.voice : 'onyx';
  if (!text) return NextResponse.json({ error: '空文本' }, { status: 400 });
  if (!(process.env.IMAGE_API_KEY || process.env.OPENAI_API_KEY)) {
    return NextResponse.json({ error: '未配置 OPENAI_API_KEY' }, { status: 500 });
  }

  const admin = createAdminClient();
  if (roomId) {
    const { data: me } = await admin.from('players').select('id').eq('room_id', roomId).eq('user_id', user.id).maybeSingle();
    if (!me) return NextResponse.json({ error: '你不在这个房间' }, { status: 403 });
  }

  const model = process.env.TTS_MODEL || 'gpt-4o-mini-tts';
  const hash = createHash('sha1').update(`${model}|${voice}|${text}`).digest('hex');
  const path = `tts/${hash}.mp3`;

  const { data: existing } = await admin.storage.from('scene-images').list('tts', { search: `${hash}.mp3`, limit: 1 });
  if (existing && existing.length) {
    const { data: pub } = admin.storage.from('scene-images').getPublicUrl(path);
    return NextResponse.json({ url: pub.publicUrl, cached: true });
  }

  try {
    const client = new OpenAI({ apiKey: process.env.IMAGE_API_KEY || process.env.OPENAI_API_KEY });
    let buf: Buffer;
    try {
      const res = await client.audio.speech.create({ model, voice: voice as any, input: text });
      buf = Buffer.from(await res.arrayBuffer());
    } catch {
      const res = await client.audio.speech.create({ model: 'tts-1', voice: voice as any, input: text });
      buf = Buffer.from(await res.arrayBuffer());
    }
    const up = await admin.storage.from('scene-images').upload(path, buf, { contentType: 'audio/mpeg', upsert: true });
    if (up.error) throw new Error(up.error.message);
    const { data: pub } = admin.storage.from('scene-images').getPublicUrl(path);
    if (roomId) await admin.from('api_usage').insert({ room_id: roomId, kind: 'tts', model, prompt_tokens: text.length, cost: (text.length / 1000) * 0.015 });
    return NextResponse.json({ url: pub.publicUrl });
  } catch (e: any) {
    if (roomId) await admin.from('error_logs').insert({ room_id: roomId, scope: 'tts', message: e.message });
    return NextResponse.json({ error: '语音生成失败：' + e.message }, { status: 500 });
  }
}
