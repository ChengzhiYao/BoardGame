// 血染 · 白天 AI 发言：代所有存活 AI 玩家生成讨论发言（房主侧轮询触发，类剧本杀）。
import { NextResponse } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';
import { callLLMJson } from '@/lib/llm';
import { buildBotcDiscussPrompt } from '@/lib/botc/prompt';
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
  if (room.host_user_id !== user.id) return NextResponse.json({ ok: true }); // 只由房主端触发，避免多端重复

  const { data: setupRow } = await admin.from('botc_setup').select('data').eq('room_id', roomId).maybeSingle();
  if (!setupRow) return NextResponse.json({ ok: true });
  const setup = setupRow.data;
  const { data: bps } = await admin.from('botc_players').select('seat, display_name, is_ai, alive').eq('room_id', roomId);
  const alive = (bps || []).filter((p: any) => p.alive).map((p: any) => p.seat ? `${p.seat}·${p.display_name}` : p.display_name);
  const aiNames = (bps || []).filter((p: any) => p.alive && p.is_ai).map((p: any) => p.display_name);
  const realSeats = (bps || []).filter((p: any) => p.seat).map((p: any) => p.seat);
  if (!aiNames.length) return NextResponse.json({ ok: true });

  const { data: history } = await admin.from('messages').select('sender_type, content, payload').eq('room_id', roomId).order('created_at', { ascending: true }).limit(40);
  const transcript = (history || []).filter((m: any) => ['player', 'kp', 'system'].includes(m.sender_type) && m.payload?.type !== 'botc_role').slice(-18).map((m: any) => m.content).join('\n').slice(0, 3000);

  try {
    const { data: out, usage } = await callLLMJson<any>({
      system: buildBotcDiscussPrompt(setup, room.botc_day, alive, aiNames, realSeats, transcript) + langDirective(room.language),
      messages: [{ role: 'user', content: '请生成本回合存活 AI 的白天发言。' }],
      tier: 'main', temperature: 0.9, maxTokens: 1200,
    });
    await admin.from('api_usage').insert({ room_id: roomId, kind: 'llm_main', model: usage.model, prompt_tokens: usage.promptTokens, completion_tokens: usage.completionTokens, latency_ms: usage.latencyMs });
    for (const l of (out.lines || [])) {
      if (!l?.text || !l?.name) continue;
      if (!aiNames.includes(l.name)) continue; // 硬过滤：只让存活 AI 说话
      await admin.from('messages').insert({ room_id: roomId, sender_type: 'system', turn_no: room.botc_day, content: l.text, payload: { type: 'botc_ai', name: l.name } });
    }
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: true });
  }
}
