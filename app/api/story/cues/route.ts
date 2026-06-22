// 讲故事 · 逐段配乐线索：为每段标注情绪/音效，存入 story_state.cues（与段落同序）。
import { NextResponse } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';
import { callLLMJson } from '@/lib/llm';
import { buildStoryCuesPrompt, STORY_MOODS, STORY_SFX } from '@/lib/story/prompt';
import { loadStory, persistStory } from '@/lib/story/db';
import { langDirective } from '@/lib/i18n';

export const maxDuration = 60;
const MOOD_WORDS = STORY_MOODS.map((m) => m.word);

export async function POST(req: Request) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });
  const { roomId } = await req.json().catch(() => ({} as any));
  if (!roomId) return NextResponse.json({ error: '缺少参数' }, { status: 400 });

  const admin = createAdminClient();
  const { data: room } = await admin.from('rooms').select('host_user_id, language').eq('id', roomId).maybeSingle();
  if (!room) return NextResponse.json({ error: '房间不存在' }, { status: 404 });
  if (room.host_user_id !== user.id) return NextResponse.json({ error: '只有房主可以生成' }, { status: 403 });

  const state = await loadStory(admin, roomId);
  const story = String(state?.full?.story || '').trim();
  if (!story) return NextResponse.json({ error: '还没有故事正文' }, { status: 409 });
  const paras = story.split(/\n+/).map((p: string) => p.trim()).filter(Boolean);
  const genre = String(state?.chosen?.genre || '');

  try {
    const { data, usage } = await callLLMJson<any>({
      system: buildStoryCuesPrompt(paras, genre, room.language) + langDirective(room.language),
      messages: [{ role: 'user', content: '请逐段配乐。' }], tier: 'aux', temperature: 0.4, maxTokens: 1400, retry: true,
    });
    await admin.from('api_usage').insert({ room_id: roomId, kind: 'llm_aux', model: usage.model, prompt_tokens: usage.promptTokens, completion_tokens: usage.completionTokens, latency_ms: usage.latencyMs });
    const raw: any[] = Array.isArray(data?.cues) ? data.cues : [];
    const cues = paras.map((_: string, i: number) => {
      const c = raw.find((x) => Number(x?.i) === i) || raw[i] || {};
      const mood = MOOD_WORDS.includes(c?.mood) ? c.mood : 'calm';
      const sfx = (Array.isArray(c?.sfx) ? c.sfx : []).filter((k: string) => STORY_SFX.includes(k)).slice(0, 2);
      return { mood, sfx, stinger: !!c?.stinger };
    });
    await persistStory(admin, roomId, { ...state, cues });
    return NextResponse.json({ ok: true, cues });
  } catch (e: any) {
    await admin.from('error_logs').insert({ room_id: roomId, scope: 'llm', message: '讲故事配乐:' + e.message });
    return NextResponse.json({ error: '配乐生成失败：' + e.message }, { status: 500 });
  }
}
