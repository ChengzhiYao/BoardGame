// 剧本杀 · 结局揭晓/结算（非指认型本：情感/还原/欢乐/机制）。房主触发。
import { NextResponse } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';
import { callLLMJson } from '@/lib/llm';
import { buildJbsEndingPrompt } from '@/lib/jbs/prompt';
import { buildScorePrompt, formatScores } from '@/lib/score';
import { langDirective } from '@/lib/i18n';

export const maxDuration = 60;

export async function POST(req: Request) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });
  const { roomId } = await req.json().catch(() => ({} as any));
  if (!roomId) return NextResponse.json({ error: '缺少参数' }, { status: 400 });

  const admin = createAdminClient();
  const { data: room } = await admin.from('rooms').select('host_user_id, jbs_phase, jbs_type, jbs_total_acts, language').eq('id', roomId).maybeSingle();
  if (!room) return NextResponse.json({ error: '房间不存在' }, { status: 404 });
  if (room.host_user_id !== user.id) return NextResponse.json({ error: '只有房主可以揭晓结局' }, { status: 403 });
  if (room.jbs_phase !== 'playing') return NextResponse.json({ error: '现在不能结算' }, { status: 409 });

  const { data: kaseRows } = await admin.from('jbs_cases').select('case_file').eq('room_id', roomId).order('created_at', { ascending: false }).limit(1);
  const kase = kaseRows?.[0];
  if (!kase) return NextResponse.json({ error: '案件不存在' }, { status: 404 });
  const cf = kase.case_file || {};
  const type = room.jbs_type || cf.type || '情感';
  const en = room.language === 'en';

  const { data: hist } = await admin.from('messages').select('sender_type, content, payload').eq('room_id', roomId).order('created_at', { ascending: true }).limit(400);
  const discussion = (hist || [])
    .filter((m: any) => ['kp', 'player'].includes(m.sender_type) && !['jbs_roster', 'jbs_role'].includes(m.payload?.type))
    .slice(-40)
    .map((m: any) => m.payload?.type === 'jbs_ai' ? `${m.payload?.name}（AI）：${m.content}` : m.sender_type === 'player' ? `玩家：${m.content}` : m.content)
    .join('\n').slice(0, 4000);

  await admin.from('rooms').update({ jbs_phase: 'revealing' }).eq('id', roomId);
  try {
    const { data: out, usage } = await callLLMJson<any>({
      system: buildJbsEndingPrompt(cf, type, discussion) + langDirective(room.language),
      messages: [{ role: 'user', content: '请做本局的结局揭晓/结算。' }],
      tier: 'main', temperature: 0.8, maxTokens: 3000, retry: true,
    });
    await admin.from('api_usage').insert({ room_id: roomId, kind: 'llm_main', model: usage.model, prompt_tokens: usage.promptTokens, completion_tokens: usage.completionTokens, latency_ms: usage.latencyMs });

    const meterKey = cf.meter_key || (en ? 'Score' : '分值');
    let body = (en ? '【ENDING】\n' : '【结局揭晓】\n') + (out.reveal || '');
    if (Array.isArray(out.scores) && out.scores.length) body += '\n\n' + out.scores.map((x: any) => `· ${x.name}：${meterKey} ${x.meter ?? 0}/100`).join('\n');
    if (out.winner) body += `\n\n🏆 ${en ? 'Winner' : '赢家'}: ${out.winner}`;
    await admin.from('messages').insert({ room_id: roomId, sender_type: 'kp', turn_no: room.jbs_total_acts || 7, content: body, payload: { type: 'jbs_reveal' } });

    // 真人玩家综合评分（与指认本一致）
    try {
      const { data: allPlayers } = await admin.from('players').select('id, seat').eq('room_id', roomId);
      const real = (allPlayers || []).filter((p: any) => /^[A-H]$/.test(p.seat));
      const { data: jchars } = await admin.from('jbs_characters').select('name, assigned_seat').eq('room_id', roomId);
      const { data: pmsgs } = await admin.from('messages').select('sender_player_id, content').eq('room_id', roomId).eq('sender_type', 'player').order('created_at', { ascending: true });
      const cfChars = cf.characters || [];
      const playersInput = real.map((p: any) => {
        const ch = (jchars || []).find((c: any) => c.assigned_seat === p.seat);
        const full = cfChars.find((c: any) => c.name === ch?.name);
        return { seat: p.seat, name: ch?.name || p.seat, role: full?.occupation, goal: full?.private_goal, actions: (pmsgs || []).filter((m: any) => m.sender_player_id === p.id).map((m: any) => m.content).slice(-25) };
      });
      if (playersInput.length) {
        const { data: sc } = await callLLMJson<any>({
          system: buildScorePrompt({ mode: 'jbs', scenario: `《${cf.title || ''}》｜本型${type}`, truth: cf.truth, players: playersInput }) + langDirective(room.language),
          messages: [{ role: 'user', content: '请为每位玩家评分。' }], tier: 'main', temperature: 0.4, maxTokens: 1600, retry: true,
        });
        if (Array.isArray(sc?.scores) && sc.scores.length) await admin.from('messages').insert({ room_id: roomId, sender_type: 'system', turn_no: 99, content: formatScores(sc.scores, en), payload: { type: 'jbs_score', scores: sc.scores } });
      }
    } catch (e: any) { await admin.from('error_logs').insert({ room_id: roomId, scope: 'llm', message: '剧本杀结算评分:' + e.message }); }

    await admin.from('rooms').update({ game_state: 'ended', jbs_phase: 'reveal' }).eq('id', roomId);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    await admin.from('rooms').update({ jbs_phase: 'playing' }).eq('id', roomId);
    await admin.from('error_logs').insert({ room_id: roomId, scope: 'llm', message: '剧本杀结算:' + e.message });
    return NextResponse.json({ error: '结算失败，请重试：' + e.message }, { status: 500 });
  }
}
