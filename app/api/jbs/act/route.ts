// 剧本杀 DM 回合：玩家行动 → DM 叙述 + AI 角色自主发言 + 搜证 + 推进幕。
import { NextResponse } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';
import { callLLMJson, type LLMMessage } from '@/lib/llm';
import { buildJbsDmPrompt } from '@/lib/jbs/prompt';
import { langDirective } from '@/lib/i18n';

export const maxDuration = 60;

export async function POST(req: Request) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });

  const { roomId, content } = await req.json().catch(() => ({} as any));
  if (!roomId || !content?.trim()) return NextResponse.json({ error: '缺少参数' }, { status: 400 });

  const admin = createAdminClient();
  const { data: me } = await admin.from('players').select('id, seat').eq('room_id', roomId).eq('user_id', user.id).maybeSingle();
  if (!me) return NextResponse.json({ error: '你不在这个房间' }, { status: 403 });
  const { data: room } = await admin.from('rooms').select('jbs_act, jbs_phase, jbs_act_minutes, jbs_act_started_at, jbs_total_acts, language').eq('id', roomId).maybeSingle();
  if (!room || room.jbs_phase !== 'playing') return NextResponse.json({ error: '现在不能行动' }, { status: 409 });
  const curAct = room.jbs_act || 1;
  const actMin = room.jbs_act_minutes || 6;
  const startedAt = room.jbs_act_started_at ? new Date(room.jbs_act_started_at).getTime() : Date.now();
  const elapsedMin = Math.max(0, Math.floor((Date.now() - startedAt) / 60000));

  const { data: kase } = await admin.from('jbs_cases').select('case_file').eq('room_id', roomId).maybeSingle();
  if (!kase) return NextResponse.json({ error: '案件未生成' }, { status: 409 });
  const { data: chars } = await admin.from('jbs_characters').select('name, is_ai').eq('room_id', roomId);
  const aiNames = (chars || []).filter((c: any) => c.is_ai).map((c: any) => c.name);

  // 落库玩家行动
  await admin.from('messages').insert({ room_id: roomId, sender_type: 'player', sender_player_id: me.id, action_type: 'free', content: content.trim(), turn_no: room.jbs_act || 1, visibility: 'public' });

  // 历史
  const { data: history } = await admin.from('messages').select('sender_type, content, payload, visibility').eq('room_id', roomId).order('created_at', { ascending: true }).limit(400);
  const base: LLMMessage[] = (history || []).slice(-18).map((m: any) => {
    if (m.sender_type === 'kp') return { role: 'assistant', content: m.content };
    const tag = m.payload?.type === 'jbs_ai' ? `[${m.payload?.name || 'NPC'}]` : m.sender_type === 'player' ? '[玩家]' : '[系统]';
    return { role: 'user', content: `${tag} ${m.content}` } as LLMMessage;
  });

  try {
    const { data: out, usage } = await callLLMJson<any>({
      system: buildJbsDmPrompt(kase.case_file, curAct, aiNames, { elapsedMin, actMin }) + langDirective(room.language),
      messages: [...base, { role: 'user', content: `${me.seat} 的行动：${content.trim()}` }],
      tier: 'main', temperature: 0.8, maxTokens: 2200, retry: true,
    });
    await admin.from('api_usage').insert({ room_id: roomId, kind: 'llm_main', model: usage.model, prompt_tokens: usage.promptTokens, completion_tokens: usage.completionTokens, latency_ms: usage.latencyMs });

    if (out.narration) await admin.from('messages').insert({ room_id: roomId, sender_type: 'kp', turn_no: room.jbs_act || 1, content: out.narration, payload: { type: 'jbs_dm' } });
    for (const a of out.ai_lines || []) {
      if (!a?.text || !a?.name) continue;
      await admin.from('messages').insert({ room_id: roomId, sender_type: 'kp', turn_no: room.jbs_act || 1, content: a.text, payload: { type: 'jbs_ai', name: a.name } });
    }
    for (const ev of out.evidence_revealed || []) {
      if (!ev?.name) continue;
      const vis = ev.to === 'A' ? 'player_a' : ev.to === 'B' ? 'player_b' : 'public';
      await admin.from('messages').insert({ room_id: roomId, sender_type: 'system', turn_no: room.jbs_act || 1, content: `🔍 ${ev.name}：${ev.desc || ''}`, visibility: vis, payload: { type: 'jbs_evidence' } });
    }
    for (const pn of out.private_notes || []) {
      if (!pn?.text || !['A', 'B'].includes(pn.to)) continue;
      await admin.from('messages').insert({ room_id: roomId, sender_type: 'system', turn_no: room.jbs_act || 1, content: pn.text, visibility: pn.to === 'A' ? 'player_a' : 'player_b', payload: { type: 'private' } });
    }

    // 幕的推进只由 /api/jbs/advance（倒计时自动 / 房主手动）负责；玩家行动回合内绝不跳幕，避免乱推进。
    if (Array.isArray(out.resources) && out.resources.length) await admin.from('rooms').update({ jbs_resources: out.resources }).eq('id', roomId);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    await admin.from('error_logs').insert({ room_id: roomId, scope: 'llm', message: '剧本杀DM:' + e.message });
    return NextResponse.json({ error: 'DM 出错，请重试：' + e.message }, { status: 500 });
  }
}
