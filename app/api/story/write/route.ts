// 讲故事 · 写出选中方案的完整故事 + 多维精确评分。
import { NextResponse } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';
import { callLLMJson } from '@/lib/llm';
import { buildStoryWritePrompt, buildStoryRatePrompt } from '@/lib/story/prompt';
import { loadStory, persistStory } from '@/lib/story/db';
import { langDirective } from '@/lib/i18n';

export const maxDuration = 120;

export async function POST(req: Request) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });
  const { roomId, optionId } = await req.json().catch(() => ({} as any));
  if (!roomId) return NextResponse.json({ error: '缺少参数' }, { status: 400 });

  const admin = createAdminClient();
  const { data: room } = await admin.from('rooms').select('host_user_id, language').eq('id', roomId).maybeSingle();
  if (!room) return NextResponse.json({ error: '房间不存在' }, { status: 404 });
  if (room.host_user_id !== user.id) return NextResponse.json({ error: '只有房主可以生成' }, { status: 403 });

  const state = await loadStory(admin, roomId);
  if (!state?.options?.length) return NextResponse.json({ error: '请先生成方案' }, { status: 409 });
  const chosen = state.options.find((o: any) => o.id === optionId) || state.options[0];

  const { data: claimed } = await admin.from('rooms').update({ story_phase: 'generating', modules_generating: true }).eq('id', roomId).eq('modules_generating', false).select('id');
  if (!claimed || !claimed.length) return NextResponse.json({ ok: true, busy: true });

  try {
    const { data: full, usage } = await callLLMJson<any>({
      system: buildStoryWritePrompt(chosen, state.params || {}, room.language) + langDirective(room.language),
      messages: [{ role: 'user', content: '写出完整故事。' }], tier: 'main', temperature: 0.9, maxTokens: 4000, retry: true,
    });
    await admin.from('api_usage').insert({ room_id: roomId, kind: 'llm_main', model: usage.model, prompt_tokens: usage.promptTokens, completion_tokens: usage.completionTokens, latency_ms: usage.latencyMs });
    const story = String(full.story || '');
    let rating: any = null;
    try {
      const { data: r } = await callLLMJson<any>({
        system: buildStoryRatePrompt(story, chosen.genre || '', room.language) + langDirective(room.language),
        messages: [{ role: 'user', content: '请精确评分。' }], tier: 'main', temperature: 0.3, maxTokens: 1200, retry: true,
      });
      rating = r;
    } catch { /* 评分失败不阻断 */ }
    await persistStory(admin, roomId, { ...state, phase: 'reading', chosen, full: { title: String(full.title || chosen.title), story }, rating });
    await admin.from('rooms').update({ modules_generating: false, game_state: 'playing' }).eq('id', roomId);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    await admin.from('rooms').update({ story_phase: 'select', modules_generating: false }).eq('id', roomId);
    await admin.from('error_logs').insert({ room_id: roomId, scope: 'llm', message: '讲故事写作:' + e.message });
    return NextResponse.json({ error: '生成失败：' + e.message }, { status: 500 });
  }
}
