// 讲故事 · 整篇朗读合成（Azure TTS，分段合成后拼接为一个 MP3），URL 存进 story_state.narration。
import { NextResponse } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';
import { createHash } from 'crypto';
import { loadStory, persistStory } from '@/lib/story/db';

export const maxDuration = 120;

const NARRATOR = { zh: 'zh-CN-YunyeNeural', en: 'en-US-AndrewNeural' };
function esc(s: string) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;'); }
function chunk(text: string, max = 1500): string[] {
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
  const { roomId } = await req.json().catch(() => ({} as any));
  if (!roomId) return NextResponse.json({ error: '缺少参数' }, { status: 400 });

  const admin = createAdminClient();
  const { data: room } = await admin.from('rooms').select('host_user_id, language').eq('id', roomId).maybeSingle();
  if (!room) return NextResponse.json({ error: '房间不存在' }, { status: 404 });
  if (room.host_user_id !== user.id) return NextResponse.json({ error: '只有房主可以生成朗读' }, { status: 403 });

  const azureKey = process.env.AZURE_SPEECH_KEY;
  const azureRegion = process.env.AZURE_SPEECH_REGION || 'eastus';
  if (!azureKey) return NextResponse.json({ error: '未配置 AZURE_SPEECH_KEY（请在 Vercel 环境变量里设置 AZURE_SPEECH_KEY、AZURE_SPEECH_REGION，并把 TTS_PROVIDER 设为 azure）' }, { status: 500 });

  const state = await loadStory(admin, roomId);
  const story = String(state?.full?.story || '').trim();
  if (!story) return NextResponse.json({ error: '还没有故事正文' }, { status: 409 });
  const zh = room.language !== 'en';
  const voice = zh ? NARRATOR.zh : NARRATOR.en;
  const hash = createHash('sha1').update(`story|${voice}|${story}`).digest('hex');
  const path = `story-tts/${hash}.mp3`;

  // 命中缓存
  const { data: existing } = await admin.storage.from('scene-images').list('story-tts', { search: `${hash}.mp3`, limit: 1 });
  if (existing && existing.length) {
    const { data: pub } = admin.storage.from('scene-images').getPublicUrl(path);
    await persistStory(admin, roomId, { ...state, phase: 'reading', narration: { url: pub.publicUrl, voice, ts: Date.now() }, playback: { playing: false, position: 0, ts: Date.now() } });
    return NextResponse.json({ ok: true, url: pub.publicUrl, cached: true });
  }

  try {
    const segs = chunk(story);
    const bufs: Buffer[] = [];
    for (const seg of segs) {
      const ssml = `<speak version='1.0' xml:lang='${zh ? 'zh-CN' : 'en-US'}'><voice name='${voice}'><prosody rate='-8%'>${esc(seg)}</prosody></voice></speak>`;
      const r = await fetch(`https://${azureRegion}.tts.speech.microsoft.com/cognitiveservices/v1`, {
        method: 'POST',
        headers: { 'Ocp-Apim-Subscription-Key': azureKey, 'Content-Type': 'application/ssml+xml', 'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3', 'User-Agent': 'mystnight' },
        body: ssml,
      });
      if (!r.ok) throw new Error('Azure TTS ' + r.status + ' ' + (await r.text()).slice(0, 160));
      bufs.push(Buffer.from(await r.arrayBuffer()));
    }
    const buf = Buffer.concat(bufs);
    const up = await admin.storage.from('scene-images').upload(path, buf, { contentType: 'audio/mpeg', upsert: true });
    if (up.error) throw new Error(up.error.message);
    const { data: pub } = admin.storage.from('scene-images').getPublicUrl(path);
    await admin.from('api_usage').insert({ room_id: roomId, kind: 'tts', model: 'az:' + voice, prompt_tokens: story.length, cost: 0 });
    await persistStory(admin, roomId, { ...state, phase: 'reading', narration: { url: pub.publicUrl, voice, ts: Date.now() }, playback: { playing: false, position: 0, ts: Date.now() } });
    return NextResponse.json({ ok: true, url: pub.publicUrl });
  } catch (e: any) {
    await admin.from('error_logs').insert({ room_id: roomId, scope: 'tts', message: '讲故事朗读:' + e.message });
    return NextResponse.json({ error: '朗读生成失败：' + e.message }, { status: 500 });
  }
}
