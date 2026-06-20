// 血染 · 结算白天：统计真人+AI 投票 → 处决 → 判胜负 → 若继续则入夜（进入逐角色叫醒的夜晚阶段）。
import { NextResponse } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';
import { callLLMJson } from '@/lib/llm';
import { buildBotcVotePrompt } from '@/lib/botc/prompt';
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
  if (!room || room.botc_phase !== 'vote') return NextResponse.json({ error: '现在不是投票阶段' }, { status: 409 });
  const { data: meP } = await admin.from('players').select('id').eq('room_id', roomId).eq('user_id', user.id).maybeSingle();
  if (!meP) return NextResponse.json({ error: '你不在这个房间' }, { status: 403 });

  const { data: claim } = await admin.from('rooms').update({ modules_generating: true }).eq('id', roomId).eq('modules_generating', false).select('id');
  if (!claim || !claim.length) return NextResponse.json({ ok: true, busy: true });

  const en = room.language === 'en';
  try {
    const { data: setupRow } = await admin.from('botc_setup').select('data').eq('room_id', roomId).maybeSingle();
    const setup = setupRow?.data || {}; const roles: any[] = setup.roles || [];
    const day = room.botc_day || 1;
    const { data: bps } = await admin.from('botc_players').select('seat, display_name, is_ai, alive').eq('room_id', roomId);
    const aliveBp = (bps || []).filter((p: any) => p.alive);
    const aliveLabels = aliveBp.map((p: any) => p.seat ? `${p.seat}·${p.display_name}` : p.display_name);
    const aiNames = aliveBp.filter((p: any) => p.is_ai).map((p: any) => p.display_name);
    const { data: votes } = await admin.from('botc_votes').select('voter, target').eq('room_id', roomId).eq('day', day);
    const humanVotes = (votes || []).map((v: any) => `${v.voter}→${v.target}`).join('；') || '（无）';
    const aiNotes = (Array.isArray(setup._notes) ? setup._notes : []).slice(-14).map((n: any) => `第${n.day}夜 ${n.who}：${n.text}`).join('\n');
    const { data: history } = await admin.from('messages').select('content, payload').eq('room_id', roomId).order('created_at', { ascending: true }).limit(60);
    const transcript = (history || []).filter((m: any) => m.payload?.type !== 'botc_role' && m.payload?.type !== 'botc_role_action').slice(-24).map((m: any) => m.content).filter(Boolean).join('\n').slice(0, 3500);

    const { data: vout, usage } = await callLLMJson<any>({
      system: buildBotcVotePrompt(setup, day, aliveLabels, humanVotes, aiNames, aiNotes, transcript) + langDirective(room.language),
      messages: [{ role: 'user', content: '请统计投票并给出处决与胜负。' }],
      tier: 'main', temperature: 0.5, maxTokens: 1300,
    });
    await admin.from('api_usage').insert({ room_id: roomId, kind: 'llm_main', model: usage.model, prompt_tokens: usage.promptTokens, completion_tokens: usage.completionTokens, latency_ms: usage.latencyMs });

    for (const av of (vout.ai_votes || [])) {
      if (!av?.voter) continue;
      await admin.from('messages').insert({ room_id: roomId, sender_type: 'system', turn_no: day, content: `🗳️ ${av.voter} → ${av.target || 'skip'}${av.reason ? `（${av.reason}）` : ''}`, payload: { type: 'botc_vote' } });
    }
    // 计票（代码权威，绝不让 LLM 决定谁死）：真人票来自数据库，AI 投给谁由 LLM 决定，统一按"过半"处决。
    const toSeat = (ref: string): string | null => {
      const x = String(ref || '').trim(); if (!x) return null;
      if (/^[A-H]$/.test(x)) return x;
      const head = x.split('·')[0]; if (/^[A-H]$/.test(head)) return head;
      const p = (bps || []).find((b: any) => b.display_name === x); return p?.seat || null;
    };
    const labelOfSeat = (seat: string) => { const p = (bps || []).find((b: any) => b.seat === seat); return p ? `${seat}·${p.display_name}` : seat; };
    const allVotes: { voter: string; target: string }[] = [];
    for (const v of (votes || [])) allVotes.push({ voter: String(v.voter), target: String(v.target || 'skip') });
    for (const av of (vout.ai_votes || [])) { if (av?.voter) allVotes.push({ voter: String(av.voter), target: String(av.target || 'skip') }); }
    const tally: Record<string, number> = {};
    for (const v of allVotes) { if (v.target.toLowerCase() === 'skip') continue; const t = toSeat(v.target); if (t) tally[t] = (tally[t] || 0) + 1; }
    let executedSeat: string | null = null; let top = 0; let tie = false;
    for (const [seat, c] of Object.entries(tally)) { if (c > top) { top = c; executedSeat = seat; tie = false; } else if (c === top) tie = true; }
    const aliveN = aliveBp.length; const threshold = Math.ceil(aliveN / 2);
    if (!executedSeat || tie || top < threshold) executedSeat = null;
    const tallyStr = Object.entries(tally).sort((a, b) => b[1] - a[1]).map(([seat, c]) => `${labelOfSeat(seat)} ${c}`).join('、') || (en ? 'no votes' : '无人投票');
    const execText = executedSeat
      ? (en ? `🗳 Tally: ${tallyStr} (alive ${aliveN}, majority needs ${threshold}). Executed: ${labelOfSeat(executedSeat)}.` : `🗳 计票：${tallyStr}（存活 ${aliveN}，过半需 ${threshold} 票）。今日处决：${labelOfSeat(executedSeat)}。`)
      : (en ? `🗳 Tally: ${tallyStr} (alive ${aliveN}, majority needs ${threshold}). No execution (tie or below threshold).` : `🗳 计票：${tallyStr}（存活 ${aliveN}，过半需 ${threshold} 票）。票数不过半或平票，今日无人被处决。`);
    await admin.from('messages').insert({ room_id: roomId, sender_type: 'kp', turn_no: day, content: execText, payload: { type: 'botc_st', sfx: executedSeat ? ['cue_execution'] : [] } });

    const markDead = async (ref: string) => {
      if (!ref) return;
      const seat = /^[A-H]$/.test(ref) ? ref : (/^[A-H]$/.test((ref.split('·')[0] || '')) ? ref.split('·')[0] : null);
      if (seat) await admin.from('botc_players').update({ alive: false }).eq('room_id', roomId).eq('seat', seat);
      else await admin.from('botc_players').update({ alive: false }).eq('room_id', roomId).eq('display_name', ref);
    };
    if (executedSeat) await markDead(executedSeat);

    const after = (await admin.from('botc_players').select('seat, display_name, alive').eq('room_id', roomId)).data || [];
    const demonRole = roles.find((r: any) => r.is_demon || r.team === 'demon');
    const demonKey = demonRole ? (demonRole.seat || null) : null;
    const demonAlive = !demonKey ? true : (after.find((p: any) => (/^[A-H]$/.test(demonKey) ? p.seat === demonKey : p.display_name === demonKey))?.alive ?? false);
    const aliveCount = after.filter((p: any) => p.alive).length;
    let win: 'good' | 'evil' | null = null;
    if (!demonAlive) win = 'good'; else if (aliveCount <= 2) win = 'evil';

    if (win) {
      const reveal = roles.map((r: any) => `${r.seat || r.role}：「${r.role}」 · ${r.team === 'demon' ? '恶魔' : r.team === 'minion' ? '爪牙' : r.team === 'outsider' ? '外来者' : '镇民'}`).join('\n');
      const winText = win === 'good' ? (en ? '🟦 GOOD wins — the Demon is dead.' : '🟦 好人胜利 —— 恶魔已伏诛。') : (en ? '🟥 EVIL wins.' : '🟥 邪恶胜利。');
      await admin.from('messages').insert({ room_id: roomId, sender_type: 'kp', turn_no: day, content: `${winText}\n\n${en ? 'Roles revealed:' : '身份揭晓：'}\n${reveal}`, payload: { type: 'botc_reveal', sfx: ['cue_reveal'], assignments: roles.map((r: any) => ({ seat: r.seat, role: r.role, team: r.team })) } });
      await admin.from('rooms').update({ botc_phase: 'reveal', game_state: 'ended', modules_generating: false }).eq('id', roomId);
      return NextResponse.json({ ok: true, win });
    }

    // 入夜：进入逐角色叫醒的夜晚阶段
    const nextDay = day + 1;
    // 自愈：给有主动夜间技能（含 inspect 查验）却漏发"夜间行动标签"的座位补发，
    // 修复在本次更新之前开的局——否则这些玩家夜里看不到行动 UI。
    try {
      const ACT = ['kill', 'poison', 'protect', 'inspect'];
      const { data: existRA } = await admin.from('messages').select('visibility').eq('room_id', roomId).contains('payload', { type: 'botc_role_action' });
      const haveSeat = new Set((existRA || []).map((m: any) => String(m.visibility || '').replace('seat:', '')));
      for (const r of roles) {
        if (!r.seat || !ACT.includes(r.night_action) || haveSeat.has(r.seat)) continue;
        await admin.from('messages').insert({ room_id: roomId, sender_type: 'system', turn_no: 0, content: '', visibility: `seat:${r.seat}`, payload: { type: 'botc_role_action', action: r.night_action } });
      }
    } catch {}
    await admin.from('messages').insert({ room_id: roomId, sender_type: 'kp', turn_no: nextDay, content: en ? `🌙 Night ${nextDay} falls. Players with night powers, take your actions.` : `🌙 第 ${nextDay} 夜降临，天黑请闭眼。拥有夜间能力的玩家请行动。`, payload: { type: 'botc_st', sfx: ['cue_nightfall'] } });
    await admin.from('rooms').update({ botc_phase: 'night', botc_day: nextDay, waiting_for: null, modules_generating: false }).eq('id', roomId);
    return NextResponse.json({ ok: true, night: nextDay });
  } catch (e: any) {
    await admin.from('rooms').update({ modules_generating: false }).eq('id', roomId);
    await admin.from('error_logs').insert({ room_id: roomId, scope: 'llm', message: '血染白天结算:' + e.message });
    return NextResponse.json({ error: '结算失败：' + e.message }, { status: 500 });
  }
}
