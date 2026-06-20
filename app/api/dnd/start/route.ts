// D&D · 开场：AI DM 生成原创冒险与开场叙事 → 进入建卡阶段。
import { NextResponse } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';
import { callLLMJson } from '@/lib/llm';
import { newGame } from '@/lib/dnd/engine';
import { persist } from '@/lib/dnd/db';
import { buildDndOpeningPrompt } from '@/lib/dnd/prompt';
import { langDirective } from '@/lib/i18n';

export const maxDuration = 60;

export async function POST(req: Request) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });
  const { roomId, theme } = await req.json().catch(() => ({} as any));
  if (!roomId) return NextResponse.json({ error: '缺少参数' }, { status: 400 });

  const admin = createAdminClient();
  const { data: room } = await admin.from('rooms').select('host_user_id, language, dnd_phase').eq('id', roomId).maybeSingle();
  if (!room) return NextResponse.json({ error: '房间不存在' }, { status: 404 });
  if (room.host_user_id !== user.id) return NextResponse.json({ error: '只有房主可以开场' }, { status: 403 });
  if (room.dnd_phase && !['lobby', 'select'].includes(room.dnd_phase)) return NextResponse.json({ ok: true, already: true });

  const { data: claimed } = await admin.from('rooms').update({ dnd_phase: 'locking', modules_generating: true }).eq('id', roomId).or('dnd_phase.is.null,dnd_phase.eq.lobby,dnd_phase.eq.select').select('id');
  if (!claimed || !claimed.length) return NextResponse.json({ ok: true, already: true });

  try {
    const { data: players } = await admin.from('players').select('seat, user_id').eq('room_id', roomId);
    const seats = (players || []).map((p: any) => p.seat).filter((s: string) => /^[A-H]$/.test(s)).sort();
    const { data: users } = await admin.from('users').select('id, display_name').in('id', (players || []).map((p: any) => p.user_id));
    const names: Record<string, string> = {};
    for (const p of (players || [])) names[p.seat] = users?.find((u: any) => u.id === p.user_id)?.display_name || '冒险者';

    const state = newGame(theme || '', seats, names);
    const { data: op, usage } = await callLLMJson<any>({
      system: buildDndOpeningPrompt(theme || '', seats.length, room.language) + langDirective(room.language),
      messages: [{ role: 'user', content: '生成本场冒险与开场。' }], tier: 'main', temperature: 0.85, maxTokens: 900,
    });
    await admin.from('api_usage').insert({ room_id: roomId, kind: 'llm_main', model: usage.model, prompt_tokens: usage.promptTokens, completion_tokens: usage.completionTokens, latency_ms: usage.latencyMs });
    state.scene = op.scene || (room.language === 'en' ? 'A frontier outpost' : '边境哨站');
    state.quest = op.quest || '';
    state.log.push({ msg: `📜 任务：${state.quest}`, kind: 'sys' }); state.logSeq++;
    if (op.opening) { state.log.push({ msg: op.opening, kind: 'dm' }); state.logSeq++; }
    await persist(admin, roomId, state);
    await admin.from('rooms').update({ dnd_phase: 'creation', game_state: 'playing', modules_generating: false }).eq('id', roomId);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    await admin.from('rooms').update({ dnd_phase: 'lobby', modules_generating: false }).eq('id', roomId);
    await admin.from('error_logs').insert({ room_id: roomId, scope: 'llm', message: 'DnD开场:' + e.message });
    return NextResponse.json({ error: '开场失败：' + e.message }, { status: 500 });
  }
}
