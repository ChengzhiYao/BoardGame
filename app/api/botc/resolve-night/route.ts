// 血染 · 结算夜晚（逐角色叫醒，按 投毒→保护→杀人→信息 次序）→ 天亮，进入白天。
import { NextResponse } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';
import { callLLMJson } from '@/lib/llm';
import { buildBotcNightResolvePrompt } from '@/lib/botc/prompt';
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
  if (!room || room.botc_phase !== 'night') return NextResponse.json({ error: '现在不是夜晚阶段' }, { status: 409 });
  const { data: meP } = await admin.from('players').select('id').eq('room_id', roomId).eq('user_id', user.id).maybeSingle();
  if (!meP) return NextResponse.json({ error: '你不在这个房间' }, { status: 403 });

  const { data: claim } = await admin.from('rooms').update({ modules_generating: true }).eq('id', roomId).eq('modules_generating', false).select('id');
  if (!claim || !claim.length) return NextResponse.json({ ok: true, busy: true });

  const en = room.language === 'en';
  try {
    const { data: setupRow } = await admin.from('botc_setup').select('data').eq('room_id', roomId).maybeSingle();
    const setup = setupRow?.data || {}; const roles: any[] = setup.roles || [];
    const day = room.botc_day || 2;
    const { data: bps } = await admin.from('botc_players').select('seat, display_name, is_ai, alive').eq('room_id', roomId);
    const aliveBp = (bps || []).filter((p: any) => p.alive);
    const aliveLabels = aliveBp.map((p: any) => p.seat ? `${p.seat}·${p.display_name}` : p.display_name);
    const realSeats = (bps || []).filter((p: any) => p.seat).map((p: any) => p.seat);
    const { data: nights } = await admin.from('botc_night').select('actor, action, target').eq('room_id', roomId).eq('day', day);
    const humanChoices = (nights || []).map((n: any) => `${n.actor}(${n.action})→${n.target}`).join('；') || '（无）';
    const { data: history } = await admin.from('messages').select('content, payload').eq('room_id', roomId).order('created_at', { ascending: true }).limit(50);
    const transcript = (history || []).filter((m: any) => m.payload?.type !== 'botc_role' && m.payload?.type !== 'botc_role_action').slice(-16).map((m: any) => m.content).filter(Boolean).join('\n').slice(0, 3000);

    const { data: out, usage } = await callLLMJson<any>({
      system: buildBotcNightResolvePrompt(setup, day, aliveLabels, realSeats, humanChoices, transcript) + langDirective(room.language),
      messages: [{ role: 'user', content: '请逐角色结算今夜。' }],
      tier: 'main', temperature: 0.7, maxTokens: 1500,
    });
    await admin.from('api_usage').insert({ room_id: roomId, kind: 'llm_main', model: usage.model, prompt_tokens: usage.promptTokens, completion_tokens: usage.completionTokens, latency_ms: usage.latencyMs });

    const markDead = async (ref: string) => {
      if (!ref) return;
      const seat = /^[A-H]$/.test(ref) ? ref : (/^[A-H]$/.test((ref.split('·')[0] || '')) ? ref.split('·')[0] : null);
      if (seat) await admin.from('botc_players').update({ alive: false }).eq('room_id', roomId).eq('seat', seat);
      else await admin.from('botc_players').update({ alive: false }).eq('room_id', roomId).eq('display_name', ref);
    };
    for (const d of (out.deaths || [])) await markDead(String(d));
    const deaths = (out.deaths || []).length;
    if (out.public_morning) await admin.from('messages').insert({ room_id: roomId, sender_type: 'kp', turn_no: day, content: out.public_morning, payload: { type: 'botc_st', sfx: deaths ? ['cue_dawn', 'cue_death'] : ['cue_dawn'] } });
    // 查验（inspect）结果代码确定性给出：按玩家实际选择的目标查其真实阵营，避免 LLM 把座位/名字搞混。
    const toSeatRef = (ref: string): string | null => {
      const x = String(ref || '').trim(); if (!x) return null;
      if (/^[A-H]$/.test(x)) return x;
      const head = x.split('·')[0]; if (/^[A-H]$/.test(head)) return head;
      const p = (bps || []).find((b: any) => b.display_name === x); return p?.seat || null;
    };
    const labelOfSeat = (seat: string) => { const p = (bps || []).find((b: any) => b.seat === seat); return p ? `${seat}·${p.display_name}` : seat; };
    const teamOfSeat = (seat: string) => { const r = roles.find((x: any) => x.seat === seat); return r?.team; };
    const humanInspects = (nights || []).filter((n: any) => n.action === 'inspect' && /^[A-H]$/.test(String(n.actor)));
    const inspectSeats = new Set(humanInspects.map((n: any) => String(n.actor)));
    const poisonedSet = new Set((Array.isArray(out.poisoned) ? out.poisoned : []).map((x: any) => String(x)));
    const isPoisoned = (seat: string) => poisonedSet.has(seat) || [...poisonedSet].some((v) => String(v).startsWith(seat + '·'));
    // 真人非查验私密信息照常由 LLM 给（learn 等）；查验座位跳过 LLM，改用确定性结果。
    for (const pn of (out.player_private || [])) {
      if (!pn?.text || !/^[A-H]$/.test(String(pn.to)) || inspectSeats.has(String(pn.to))) continue;
      await admin.from('messages').insert({ room_id: roomId, sender_type: 'system', turn_no: day, content: pn.text, visibility: `seat:${pn.to}`, payload: { type: 'botc_private' } });
    }
    for (const n of humanInspects) {
      const tSeat = toSeatRef(String(n.target)); if (!tSeat) continue;
      const team = teamOfSeat(tSeat);
      let evil = team === 'minion' || team === 'demon';
      if (isPoisoned(String(n.actor))) evil = !evil; // 中毒：情报为假
      const verdict = evil ? (en ? 'EVIL' : '邪恶阵营') : (en ? 'GOOD' : '善良阵营');
      const text = en ? `🔍 You investigated ${labelOfSeat(tSeat)} last night — result: 【${verdict}】.` : `🔍 你昨夜查验了 ${labelOfSeat(tSeat)} —— 结果：【${verdict}】。`;
      await admin.from('messages').insert({ room_id: roomId, sender_type: 'system', turn_no: day, content: text, visibility: `seat:${n.actor}`, payload: { type: 'botc_private' } });
    }
    // 把 AI 私密信息与中毒情况记进 setup，供 AI 白天推理
    const notes = Array.isArray(setup._notes) ? setup._notes : [];
    for (const a of (out.ai_private || [])) { if (a?.who && a?.text) notes.push({ day, who: a.who, text: a.text }); }
    if (Array.isArray(out.poisoned) && out.poisoned.length) notes.push({ day, who: '说书人', text: `本夜中毒/受影响：${out.poisoned.join('、')}` });
    await admin.from('botc_setup').update({ data: { ...setup, _notes: notes.slice(-40) } }).eq('room_id', roomId);

    // 夜后胜负判定
    const after = (await admin.from('botc_players').select('seat, display_name, alive').eq('room_id', roomId)).data || [];
    const demonRole = roles.find((r: any) => r.is_demon || r.team === 'demon');
    const demonKey = demonRole ? (demonRole.seat || null) : null;
    const demonAlive = !demonKey ? true : (after.find((p: any) => (/^[A-H]$/.test(demonKey) ? p.seat === demonKey : p.display_name === demonKey))?.alive ?? false);
    const aliveCount = after.filter((p: any) => p.alive).length;
    let win: 'good' | 'evil' | null = null;
    if (!demonAlive) win = 'good'; else if (aliveCount <= 2) win = 'evil';

    if (win) {
      const reveal = roles.map((r: any) => `${r.seat || r.role}：「${r.role}」 · ${r.team === 'demon' ? '恶魔' : r.team === 'minion' ? '爪牙' : r.team === 'outsider' ? '外来者' : '镇民'}`).join('\n');
      const winText = win === 'good' ? (en ? '🟦 GOOD wins.' : '🟦 好人胜利。') : (en ? '🟥 EVIL wins.' : '🟥 邪恶胜利。');
      await admin.from('messages').insert({ room_id: roomId, sender_type: 'kp', turn_no: day, content: `${winText}\n\n${en ? 'Roles:' : '身份揭晓：'}\n${reveal}`, payload: { type: 'botc_reveal', sfx: ['cue_reveal'], assignments: roles.map((r: any) => ({ seat: r.seat, role: r.role, team: r.team })) } });
      await admin.from('rooms').update({ botc_phase: 'reveal', game_state: 'ended', modules_generating: false }).eq('id', roomId);
      return NextResponse.json({ ok: true, win });
    }

    const firstAlive = after.filter((p: any) => p.alive).map((p: any) => p.seat).sort()[0] || null;
    await admin.from('rooms').update({ botc_phase: 'day', waiting_for: firstAlive, modules_generating: false }).eq('id', roomId);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    await admin.from('rooms').update({ modules_generating: false }).eq('id', roomId);
    await admin.from('error_logs').insert({ room_id: roomId, scope: 'llm', message: '血染夜晚:' + e.message });
    return NextResponse.json({ error: '夜晚结算失败：' + e.message }, { status: 500 });
  }
}
