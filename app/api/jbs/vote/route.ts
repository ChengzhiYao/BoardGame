// 剧本杀 最终指认：真人投票 → 全员到齐后 AI 各自独立投票 + 揭晓真相 + 结案。
import { NextResponse } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';
import { callLLMJson } from '@/lib/llm';
import { buildJbsVotePrompt } from '@/lib/jbs/prompt';
import { langDirective } from '@/lib/i18n';

export const maxDuration = 60;

export async function POST(req: Request) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });

  const { roomId, target } = await req.json().catch(() => ({} as any));
  if (!roomId || !target) return NextResponse.json({ error: '缺少参数' }, { status: 400 });

  const admin = createAdminClient();
  const { data: me } = await admin.from('players').select('id, seat').eq('room_id', roomId).eq('user_id', user.id).maybeSingle();
  if (!me) return NextResponse.json({ error: '你不在这个房间' }, { status: 403 });
  const { data: room } = await admin.from('rooms').select('jbs_phase, language').eq('id', roomId).maybeSingle();
  if (!room || room.jbs_phase !== 'vote') return NextResponse.json({ error: '现在不是指认阶段' }, { status: 409 });

  // 记录本人投票（每人一票，重复则覆盖）
  await admin.from('jbs_votes').delete().eq('room_id', roomId).eq('voter', me.seat);
  await admin.from('jbs_votes').insert({ room_id: roomId, voter: me.seat, target });
  await admin.from('messages').insert({ room_id: roomId, sender_type: 'system', turn_no: 6, content: (room.language === 'en' ? `🗳️ ${me.seat} accuses ` : `🗳️ ${me.seat} 指认 `) + target, payload: { type: 'jbs_vote' } });

  // 检查是否所有真人都投了
  const { data: players } = await admin.from('players').select('seat').eq('room_id', roomId);
  const realSeats = (players || []).map((p: any) => p.seat).filter((s: string) => s === 'A' || s === 'B');
  const { data: votes } = await admin.from('jbs_votes').select('voter, target').eq('room_id', roomId);
  const realVotes = (votes || []).filter((v: any) => realSeats.includes(v.voter));
  if (realVotes.length < realSeats.length) {
    return NextResponse.json({ ok: true, waiting: true });
  }

  // 全员到齐 → 结算
  const { data: kase } = await admin.from('jbs_cases').select('case_file').eq('room_id', roomId).maybeSingle();
  const { data: chars } = await admin.from('jbs_characters').select('name, is_ai').eq('room_id', roomId);
  const aiNames = (chars || []).filter((c: any) => c.is_ai).map((c: any) => c.name);

  await admin.from('rooms').update({ jbs_phase: 'revealing' }).eq('id', roomId);
  try {
    const { data: out, usage } = await callLLMJson<any>({
      system: buildJbsVotePrompt(kase!.case_file, aiNames, realVotes) + langDirective(room.language),
      messages: [{ role: 'user', content: '请统计 AI 投票并揭晓真相。' }],
      tier: 'main', temperature: 0.7, maxTokens: 3000, retry: true,
    });
    await admin.from('api_usage').insert({ room_id: roomId, kind: 'llm_main', model: usage.model, prompt_tokens: usage.promptTokens, completion_tokens: usage.completionTokens, latency_ms: usage.latencyMs });

    const en = room.language === 'en';
    const lines = (out.ai_votes || []).map((v: any) => `· ${v.name} → ${v.target}（${v.reason || ''}）`).join('\n');
    await admin.from('messages').insert({ room_id: roomId, sender_type: 'system', turn_no: 6, content: (en ? '🗳️ AI accusations:\n' : '🗳️ AI 指认：\n') + lines, payload: { type: 'jbs_vote' } });

    const meterKey = kase!.case_file?.meter_key || (en ? 'Score' : '推理值');
    const reveal = (en ? '【TRUTH REVEALED】\n' : '【真相揭晓】\n') + (out.reveal || '')
      + `\n\n${en ? 'Most accused' : '得票最多'}: ${out.accused || '—'} ｜ ${out.correct ? (en ? '✔ Correct' : '✔ 指认成功') : (en ? '✘ Wrong' : '✘ 指认失败')} ｜ ${meterKey}: ${out.meter ?? 0}/100`;
    await admin.from('messages').insert({ room_id: roomId, sender_type: 'kp', turn_no: 7, content: reveal, payload: { type: 'jbs_reveal' } });

    await admin.from('rooms').update({ game_state: 'ended', jbs_phase: 'reveal', jbs_act: 7 }).eq('id', roomId);
    return NextResponse.json({ ok: true, revealed: true });
  } catch (e: any) {
    await admin.from('rooms').update({ jbs_phase: 'vote' }).eq('id', roomId);
    await admin.from('error_logs').insert({ room_id: roomId, scope: 'llm', message: '剧本杀揭晓:' + e.message });
    return NextResponse.json({ error: '揭晓失败，请重试：' + e.message }, { status: 500 });
  }
}
