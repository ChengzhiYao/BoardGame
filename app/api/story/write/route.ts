// 讲故事 · 写出选中方案的完整故事 + 多维精确评分。
import { NextResponse } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';
import { callLLMJson } from '@/lib/llm';
import { buildStoryWritePrompt, buildStoryPlanPrompt, buildStoryRatePrompt, normalizeStoryRating } from '@/lib/story/prompt';
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
  const { data: me } = await admin.from('players').select('id').eq('room_id', roomId).eq('user_id', user.id).maybeSingle();
  if (!me) return NextResponse.json({ error: '你不在这个房间' }, { status: 403 });

  const state = await loadStory(admin, roomId);
  if (!state?.options?.length) return NextResponse.json({ error: '请先生成方案' }, { status: 409 });
  const chosen = state.options.find((o: any) => o.id === optionId) || state.options[0];

  const { data: claimed } = await admin.from('rooms').update({ story_phase: 'generating', modules_generating: true }).eq('id', roomId).eq('modules_generating', false).select('id');
  if (!claimed || !claimed.length) return NextResponse.json({ ok: true, busy: true });

  try {
    // 选中的是精选库故事：直接取出，不再生成
    if (chosen.fromLibrary && chosen.libraryId) {
      const { data: libRow } = await admin.from('story_library').select('*').eq('id', chosen.libraryId).maybeSingle();
      if (libRow) {
        await admin.from('story_library').update({ times_used: (libRow.times_used || 0) + 1 }).eq('id', libRow.id);
        await persistStory(admin, roomId, { ...state, phase: 'reading', chosen, full: { title: String(libRow.title || chosen.title), story: String(libRow.story || '') }, rating: libRow.rating });
        await admin.from('rooms').update({ modules_generating: false, game_state: 'playing' }).eq('id', roomId);
        return NextResponse.json({ ok: true, fromLibrary: true });
      }
    }
    const dir = langDirective(room.language);
    const logU = async (u: any, tier = 'llm_main') => { try { await admin.from('api_usage').insert({ room_id: roomId, kind: tier, model: u.model, prompt_tokens: u.promptTokens, completion_tokens: u.completionTokens, latency_ms: u.latencyMs }); } catch {} };
    // 1) 文学规划：先想清楚核心意象/人物弧光/结构/结尾回扣
    let plan: any = null;
    try {
      const { data: pl, usage: pu } = await callLLMJson<any>({ system: buildStoryPlanPrompt(chosen, state.params || {}, room.language) + dir, messages: [{ role: 'user', content: '先做写作蓝图。' }], tier: 'main', temperature: 0.85, maxTokens: 1100, retry: true });
      plan = pl; await logU(pu);
    } catch { /* 规划失败则裸写 */ }
    // 2) 按蓝图 + 文学手法写 2 稿（并行）
    const sys = buildStoryWritePrompt(chosen, state.params || {}, room.language, plan) + dir;
    const drafts = await Promise.all([0, 1].map(() => callLLMJson<any>({ system: sys, messages: [{ role: 'user', content: '写出可发表水准的完整故事。' }], tier: 'main', temperature: 0.95, maxTokens: 4000, retry: true }).catch(() => null)));
    // 3) 各自精确评分，择优
    const rated = await Promise.all(drafts.map(async (d) => {
      if (!d) return null; await logU(d.usage);
      const cstory = String(d.data.story || ''); if (cstory.length < 400) return null;
      let r: any = null;
      try { const rr = await callLLMJson<any>({ system: buildStoryRatePrompt(cstory, chosen.genre || '', room.language) + dir, messages: [{ role: 'user', content: '请精确评分。' }], tier: 'main', temperature: 0.3, maxTokens: 1200, retry: true }); await logU(rr.usage); r = normalizeStoryRating(rr.data); } catch {}
      return { title: String(d.data.title || chosen.title), story: cstory, rating: r, overall: Number(r?.overall) || 0 };
    }));
    const valid = rated.filter(Boolean) as { title: string; story: string; rating: any; overall: number }[];
    if (!valid.length) throw new Error('故事生成失败');
    const winner = valid.sort((a, b) => b.overall - a.overall)[0];
    const story = winner.story; const rating = winner.rating; const overall = Number(rating?.overall);
    if (rating && isFinite(overall) && overall >= 85) {
      try {
        await admin.from('story_library').insert({ title: winner.title, genre: String(chosen.genre || ''), logline: String(chosen.logline || ''), mood: String(chosen.mood || ''), est_minutes: Number(chosen.est_minutes) || 10, genres: Array.isArray(state.params?.genres) ? state.params.genres : [], tone: state.params?.tone || null, story, rating, overall });
      } catch { /* 入库失败不阻断 */ }
    }
    await persistStory(admin, roomId, { ...state, phase: 'reading', chosen, full: { title: winner.title, story }, rating, narration: null, playback: null });
    await admin.from('rooms').update({ modules_generating: false, game_state: 'playing' }).eq('id', roomId);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    await admin.from('rooms').update({ story_phase: 'select', modules_generating: false }).eq('id', roomId);
    await admin.from('error_logs').insert({ room_id: roomId, scope: 'llm', message: '讲故事写作:' + e.message });
    return NextResponse.json({ error: '生成失败：' + e.message }, { status: 500 });
  }
}
