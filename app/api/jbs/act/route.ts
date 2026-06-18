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
  const { data: room } = await admin.from('rooms').select('jbs_act, jbs_phase, jbs_act_turns, language').eq('id', roomId).maybeSingle();
  if (!room || room.jbs_phase !== 'playing') return NextResponse.json({ error: '现在不能行动' }, { status: 409 });
  const curAct = room.jbs_act || 1;
  const turnsInAct = (room.jbs_act_turns || 0) + 1;

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
      system: buildJbsDmPrompt(kase.case_file, curAct, aiNames, turnsInAct) + langDirective(room.language),
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

    let nextAct = Math.min(7, Math.max(curAct, Number(out.next_act) || curAct));
    // 兜底：DM 原地不动但本幕已≥4回合 → 强制推进，避免无限闲聊。
    if (nextAct <= curAct && turnsInAct >= 4) nextAct = Math.min(7, curAct + 1);
    const advanced = nextAct > curAct;
    const toVote = !!out.to_vote || nextAct >= 6;
    const patch: any = { jbs_act: nextAct, jbs_phase: toVote ? 'vote' : 'playing', jbs_act_turns: advanced ? 0 : turnsInAct };
    if (Array.isArray(out.resources) && out.resources.length) patch.jbs_resources = out.resources;
    await admin.from('rooms').update(patch).eq('id', roomId);
    if (advanced && !toVote) await admin.from('messages').insert({ room_id: roomId, sender_type: 'system', turn_no: nextAct, content: `▶ ${room.language === 'en' ? `Act ${nextAct}` : `第 ${nextAct} 幕`}`, payload: { type: 'jbs_act' } });
    return NextResponse.json({ ok: true, vote: toVote, act: nextAct });
  } catch (e: any) {
    await admin.from('error_logs').insert({ room_id: roomId, scope: 'llm', message: '剧本杀DM:' + e.message });
    return NextResponse.json({ error: 'DM 出错，请重试：' + e.message }, { status: 500 });
  }
}
