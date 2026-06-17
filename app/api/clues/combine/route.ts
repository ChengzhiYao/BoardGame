// 线索组合推理：玩家挑选 ≥2 条线索，AI（有真相作底）判断它们能否拼出一个合理推论。
// 能 → 落库为一条"推理结论"(kind=deduction) 并由 KP 宣布；不能 → 返回提示，不浪费。
import { NextResponse } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';
import { callLLMJson } from '@/lib/llm';

export const maxDuration = 30;
const MAX_DEDUCTIONS = 40; // 每局推理次数上限（控成本）

export async function POST(req: Request) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });

  const { roomId, clueIds } = await req.json().catch(() => ({} as any));
  if (!roomId || !Array.isArray(clueIds) || clueIds.length < 2) {
    return NextResponse.json({ error: '请至少选择 2 条线索来推理。' }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: me } = await admin.from('players').select('id, seat').eq('room_id', roomId).eq('user_id', user.id).maybeSingle();
  if (!me) return NextResponse.json({ error: '你不在这个房间' }, { status: 403 });

  const { data: room } = await admin.from('rooms').select('campaign_id, game_state, deduction_count').eq('id', roomId).maybeSingle();
  if (!room) return NextResponse.json({ error: '房间不存在' }, { status: 404 });
  if (room.game_state !== 'playing') return NextResponse.json({ error: '现在不能推理。' }, { status: 409 });
  if ((room.deduction_count || 0) >= MAX_DEDUCTIONS) {
    return NextResponse.json({ error: '本局推理次数已用尽。' }, { status: 429 });
  }

  // 取选中的线索（限定本房间），最多 5 条
  const { data: clues } = await admin
    .from('clues').select('id, title, description, source, thread, kind')
    .eq('room_id', roomId).in('id', clueIds.slice(0, 5));
  if (!clues || clues.length < 2) {
    return NextResponse.json({ error: '选中的线索无效。' }, { status: 400 });
  }

  const { data: truth } = room.campaign_id
    ? await admin.from('hidden_case_files').select('truth, key_clues, mastermind, supernatural').eq('campaign_id', room.campaign_id).maybeSingle()
    : { data: null };

  const cluesText = clues.map((c: any, i: number) => `${i + 1}.「${c.title}」${c.description ? '：' + c.description : ''}`).join('\n');
  const system = `你是恐怖调查跑团的"推理裁判"。玩家把几条已发现的线索摆在一起，想推导出一个新结论。
下面是隐藏真相（仅供你判断对错，绝不能泄露给玩家）：
真相：${truth?.truth || '（未知）'}
关键线索：${JSON.stringify(truth?.key_clues || [])}
幕后：${JSON.stringify(truth?.mastermind || {})}
超自然：${JSON.stringify(truth?.supernatural || {})}

规则：
- 只有当这些线索**之间确实存在合理逻辑联系**、能支撑一个比单条线索更进一步的推论时，combines 才为 true。
- conclusion 是玩家能合理得出的那一步推论，**贴合真相但不直接揭示全部真相**，1~2 句，具体。
- 如果这些线索风马牛不相及、或拼不出新东西，combines=false，并在 reason 里用一句话说明（不要剧透真相，例如"这两条暂时看不出必然联系，也许还缺一环"）。
- is_breakthrough：该推论是否直指案件要害（重大突破）。

只输出 JSON：
{ "combines": true, "conclusion": "推出的新结论", "is_breakthrough": false, "reason": "" }`;

  let out: any = { combines: false, reason: '一时看不出联系。' };
  try {
    const r = await callLLMJson<any>({
      system,
      messages: [{ role: 'user', content: `玩家拼合的线索：\n${cluesText}\n\n它们能推出什么？` }],
      tier: 'aux', temperature: 0.3, maxTokens: 500,
    });
    out = r.data;
    await admin.from('api_usage').insert({ room_id: roomId, kind: 'llm_aux', model: r.usage.model, prompt_tokens: r.usage.promptTokens, completion_tokens: r.usage.completionTokens, latency_ms: r.usage.latencyMs });
  } catch (e: any) {
    return NextResponse.json({ error: '推理失败：' + e.message }, { status: 500 });
  }

  await admin.from('rooms').update({ deduction_count: (room.deduction_count || 0) + 1 }).eq('id', roomId);

  if (!out.combines || !out.conclusion) {
    return NextResponse.json({ ok: true, combines: false, message: out.reason || '这些线索暂时拼不出新结论。' });
  }

  const round = (await admin.from('rooms').select('current_round').eq('id', roomId).maybeSingle()).data?.current_round || 1;
  const title = String(out.conclusion).slice(0, 60);
  await admin.from('clues').insert({
    room_id: roomId, title, description: out.conclusion, source: `${me.seat} 推理（拼合 ${clues.length} 条线索）`,
    is_key: !!out.is_breakthrough, is_red_herring: false, thread: null, visible_to: 'all', kind: 'deduction', discovered_turn: round,
  });
  await admin.from('messages').insert({
    room_id: roomId, sender_type: 'system', turn_no: round,
    content: `🧩 推理成立${out.is_breakthrough ? ' · 重大突破' : ''}：${out.conclusion}`,
    payload: { type: 'deduction' },
  });

  return NextResponse.json({ ok: true, combines: true, conclusion: out.conclusion, is_breakthrough: !!out.is_breakthrough });
}
