// 讲故事 · AI 改稿提分 / 重新精确评分。
import { NextResponse } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';
import { callLLMJson } from '@/lib/llm';
import { buildStoryRevisePrompt, buildStoryRatePrompt, normalizeStoryRating } from '@/lib/story/prompt';
import { loadStory, persistStory } from '@/lib/story/db';
import { langDirective } from '@/lib/i18n';

export const maxDuration = 120;

async function rate(admin: any, roomId: string, story: string, genre: string, lang?: string) {
  const { data: r, usage } = await callLLMJson<any>({
    system: buildStoryRatePrompt(story, genre || '', lang) + langDirective(lang),
    messages: [{ role: 'user', content: '请精确评分。' }], tier: 'main', temperature: 0.3, maxTokens: 1200, retry: true,
  });
  await admin.from('api_usage').insert({ room_id: roomId, kind: 'llm_main', model: usage.model, prompt_tokens: usage.promptTokens, completion_tokens: usage.completionTokens, latency_ms: usage.latencyMs });
  return normalizeStoryRating(r);
}

export async function POST(req: Request) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });
  const { roomId, mode, note } = await req.json().catch(() => ({} as any));
  if (!roomId) return NextResponse.json({ error: '缺少参数' }, { status: 400 });

  const admin = createAdminClient();
  const { data: room } = await admin.from('rooms').select('host_user_id, language').eq('id', roomId).maybeSingle();
  if (!room) return NextResponse.json({ error: '房间不存在' }, { status: 404 });
  if (room.host_user_id !== user.id) return NextResponse.json({ error: '只有房主可以操作' }, { status: 403 });

  const state = await loadStory(admin, roomId);
  if (!state?.full?.story) return NextResponse.json({ error: '还没有故事' }, { status: 409 });
  const chosen = state.chosen || {};
  const genre = chosen.genre || '';

  const { data: claimed } = await admin.from('rooms').update({ modules_generating: true }).eq('id', roomId).eq('modules_generating', false).select('id');
  if (!claimed || !claimed.length) return NextResponse.json({ ok: true, busy: true });

  try {
    let story = String(state.full.story);
    let title = String(state.full.title || chosen.title || '');
    if (mode === 'rerate') {
      const rating = await rate(admin, roomId, story, genre, room.language);
      const overall = Number(rating?.overall);
      if (rating && isFinite(overall) && overall >= 85) {
        try { await admin.from('story_library').insert({ title, genre, logline: chosen.logline || '', mood: chosen.mood || '', est_minutes: chosen.est_minutes || 10, genres: Array.isArray(state.params?.genres) ? state.params.genres : [], tone: state.params?.tone || null, story, rating, overall }); } catch {}
      }
      await persistStory(admin, roomId, { ...state, phase: 'reading', rating });
    } else {
      // 并行生成 2 个候选稿，各自精确评分，只保留"分数高于当前"的最佳一版；都不如原稿则不改动（绝不越改越差）
      const sys = buildStoryRevisePrompt(story, state.rating || {}, state.params || {}, genre, room.language, typeof note === 'string' ? note : '') + langDirective(room.language);
      const N = 2;
      const drafts = await Promise.all(Array.from({ length: N }, () => callLLMJson<any>({
        system: sys, messages: [{ role: 'user', content: '请针对弱项重写，目标总分 90+。' }], tier: 'main', temperature: 0.9, maxTokens: 4000, retry: true,
      }).catch(() => null)));
      const cands = await Promise.all(drafts.map(async (d) => {
        if (!d) return null;
        await admin.from('api_usage').insert({ room_id: roomId, kind: 'llm_main', model: d.usage.model, prompt_tokens: d.usage.promptTokens, completion_tokens: d.usage.completionTokens, latency_ms: d.usage.latencyMs });
        const cstory = String(d.data.story || '');
        if (cstory.length < 200) return null;
        const crating = await rate(admin, roomId, cstory, genre, room.language);
        return { title: String(d.data.title || title), story: cstory, rating: crating, overall: Number(crating?.overall) || 0 };
      }));
      const valid = cands.filter(Boolean) as { title: string; story: string; rating: any; overall: number }[];
      const prevOverall = Number(state.rating?.overall) || 0;
      const best = valid.sort((a, b) => b.overall - a.overall)[0];
      if (best && best.overall > prevOverall) {
        if (best.overall >= 85) {
          try { await admin.from('story_library').insert({ title: best.title, genre, logline: chosen.logline || '', mood: chosen.mood || '', est_minutes: chosen.est_minutes || 10, genres: Array.isArray(state.params?.genres) ? state.params.genres : [], tone: state.params?.tone || null, story: best.story, rating: best.rating, overall: best.overall }); } catch {}
        }
        await persistStory(admin, roomId, { ...state, phase: 'reading', full: { title: best.title, story: best.story }, rating: best.rating, revisedFrom: prevOverall, reviseCount: (Number(state.reviseCount) || 0) + 1 });
        await admin.from('rooms').update({ modules_generating: false }).eq('id', roomId);
        return NextResponse.json({ ok: true, improved: true, from: prevOverall, to: best.overall });
      } else {
        // 没改出更高分：保留原稿
        await admin.from('rooms').update({ modules_generating: false }).eq('id', roomId);
        return NextResponse.json({ ok: true, improved: false, from: prevOverall, to: best ? best.overall : prevOverall });
      }
    }
    await admin.from('rooms').update({ modules_generating: false }).eq('id', roomId);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    await admin.from('rooms').update({ modules_generating: false }).eq('id', roomId);
    await admin.from('error_logs').insert({ room_id: roomId, scope: 'llm', message: '讲故事改稿:' + e.message });
    return NextResponse.json({ error: '操作失败：' + e.message }, { status: 500 });
  }
}
