// 血染 · 白天发言回合（房主端轮询触发）：若当前发言者是 AI 则让其发一段话并轮到下一位；
// 若当前是真人则等待其点"发言完毕"。所有人发言完毕 → 进入投票阶段。
import { NextResponse } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';
import { callLLMJson } from '@/lib/llm';
import { buildBotcOneTurnPrompt } from '@/lib/botc/prompt';
import { langDirective } from '@/lib/i18n';

export const maxDuration = 60;

export async function POST(req: Request) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });
  const { roomId } = await req.json().catch(() => ({} as any));
  if (!roomId) return NextResponse.json({ error: '缺少参数' }, { status: 400 });

  const admin = createAdminClient();
  const { data: room } = await admin.from('rooms').select('*').eq('id', roomId).maybeSingle();
  if (!room || room.botc_phase !== 'day') return NextResponse.json({ ok: true });
  if (room.host_user_id !== user.id) return NextResponse.json({ ok: true });

  const { data: bps } = await admin.from('botc_players').select('seat, display_name, is_ai, alive').eq('room_id', roomId);
  const order = (bps || []).filter((p: any) => p.alive).map((p: any) => p.seat).sort();
  let speaker = room.waiting_for as string | null;
  if (!speaker || !order.includes(speaker)) {
    if (order.length) { await admin.from('rooms').update({ waiting_for: order[0] }).eq('id', roomId); return NextResponse.json({ ok: true, speaker: order[0] }); }
    await admin.from('rooms').update({ botc_phase: 'vote', waiting_for: null }).eq('id', roomId);
    return NextResponse.json({ ok: true, vote: true });
  }
  const sp = (bps || []).find((p: any) => p.seat === speaker);
  if (sp && !sp.is_ai) return NextResponse.json({ ok: true, waiting: 'human', speaker });

  // AI 发言（单人一段）
  const { data: setupRow } = await admin.from('botc_setup').select('data').eq('room_id', roomId).maybeSingle();
  const setup = setupRow?.data || {};
  const aliveLabels = (bps || []).filter((p: any) => p.alive).map((p: any) => `${p.seat}·${p.display_name}`);
  const aiNotes = (Array.isArray(setup._notes) ? setup._notes : []).filter((n: any) => n.who === sp?.display_name).slice(-6).map((n: any) => `第${n.day}夜：${n.text}`).join('\n');
  const { data: history } = await admin.from('messages').select('content, payload').eq('room_id', roomId).order('created_at', { ascending: true }).limit(40);
  const transcript = (history || []).filter((m: any) => !['botc_role', 'botc_role_action', 'botc_manifest'].includes(m.payload?.type)).slice(-16).map((m: any) => m.content).filter(Boolean).join('\n').slice(0, 2800);

  try {
    const { data: out, usage } = await callLLMJson<any>({
      system: buildBotcOneTurnPrompt(setup, room.botc_day, aliveLabels, sp!.display_name, aiNotes, transcript) + langDirective(room.language),
      messages: [{ role: 'user', content: `请生成「${sp!.display_name}」这一回合的发言。` }],
      tier: 'main', temperature: 0.9, maxTokens: 500,
    });
    await admin.from('api_usage').insert({ room_id: roomId, kind: 'llm_main', model: usage.model, prompt_tokens: usage.promptTokens, completion_tokens: usage.completionTokens, latency_ms: usage.latencyMs });
    if (out.text) await admin.from('messages').insert({ room_id: roomId, sender_type: 'system', turn_no: room.botc_day, content: out.text, payload: { type: 'botc_ai', name: sp!.display_name } });
  } catch {}

  const idx = order.indexOf(speaker);
  const next = order[idx + 1];
  if (next) await admin.from('rooms').update({ waiting_for: next }).eq('id', roomId).eq('waiting_for', speaker);
  else await admin.from('rooms').update({ botc_phase: 'vote', waiting_for: null }).eq('id', roomId).eq('waiting_for', speaker);
  return NextResponse.json({ ok: true, next: next || 'vote' });
}
