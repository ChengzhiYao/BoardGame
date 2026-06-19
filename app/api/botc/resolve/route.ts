// 血染 · 结算今日：统计真人+AI 投票 → 处决 → 判定胜负 → 若继续则结算今夜（恶魔杀人+信息）→ 进入次日。
import { NextResponse } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';
import { callLLMJson } from '@/lib/llm';
import { buildBotcVotePrompt, buildBotcNightPrompt } from '@/lib/botc/prompt';
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
  if (!room || room.botc_phase !== 'day') return NextResponse.json({ error: '现在不是白天阶段' }, { status: 409 });
  const { data: me } = await admin.from('players').select('id').eq('room_id', roomId).eq('user_id', user.id).maybeSingle();
  if (!me) return NextResponse.json({ error: '你不在这个房间' }, { status: 403 });

  // 锁：抢占结算权，避免重复
  const { data: claim } = await admin.from('rooms').update({ modules_generating: true }).eq('id', roomId).eq('modules_generating', false).select('id');
  if (!claim || !claim.length) return NextResponse.json({ ok: true, busy: true });

  const en = room.language === 'en';
  try {
    const { data: setupRow } = await admin.from('botc_setup').select('data').eq('room_id', roomId).maybeSingle();
    const setup = setupRow?.data || {};
    const roles: any[] = setup.roles || [];
    const day = room.botc_day || 1;

    const { data: bps } = await admin.from('botc_players').select('seat, display_name, is_ai, alive').eq('room_id', roomId);
    const aliveBp = (bps || []).filter((p: any) => p.alive);
    const aliveLabels = aliveBp.map((p: any) => p.seat ? `${p.seat}·${p.display_name}` : p.display_name);
    const aiNames = aliveBp.filter((p: any) => p.is_ai).map((p: any) => p.display_name);
    const realSeats = (bps || []).filter((p: any) => p.seat).map((p: any) => p.seat);

    const { data: votes } = await admin.from('botc_votes').select('voter, target').eq('room_id', roomId).eq('day', day);
    const humanVotes = (votes || []).map((v: any) => `${v.voter}→${v.target}`).join('；') || '（无）';

    const { data: history } = await admin.from('messages').select('sender_type, content, payload').eq('room_id', roomId).order('created_at', { ascending: true }).limit(60);
    const transcript = (history || []).filter((m: any) => m.payload?.type !== 'botc_role').slice(-22).map((m: any) => m.content).join('\n').slice(0, 3500);

    // —— 投票结算 ——
    const { data: vout, usage } = await callLLMJson<any>({
      system: buildBotcVotePrompt(setup, day, aliveLabels, humanVotes, aiNames, transcript) + langDirective(room.language),
      messages: [{ role: 'user', content: '请统计投票并给出处决与胜负。' }],
      tier: 'main', temperature: 0.5, maxTokens: 1200,
    });
    await admin.from('api_usage').insert({ room_id: roomId, kind: 'llm_main', model: usage.model, prompt_tokens: usage.promptTokens, completion_tokens: usage.completionTokens, latency_ms: usage.latencyMs });

    // 记录 AI 投票（公开）
    for (const av of (vout.ai_votes || [])) {
      if (!av?.voter) continue;
      await admin.from('messages').insert({ room_id: roomId, sender_type: 'system', turn_no: day, content: `🗳️ ${av.voter} → ${av.target || 'skip'}${av.reason ? `（${av.reason}）` : ''}`, payload: { type: 'botc_vote' } });
    }
    if (vout.result_text) await admin.from('messages').insert({ room_id: roomId, sender_type: 'kp', turn_no: day, content: vout.result_text, payload: { type: 'botc_st' } });

    // 应用处决
    const markDead = async (ref: string) => {
      if (!ref) return;
      const seatMatch = /^[A-H]$/.test(ref) ? ref : (ref.split('·')[0] && /^[A-H]$/.test(ref.split('·')[0]) ? ref.split('·')[0] : null);
      if (seatMatch) await admin.from('botc_players').update({ alive: false }).eq('room_id', roomId).eq('seat', seatMatch);
      else await admin.from('botc_players').update({ alive: false }).eq('room_id', roomId).eq('display_name', ref);
    };
    const executed = vout.executed && vout.executed !== 'null' ? String(vout.executed) : null;
    if (executed) await markDead(executed);

    // 确定恶魔对应的 botc_player（座位或 AI 名）
    const demonRole = roles.find((r: any) => r.is_demon || r.team === 'demon');
    const demonKey = demonRole ? (demonRole.seat || demonRole.role) : null;

    // 重新读取存活，做确定性胜负判定（优先于 LLM 的 win）
    const fresh = async () => (await admin.from('botc_players').select('seat, display_name, alive').eq('room_id', roomId)).data || [];
    const demonAlive = (list: any[]) => {
      if (!demonKey) return true;
      const d = list.find((p: any) => (/^[A-H]$/.test(demonKey) ? p.seat === demonKey : p.display_name === demonKey));
      return d ? d.alive : false;
    };

    let after = await fresh();
    let aliveCount = after.filter((p: any) => p.alive).length;
    let win: 'good' | 'evil' | null = null;
    if (!demonAlive(after)) win = 'good';
    else if (aliveCount <= 2) win = 'evil';

    // —— 若未结束：结算今夜 ——
    if (!win) {
      const nextDay = day + 1;
      const aliveLabels2 = after.filter((p: any) => p.alive).map((p: any) => p.seat ? `${p.seat}·${p.display_name}` : p.display_name);
      try {
        const { data: nout, usage: u2 } = await callLLMJson<any>({
          system: buildBotcNightPrompt(setup, nextDay, aliveLabels2, realSeats, transcript) + langDirective(room.language),
          messages: [{ role: 'user', content: '请结算今夜。' }],
          tier: 'main', temperature: 0.7, maxTokens: 1400,
        });
        await admin.from('api_usage').insert({ room_id: roomId, kind: 'llm_main', model: u2.model, prompt_tokens: u2.promptTokens, completion_tokens: u2.completionTokens, latency_ms: u2.latencyMs });
        for (const d of (nout.deaths || [])) await markDead(String(d));
        if (nout.public_morning) await admin.from('messages').insert({ room_id: roomId, sender_type: 'kp', turn_no: nextDay, content: nout.public_morning, payload: { type: 'botc_st' } });
        for (const pn of (nout.player_private || [])) {
          if (!pn?.text || !/^[A-H]$/.test(String(pn.to))) continue;
          await admin.from('messages').insert({ room_id: roomId, sender_type: 'system', turn_no: nextDay, content: pn.text, visibility: `seat:${pn.to}`, payload: { type: 'botc_private' } });
        }
      } catch { /* 夜晚失败则跳过，仍进入次日 */ }

      // 夜后再判定（恶魔通常不会夜里死，但好人可能减员到邪恶胜）
      after = await fresh();
      aliveCount = after.filter((p: any) => p.alive).length;
      if (!demonAlive(after)) win = 'good';
      else if (aliveCount <= 2) win = 'evil';

      if (!win) {
        await admin.from('rooms').update({ botc_day: nextDay, modules_generating: false }).eq('id', roomId);
        return NextResponse.json({ ok: true, day: nextDay });
      }
    }

    // —— 结束：揭晓全部身份 ——
    const reveal = roles.map((r: any) => {
      const who = r.seat ? r.seat : (r.role);
      const team = r.team === 'demon' ? (en ? 'Demon' : '恶魔') : r.team === 'minion' ? (en ? 'Minion' : '爪牙') : r.team === 'outsider' ? (en ? 'Outsider' : '外来者') : (en ? 'Townsfolk' : '镇民');
      return `${who}：「${r.role}」 · ${team}`;
    }).join('\n');
    const winText = win === 'good' ? (en ? '🟦 GOOD wins — the Demon is dead.' : '🟦 好人胜利 —— 恶魔已伏诛。') : (en ? '🟥 EVIL wins.' : '🟥 邪恶胜利。');
    await admin.from('messages').insert({ room_id: roomId, sender_type: 'kp', turn_no: day, content: `${winText}\n\n${en ? 'Roles revealed:' : '身份揭晓：'}\n${reveal}`, payload: { type: 'botc_reveal' } });
    await admin.from('rooms').update({ botc_phase: 'reveal', game_state: 'ended', modules_generating: false }).eq('id', roomId);
    return NextResponse.json({ ok: true, win });
  } catch (e: any) {
    await admin.from('rooms').update({ modules_generating: false }).eq('id', roomId);
    await admin.from('error_logs').insert({ room_id: roomId, scope: 'llm', message: '血染结算:' + e.message });
    return NextResponse.json({ error: '结算失败：' + e.message }, { status: 500 });
  }
}
