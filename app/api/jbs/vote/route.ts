// 剧本杀 最终指认：真人投票 → 全员到齐后 AI 各自独立投票 + 揭晓真相 + 结案。
import { NextResponse } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';
import { callLLMJson } from '@/lib/llm';
import { buildJbsVotePrompt } from '@/lib/jbs/prompt';
import { buildScorePrompt, formatScores } from '@/lib/score';
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
  const { data: room } = await admin.from('rooms').select('jbs_phase, jbs_total_acts, language').eq('id', roomId).maybeSingle();
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

  // 把整局的讨论/指证过程压成一段文字，让 AI 投票时真的参考玩家说服了什么。
  const { data: hist } = await admin.from('messages').select('sender_type, content, payload').eq('room_id', roomId).order('created_at', { ascending: true }).limit(400);
  const discussion = (hist || [])
    .filter((m: any) => ['kp', 'player'].includes(m.sender_type) && m.payload?.type !== 'jbs_roster' && m.payload?.type !== 'jbs_role')
    .slice(-40)
    .map((m: any) => {
      if (m.payload?.type === 'jbs_ai') return `${m.payload?.name}（AI）：${m.content}`;
      if (m.sender_type === 'player') return `玩家：${m.content}`;
      if (m.payload?.type === 'jbs_evidence') return `线索：${m.content}`;
      return `旁白：${m.content}`;
    }).join('\n').slice(0, 4000);

  await admin.from('rooms').update({ jbs_phase: 'revealing' }).eq('id', roomId);
  try {
    const { data: out, usage } = await callLLMJson<any>({
      system: buildJbsVotePrompt(kase!.case_file, aiNames, realVotes, discussion) + langDirective(room.language),
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

    // 给每个真人玩家打综合评分
    try {
      const { data: allPlayers } = await admin.from('players').select('id, seat').eq('room_id', roomId);
      const real = (allPlayers || []).filter((p: any) => p.seat === 'A' || p.seat === 'B');
      const { data: jchars } = await admin.from('jbs_characters').select('name, assigned_seat').eq('room_id', roomId);
      const { data: pmsgs } = await admin.from('messages').select('sender_player_id, content').eq('room_id', roomId).eq('sender_type', 'player').order('created_at', { ascending: true });
      const cf = kase!.case_file || {};
      const cfChars = cf.characters || [];
      const playersInput = real.map((p: any) => {
        const ch = (jchars || []).find((c: any) => c.assigned_seat === p.seat);
        const full = cfChars.find((c: any) => c.name === ch?.name);
        return { seat: p.seat, name: ch?.name || p.seat, role: full?.occupation, goal: full?.private_goal, actions: (pmsgs || []).filter((m: any) => m.sender_player_id === p.id).map((m: any) => m.content).slice(-25) };
      });
      if (playersInput.length) {
        const { data: sc } = await callLLMJson<any>({
          system: buildScorePrompt({ mode: 'jbs', scenario: `《${cf.title || ''}》｜本型${cf.type || ''}`, truth: cf.truth, players: playersInput }) + langDirective(room.language),
          messages: [{ role: 'user', content: '请为每位玩家评分。' }], tier: 'main', temperature: 0.4, maxTokens: 1600, retry: true,
        });
        if (Array.isArray(sc?.scores) && sc.scores.length) {
          await admin.from('messages').insert({ room_id: roomId, sender_type: 'system', turn_no: 99, content: formatScores(sc.scores, en), payload: { type: 'jbs_score', scores: sc.scores } });
        }
      }
    } catch (e: any) { await admin.from('error_logs').insert({ room_id: roomId, scope: 'llm', message: '剧本杀评分:' + e.message }); }

    await admin.from('rooms').update({ game_state: 'ended', jbs_phase: 'reveal', jbs_act: room.jbs_total_acts || 7 }).eq('id', roomId);
    return NextResponse.json({ ok: true, revealed: true });
  } catch (e: any) {
    await admin.from('rooms').update({ jbs_phase: 'vote' }).eq('id', roomId);
    await admin.from('error_logs').insert({ room_id: roomId, scope: 'llm', message: '剧本杀揭晓:' + e.message });
    return NextResponse.json({ error: '揭晓失败，请重试：' + e.message }, { status: 500 });
  }
}
