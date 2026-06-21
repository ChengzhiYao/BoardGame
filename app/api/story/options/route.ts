// 讲故事 · 按参数生成 3 个故事方案。
import { NextResponse } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';
import { callLLMJson } from '@/lib/llm';
import { buildStoryOptionsPrompt } from '@/lib/story/prompt';
import { persistStory } from '@/lib/story/db';
import { langDirective } from '@/lib/i18n';

export const maxDuration = 60;

export async function POST(req: Request) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });
  const { roomId, params } = await req.json().catch(() => ({} as any));
  if (!roomId) return NextResponse.json({ error: '缺少参数' }, { status: 400 });

  const admin = createAdminClient();
  const { data: room } = await admin.from('rooms').select('host_user_id, language').eq('id', roomId).maybeSingle();
  if (!room) return NextResponse.json({ error: '房间不存在' }, { status: 404 });
  if (room.host_user_id !== user.id) return NextResponse.json({ error: '只有房主可以生成' }, { status: 403 });

  const { data: claimed } = await admin.from('rooms').update({ story_phase: 'generating', modules_generating: true }).eq('id', roomId).eq('modules_generating', false).select('id');
  if (!claimed || !claimed.length) return NextResponse.json({ ok: true, busy: true });

  try {
    const p = params || {};
    const { data: out, usage } = await callLLMJson<any>({
      system: buildStoryOptionsPrompt(p, room.language) + langDirective(room.language),
      messages: [{ role: 'user', content: '生成 3 个故事方案。' }], tier: 'main', temperature: 0.95, maxTokens: 1200, retry: true,
    });
    await admin.from('api_usage').insert({ room_id: roomId, kind: 'llm_main', model: usage.model, prompt_tokens: usage.promptTokens, completion_tokens: usage.completionTokens, latency_ms: usage.latencyMs });
    const options = (Array.isArray(out.options) ? out.options : []).slice(0, 3).map((o: any, i: number) => ({ id: i, title: String(o.title || ''), genre: String(o.genre || ''), logline: String(o.logline || ''), mood: String(o.mood || ''), est_minutes: Number(o.est_minutes) || 10, appeal: Math.max(0, Math.min(100, Math.round(Number(o.appeal) || 0))) }));
    if (!options.length) throw new Error('未生成有效方案');
    await persistStory(admin, roomId, { phase: 'select', params: p, options });
    await admin.from('rooms').update({ modules_generating: false, game_state: 'playing' }).eq('id', roomId);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    await admin.from('rooms').update({ story_phase: 'setup', modules_generating: false }).eq('id', roomId);
    await admin.from('error_logs').insert({ room_id: roomId, scope: 'llm', message: '讲故事选项:' + e.message });
    return NextResponse.json({ error: '生成失败：' + e.message }, { status: 500 });
  }
}
