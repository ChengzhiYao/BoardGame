// 双人回合制：收集 A/B 行动；两人都提交后由当前请求"抢占"结算权，统一调用 KP 结算。
import { NextResponse } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';
import { callLLMJson, type LLMMessage } from '@/lib/llm';
import { buildKpTurnSystem } from '@/lib/kp/prompt';
import { buildResolverSystem } from '@/lib/kp/resolver';
import { buildSummarizerSystem, SUMMARIZE_EVERY } from '@/lib/kp/memory';
import { skillCheck, OUTCOME_LABEL } from '@/lib/coc/dice';
import { skillValueFor } from '@/lib/coc/skills';
import { SFX_KEYS } from '@/lib/audio/sfx';
import { langDirective } from '@/lib/i18n';

export const maxDuration = 60; // 线上给 AI 结算更长超时（秒）

const ACTION_LABEL: Record<string, string> = { investigate: '调查', talk: '交谈', combat: '战斗', move: '移动', free: '', chat: '对话' };
function rollLoss(s: string): number {
  if (!s) return 0;
  const m = String(s).match(/(\d+)d(\d+)/i);
  if (m) { let t = 0; const n = +m[1], sd = +m[2]; for (let i = 0; i < n; i++) t += Math.floor(Math.random() * sd) + 1; return t; }
  return parseInt(s, 10) || 0;
}

export async function POST(req: Request) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });

  const { roomId, content, action_type } = await req.json().catch(() => ({} as any));
  if (!roomId || !content?.trim()) return NextResponse.json({ error: '缺少参数' }, { status: 400 });

  const admin = createAdminClient();
  const { data: me } = await admin.from('players').select('id, seat').eq('room_id', roomId).eq('user_id', user.id).maybeSingle();
  if (!me) return NextResponse.json({ error: '你不在这个房间' }, { status: 403 });

  const { data: room } = await admin.from('rooms').select('*').eq('id', roomId).maybeSingle();
  if (!room) return NextResponse.json({ error: '房间不存在' }, { status: 404 });
  if (room.game_state !== 'playing') return NextResponse.json({ error: '现在还不是跑团阶段。' }, { status: 409 });
  if (room.resolution_status === 'resolving') return NextResponse.json({ error: '本回合正在结算，请稍候。' }, { status: 409 });

  // 退场判断：死亡/永久疯狂的调查员不能再行动
  const { data: players0 } = await admin.from('players').select('id, seat, user_id').eq('room_id', roomId);
  const { data: chars0 } = await admin.from('characters').select('player_id, status_flags, hp_current, san_current').eq('room_id', roomId);
  const isOut = (c: any) => { const f = c?.status_flags || {}; return !!(f.dead || f.retired) || (c?.hp_current ?? 1) <= 0 || (c?.san_current ?? 1) <= 0; };
  const charOfSeat0 = (seat: string) => { const p = players0?.find((x: any) => x.seat === seat); return chars0?.find((c: any) => c.player_id === p?.id); };
  if (isOut(charOfSeat0(me.seat))) {
    return NextResponse.json({ error: '你的调查员已退场（死亡或永久疯狂），无法再行动。' }, { status: 409 });
  }

  // 写入我的待结算行动
  const pending = { ...(room.pending_actions || {}) };
  pending[me.seat] = { content: content.trim(), action_type: action_type || 'free', player_id: me.id };
  const readyPatch: any = { pending_actions: pending };
  if (me.seat === 'A') readyPatch.player_a_ready = true; else readyPatch.player_b_ready = true;
  await admin.from('rooms').update(readyPatch).eq('id', roomId);

  // 关键：写完后重新读取最新状态，避免两人几乎同时提交时各读到对方的旧值而双双卡住
  const { data: fresh } = await admin
    .from('rooms').select('player_a_ready, player_b_ready').eq('id', roomId).maybeSingle();
  // 已退场的座位视为"自动就绪"，让在场的另一名玩家可以独自推进
  const aReady = !!fresh?.player_a_ready || isOut(charOfSeat0('A'));
  const bReady = !!fresh?.player_b_ready || isOut(charOfSeat0('B'));

  if (!(aReady && bReady)) {
    const waiting_for = aReady ? 'B' : 'A';
    await admin.from('rooms').update({ waiting_for }).eq('id', roomId);
    return NextResponse.json({ ok: true, status: 'waiting', waiting_for });
  }

  // 两人都就绪：抢占结算（防止双方同时触发重复结算）
  const { data: claim } = await admin
    .from('rooms').update({ resolution_status: 'resolving', waiting_for: null })
    .eq('id', roomId).eq('resolution_status', 'collecting').select('id');
  if (!claim || !claim.length) {
    return NextResponse.json({ ok: true, status: 'resolving_by_other' });
  }

  try {
    await resolveRound(admin, roomId);
    return NextResponse.json({ ok: true, status: 'resolved' });
  } catch (e: any) {
    await admin.from('error_logs').insert({ room_id: roomId, scope: 'llm', message: '结算:' + e.message });
    // 回退到收集态，并清空双方就绪标记，让玩家可以重新提交（否则会卡在"都已提交却不结算"）
    await admin.from('rooms').update({
      resolution_status: 'collecting', waiting_for: 'both',
      player_a_ready: false, player_b_ready: false, pending_actions: {},
    }).eq('id', roomId);
    return NextResponse.json({ error: 'KP 结算出错，请重新提交行动：' + e.message }, { status: 500 });
  }
}

function madnessOf(c: any): string {
  const f = c?.status_flags || {};
  const san = c?.san_current ?? 99;
  if (f.indef_insanity) return '长期疯狂';
  if (f.temp_insanity) return '临时疯狂';
  if (san <= 20) return '濒临崩溃';
  return '';
}

async function resolveRound(admin: any, roomId: string) {
  const { data: room } = await admin.from('rooms').select('*').eq('id', roomId).maybeSingle();
  const { data: players } = await admin.from('players').select('id, seat, user_id').eq('room_id', roomId);
  const { data: characters } = await admin.from('characters').select('*').eq('room_id', roomId);
  const { data: users } = await admin.from('users').select('id, display_name').in('id', (players || []).map((p: any) => p.user_id));
  const charBySeat = (seat: string) => { const p = players?.find((x: any) => x.seat === seat); return characters?.find((c: any) => c.player_id === p?.id); };
  const nameOfSeat = (seat: string) => { const p = players?.find((x: any) => x.seat === seat); return users?.find((u: any) => u.id === p?.user_id)?.display_name || '调查员'; };
  const playerIdOfSeat = (seat: string) => players?.find((x: any) => x.seat === seat)?.id;

  const { data: campaign } = room.campaign_id ? await admin.from('campaigns').select('*').eq('id', room.campaign_id).maybeSingle() : { data: null };
  const { data: truth } = campaign ? await admin.from('hidden_case_files').select('*').eq('campaign_id', campaign.id).maybeSingle() : { data: null };
  const { data: clues } = await admin.from('clues').select('title, visible_to').eq('room_id', roomId);

  const round = room.current_round || 1;
  const pending = room.pending_actions || {};

  // 世界时钟：本回合到点（未触发且 due_round<=round）的事件
  const clock: any[] = Array.isArray(room.world_clock) ? room.world_clock : [];
  const due = clock.filter((e) => e && !e.fired && (Number(e.due_round) || 999) <= round);

  const ctxChars = (['A', 'B'] as const).map((seat) => {
    const c = charBySeat(seat);
    return { seat, name: c?.name || '调查员', occupation: c?.occupation || '', hp: `${c?.hp_current ?? '?'}/${c?.hp_max ?? '?'}`, san: `${c?.san_current ?? '?'}/${c?.san_max ?? '?'}`, skills: c?.skills ? Object.entries(c.skills).map(([k, v]: any) => `${k} ${v.total}`).join('、') : '', items: Array.isArray(c?.inventory) ? c.inventory.join('、') : '' };
  });
  const resourcesCtx = (['A', 'B'] as const).map((seat) => { const c = charBySeat(seat); return { seat, name: c?.name || '调查员', res: (c?.resources && typeof c.resources === 'object') ? c.resources : {} }; });
  const imageRemaining = (room.image_budget || 0) - (room.image_used || 0);
  const memory = room.memory || { summary: '', key_facts: [], up_to_round: 0 };
  // 解析器用的基础上下文（含资源，便于判断弹药够不够开枪）
  const baseCtx: any = { truth, campaign, characters: ctxChars, clues: clues || [], imageRemaining, intensity: 'medium', suspicion: room.suspicion || 0, memory, theme: campaign?.setting?.theme, resources: resourcesCtx };

  // 历史
  const { data: history } = await admin.from('messages').select('sender_type, sender_player_id, action_type, content, visibility').eq('room_id', roomId).order('created_at', { ascending: true }).limit(400);
  const nameOfPlayer = (pid: string | null) => { const p = players?.find((x: any) => x.id === pid); return `${users?.find((u: any) => u.id === p?.user_id)?.display_name || '调查员'}（${p?.seat || '?'}）`; };
  const baseMessages: LLMMessage[] = (history || []).slice(-16).map((m: any) => {
    if (m.sender_type === 'kp') return { role: 'assistant', content: m.content };
    const who = m.sender_type === 'player' ? nameOfPlayer(m.sender_player_id) : '【系统】';
    const act = m.action_type && ACTION_LABEL[m.action_type] ? `[${ACTION_LABEL[m.action_type]}] ` : '';
    return { role: 'user', content: `${who} ${act}${m.content}` } as LLMMessage;
  });

  // 落库两名玩家的行动 + 逐个解析掷骰
  const seatLines: Record<string, string[]> = { A: [], B: [] };
  for (const seat of ['A', 'B'] as const) {
    const pa = pending[seat];
    if (!pa?.content) continue;
    await admin.from('messages').insert({ room_id: roomId, sender_type: 'player', sender_player_id: pa.player_id || playerIdOfSeat(seat), action_type: pa.action_type || 'free', content: pa.content, turn_no: round, visibility: 'public' });

    // 解析（副模型）
    let plan: any = { checks: [], san_checks: [] };
    try {
      const r = await callLLMJson<any>({ system: buildResolverSystem(baseCtx) + langDirective(room.language), messages: [...baseMessages, { role: 'user', content: `${nameOfSeat(seat)}（${seat}）的行动：${pa.content}` }], tier: 'aux', temperature: 0.3, maxTokens: 600 });
      plan = r.data;
      await admin.from('api_usage').insert({ room_id: roomId, kind: 'llm_aux', model: r.usage.model, prompt_tokens: r.usage.promptTokens, completion_tokens: r.usage.completionTokens, latency_ms: r.usage.latencyMs });
    } catch {}

    const c = charBySeat(seat);
    for (const d of plan.checks || []) {
      // 技能值只从角色卡读真实固定值，不用 AI 猜的数
      const sv = skillValueFor(c, d.skill);
      const rr = skillCheck(sv);
      await admin.from('dice_rolls').insert({ room_id: roomId, character_id: c?.id || null, dice_type: 'd100', skill_name: d.skill, skill_value: sv, target_value: sv, result: rr.result, outcome: rr.outcome, context: d.reason, turn_no: round });
      const line = `${seat} · ${d.skill}（${sv}）→ ${rr.result} · ${OUTCOME_LABEL[rr.outcome]}`;
      seatLines[seat].push(line);
      await admin.from('messages').insert({ room_id: roomId, sender_type: 'system', turn_no: round, content: `🎲 ${line}`, payload: { type: 'dice', outcome: rr.outcome } });
    }
    for (const s of plan.san_checks || []) {
      if (!c) continue;
      const before = c.san_current ?? 0;
      const roll = skillCheck(before).result;
      const loss = rollLoss(roll <= before ? s.loss_success : s.loss_fail);
      const after = Math.max(0, before - loss);
      let insanity = 'none'; if (loss >= 5) insanity = 'temporary'; if (after === 0) insanity = 'indefinite';
      await admin.from('san_logs').insert({ room_id: roomId, character_id: c.id, trigger: s.trigger, roll_result: roll, san_before: before, san_after: after, loss, insanity_triggered: insanity, turn_no: round });
      const flags = { ...(c.status_flags || {}) };
      if (insanity === 'temporary') flags.temp_insanity = true;
      if (insanity === 'indefinite') { flags.indef_insanity = true; if (after === 0) flags.retired = true; }
      await admin.from('characters').update({ san_current: after, status_flags: flags }).eq('id', c.id);
      // 同步内存，便于随后计算疯狂状态
      c.san_current = after; c.status_flags = flags;
      const sline = `${seat} 理智检定（${s.trigger}）：${before}→${after}（-${loss}）${insanity !== 'none' ? (insanity === 'temporary' ? ' · 临时疯狂' : ' · 陷入疯狂') : ''}`;
      seatLines[seat].push(sline);
      await admin.from('messages').insert({ room_id: roomId, sender_type: 'system', turn_no: round, content: `🧠 ${sline}`, payload: { type: 'san' } });
    }
    // 敌意回击：玩家挑衅/攻击/送上门 → 敌人真的还手扣 HP（机制化，不靠叙述层良心）
    for (const ia of plan.incoming_attacks || []) {
      const tseat = ['A', 'B'].includes(ia.target) ? ia.target : seat;
      const tc = charBySeat(tseat); if (!tc) continue;
      const isTOut = (() => { const f = tc.status_flags || {}; return !!(f.dead || f.retired) || (tc.hp_current ?? 1) <= 0; })();
      if (isTOut) continue;
      const atkSkill = Math.max(5, Math.min(95, Number(ia.skill) || 40));
      const roll = Math.floor(Math.random() * 100) + 1;
      if (roll <= atkSkill) {
        const dmg = Math.max(1, rollLoss(ia.damage || '1d4'));
        const before2 = tc.hp_current ?? 0;
        const after2 = Math.max(0, before2 - dmg);
        const tflags = { ...(tc.status_flags || {}) };
        if (after2 <= 0) tflags.dead = true; else if (after2 <= 2) tflags.dying = true;
        await admin.from('characters').update({ hp_current: after2, status_flags: tflags }).eq('id', tc.id);
        tc.hp_current = after2; tc.status_flags = tflags;
        const cline = `${ia.attacker || '敌人'} 攻击 ${tseat}（${ia.means || '攻击'}）命中 → -${dmg} HP（${before2}→${after2}）${after2 <= 0 ? ' · 倒下' : ''}`;
        seatLines[seat].push(cline);
        await admin.from('messages').insert({ room_id: roomId, sender_type: 'system', turn_no: round, content: `⚔️ ${cline}`, payload: { type: 'combat' } });
      } else {
        const cline = `${ia.attacker || '敌人'} 扑向 ${tseat}（${ia.means || '攻击'}）未命中，包围更紧了`;
        seatLines[seat].push(cline);
        await admin.from('messages').insert({ room_id: roomId, sender_type: 'system', turn_no: round, content: `⚔️ ${cline}`, payload: { type: 'combat' } });
      }
    }
  }

  // 判定后：构造叙述上下文（含世界时钟 / NPC 记忆与态度 / 疯狂 / 资源）
  const madness = (['A', 'B'] as const).map((seat) => { const c = charBySeat(seat); const kind = madnessOf(c); return kind ? { seat, name: c?.name || '调查员', kind, san: c?.san_current ?? 0 } : null; }).filter(Boolean) as any[];
  const { data: npcRows } = await admin.from('npcs').select('name, role, disposition, goal, secret, memory, status, relationships').eq('room_id', roomId).order('first_seen_turn', { ascending: true });
  const narratorCtx: any = {
    ...baseCtx,
    round,
    worldClock: clock,
    clockDue: due.map((e) => ({ label: e.label, on_fire: e.on_fire })),
    npcs: npcRows || [],
    madness,
    resources: resourcesCtx,
  };

  // 统一叙述（主模型）
  const note = `【本回合双人行动与判定结果，请统一结算】
玩家A（${nameOfSeat('A')}）：${pending.A?.content || '（未行动）'}
A 判定：${seatLines.A.length ? seatLines.A.join('；') : '无需骰子'}
玩家B（${nameOfSeat('B')}）：${pending.B?.content || '（未行动）'}
B 判定：${seatLines.B.length ? seatLines.B.join('；') : '无需骰子'}
${due.length ? `\n★本回合世界时钟到点：${due.map((e) => e.label + (e.on_fire ? `（${e.on_fire}）` : '')).join('；')}——必须把它写进剧情。` : ''}
narration 必须分段输出：
【玩家A行动结果】…
【玩家B行动结果】…
【世界状态变化】…（嫌疑值/NPC态度/SAN/HP 概述）
下一步可行动作放进 guidance.options。骰子已判定，不要再请求。${round >= 25 ? `\n（本局已进行 ${round} 回合。若案件已接近真相或收尾，请果断给出结局：progress.ending_triggered=true 并写好 ending_text 与结局类型。）` : ''}`;

  const { data: out, usage } = await callLLMJson<any>({ system: buildKpTurnSystem(narratorCtx) + langDirective(room.language), messages: [...baseMessages, { role: 'user', content: note }], tier: 'main', temperature: 0.7, maxTokens: 3000, retry: true });
  await admin.from('api_usage').insert({ room_id: roomId, kind: 'llm_main', model: usage.model, prompt_tokens: usage.promptTokens, completion_tokens: usage.completionTokens, latency_ms: usage.latencyMs });

  // KP 旁白
  const validSfx = Array.isArray(out.sfx) ? out.sfx.filter((k: string) => SFX_KEYS.includes(k)) : [];
  if (out.narration) {
    await admin.from('messages').insert({ room_id: roomId, sender_type: 'kp', content: out.narration, turn_no: round, payload: { image_suggestion: out.image_suggestion?.should ? out.image_suggestion : undefined, sfx: validSfx.length ? validSfx : undefined, guidance: out.guidance && (out.guidance.location || out.guidance.options?.length || out.guidance.a || out.guidance.b) ? out.guidance : undefined } });
  }

  // 疯狂私有幻觉：以"KP 叙述"的样式只发给该玩家，与真实叙述难以分辨
  for (const h of out.hallucinations || []) {
    if (!h?.text || !['A', 'B'].includes(h.to)) continue;
    await admin.from('messages').insert({ room_id: roomId, sender_type: 'kp', turn_no: round, content: h.text, visibility: h.to === 'A' ? 'player_a' : 'player_b', payload: { hallucination: true } });
  }

  // 私人事件（明确标"仅你可见"，与幻觉不同）
  for (const pn of out.private_notes || []) {
    if (!pn?.text || !['A', 'B'].includes(pn.to)) continue;
    await admin.from('messages').insert({ room_id: roomId, sender_type: 'system', turn_no: round, content: pn.text, visibility: pn.to === 'A' ? 'player_a' : 'player_b', payload: { type: 'private' } });
  }

  // 各玩家当前所在地点（从各自的 guidance 块取，双人可分头行动）
  const g = out.guidance || {};
  const locOf = (seat: 'A' | 'B') => (seat === 'A' ? g.a?.location : g.b?.location) || g.location;
  for (const seat of ['A', 'B'] as const) {
    const loc = locOf(seat);
    if (loc) { const c = charBySeat(seat); if (c) await admin.from('characters').update({ current_location: loc }).eq('id', c.id); }
  }

  // 状态变化（含死亡 / 永久疯狂的退场标记）
  for (const sc of out.state_changes || []) {
    const c = charBySeat(sc.character); if (!c) continue;
    const patch: any = {};
    const flags = { ...(c.status_flags || {}) };
    if (sc.hp_delta) {
      const hp = Math.max(0, Math.min(c.hp_max, (c.hp_current ?? 0) + sc.hp_delta));
      patch.hp_current = hp;
      if (hp <= 0) flags.dead = true; else if (hp <= 2) flags.dying = true;
    }
    if (sc.san_delta) {
      const san = Math.max(0, (c.san_current ?? 0) + sc.san_delta);
      patch.san_current = san;
      if (san <= 0) { flags.indef_insanity = true; flags.retired = true; }
    }
    if (Object.keys(patch).length) { patch.status_flags = flags; await admin.from('characters').update(patch).eq('id', c.id); }
  }

  // 资源消耗（弹药/光源等）：只动已有的资源键，不无中生有
  for (const rc of out.resource_changes || []) {
    const c = charBySeat(rc.character); if (!c || !rc.key) continue;
    const res = { ...((c.resources && typeof c.resources === 'object') ? c.resources : {}) };
    if (res[rc.key] === undefined) continue;
    res[rc.key] = Math.max(0, (Number(res[rc.key]) || 0) + (Number(rc.delta) || 0));
    await admin.from('characters').update({ resources: res }).eq('id', c.id);
    c.resources = res;
  }

  // 世界反应：嫌疑值
  const susDelta = Number(out.suspicion_delta) || 0;
  const newSuspicion = Math.max(0, (room.suspicion || 0) + susDelta);
  if (susDelta !== 0 || out.world_reaction) {
    const parts: string[] = [];
    if (out.world_reaction) parts.push(out.world_reaction);
    if (susDelta !== 0) parts.push(`嫌疑值 ${susDelta > 0 ? '+' : ''}${susDelta}（现 ${newSuspicion}）`);
    await admin.from('messages').insert({ room_id: roomId, sender_type: 'system', turn_no: round, content: '【世界反应】' + parts.join(' · '), payload: { type: 'world' } });
  }

  // 线索
  for (const cl of out.clue_updates || []) {
    if (!cl.title) continue;
    await admin.from('clues').insert({ room_id: roomId, title: cl.title, description: cl.description, source: cl.source, is_key: !!cl.is_key, is_red_herring: !!cl.is_red_herring, thread: ['A', 'B', 'C', 'D', 'E'].includes(cl.thread) ? cl.thread : null, visible_to: ['all', 'A', 'B'].includes(cl.visible_to) ? cl.visible_to : 'all', discovered_turn: round, kind: 'clue' });
  }

  // NPC：自主行为 + 记忆 + 关系（已存在则更新，否则新建）
  const { data: existingNpcRows } = await admin.from('npcs').select('id, name, memory, relationships').eq('room_id', roomId);
  const npcByName = new Map((existingNpcRows || []).map((n: any) => [n.name, n]));
  const clampRel = (v: number) => Math.max(-3, Math.min(3, v));
  for (const n of out.npc_updates || []) {
    if (!n.name) continue;
    const relDelta = n.relationship_delta || {};
    const ex: any = npcByName.get(n.name);
    if (ex) {
      const rel = { ...((ex.relationships && typeof ex.relationships === 'object') ? ex.relationships : {}) };
      for (const s of ['A', 'B']) if (relDelta[s]) rel[s] = clampRel((Number(rel[s]) || 0) + Number(relDelta[s]));
      const mem = n.memory_append ? `${ex.memory ? ex.memory + '；' : ''}[r${round}]${n.memory_append}`.slice(-1200) : ex.memory;
      const patch: any = { last_seen_turn: round, relationships: rel, memory: mem };
      if (n.disposition) patch.disposition = n.disposition;
      if (n.goal) patch.goal = n.goal;
      if (n.secret) patch.secret = n.secret;
      if (n.status) patch.status = n.status;
      if (n.description) patch.description = n.description;
      await admin.from('npcs').update(patch).eq('id', ex.id);
    } else {
      const rel: any = {};
      for (const s of ['A', 'B']) rel[s] = clampRel(Number(relDelta[s] || 0));
      await admin.from('npcs').insert({ room_id: roomId, name: n.name, role: n.role, description: n.description, disposition: n.disposition, goal: n.goal, secret: n.secret, status: n.status || '正常', relationships: rel, memory: n.memory_append ? `[r${round}]${n.memory_append}` : null, first_seen_turn: round, last_seen_turn: round });
    }
    // 暗中行动：NPC 背着玩家做的事，作为"暗流"提示（不剧透，只给可察觉的痕迹）
    if (n.offscreen_action && String(n.offscreen_action).trim()) {
      await admin.from('messages').insert({ room_id: roomId, sender_type: 'system', turn_no: round, content: `【暗流】${n.name}：${n.offscreen_action}`, payload: { type: 'world' } });
    }
  }

  // 地点 / 时间线
  const existingLocs = new Set((await admin.from('locations').select('name').eq('room_id', roomId)).data?.map((l: any) => l.name));
  for (const l of out.location_updates || []) { if (!l.name || existingLocs.has(l.name)) continue; await admin.from('locations').insert({ room_id: roomId, name: l.name, description: l.description, first_seen_turn: round }); }
  for (const tl of out.timeline_updates || []) { if (!tl.description) continue; await admin.from('timeline_events').insert({ room_id: roomId, event_time: tl.event_time, description: tl.description, visible_to: ['all', 'A', 'B'].includes(tl.visible_to) ? tl.visible_to : 'all', revealed_turn: round }); }

  // 配图建议（分类型，存具体画面）
  if (out.image_suggestion?.should && imageRemaining > 0) {
    const is = out.image_suggestion;
    const validType = ['scene_image', 'npc_portrait', 'clue_evidence', 'monster_image', 'event_illustration'].includes(is.type) ? is.type : 'scene_image';
    if ((is.subject || '').trim()) {
      await admin.from('images').insert({ room_id: roomId, image_type: validType, trigger_type: is.reason || validType, prompt: is.subject, status: 'suggested', turn_no: round });
    }
  }

  // 世界时钟推进：标记本回合已触发；加入 KP 新增的倒计时
  let newClock = clock.map((e) => (due.some((d) => d.id === e.id) ? { ...e, fired: true } : e));
  for (const ca of out.clock_add || []) {
    if (!ca || !ca.label || !(Number(ca.due_round) > 0)) continue;
    const id = String(ca.id || ca.label).slice(0, 40);
    if (newClock.some((e) => e.id === id)) continue;
    newClock.push({ id, label: String(ca.label), due_round: Math.max(round + 1, Number(ca.due_round)), hidden: ca.hidden !== false, on_fire: String(ca.on_fire || ''), fired: false });
  }

  // 音乐情绪 + 怪物去重
  let scene = String(out.scene_state || '').toUpperCase();
  const flags = { ...(room.audio_flags || {}) };
  if (scene === 'MONSTER_REVEAL') { const seen: string[] = flags.monsters || []; const id = (out.monster_id || '').trim(); if (id && seen.includes(id)) scene = 'COMBAT'; else if (id) flags.monsters = [...seen, id]; }
  const validScenes = new Set(['MENU','CHARACTER_CREATION','EXPLORATION_SAFE','EXPLORATION_DANGEROUS','HIDDEN_CLUE','PARANORMAL_EVENT','MONSTER_REVEAL','CHASE_SEQUENCE','COMBAT','INVESTIGATION_BREAKTHROUGH','RITUAL_DISCOVERY','FINAL_CONFRONTATION','COSMIC_HORROR','GOOD_ENDING','BITTERSWEET_ENDING','BAD_ENDING','TRUTH_REVEAL']);

  // 战役记忆：每 SUMMARIZE_EVERY 回合压缩一次历史，控制 token 不随时长爆炸
  let newMemory = memory;
  if (round - (memory.up_to_round || 0) >= SUMMARIZE_EVERY) {
    try {
      const { data: toSum } = await admin.from('messages')
        .select('sender_type, content, turn_no')
        .eq('room_id', roomId).gt('turn_no', memory.up_to_round || 0).lte('turn_no', round)
        .order('created_at', { ascending: true }).limit(300);
      const text = (toSum || []).map((m: any) => `${m.sender_type === 'kp' ? 'KP' : m.sender_type === 'system' ? '系统' : '玩家'}：${m.content}`).join('\n');
      const { data: sd, usage: u2 } = await callLLMJson<any>({
        system: buildSummarizerSystem() + langDirective(room.language),
        messages: [{ role: 'user', content: `此前摘要：\n${memory.summary || '（无）'}\n\n已知关键事实：\n${(memory.key_facts || []).join('；') || '（无）'}\n\n最近发生：\n${text}\n\n请输出更新后的 summary 与 key_facts。` }],
        tier: 'aux', temperature: 0.2, maxTokens: 800,
      });
      newMemory = { summary: sd.summary || memory.summary, key_facts: Array.isArray(sd.key_facts) ? sd.key_facts : (memory.key_facts || []), up_to_round: round };
      await admin.from('api_usage').insert({ room_id: roomId, kind: 'llm_aux', model: u2.model, prompt_tokens: u2.promptTokens, completion_tokens: u2.completionTokens, latency_ms: u2.latencyMs });
    } catch { /* 压缩失败不影响主流程 */ }
  }

  // 重置回合，进入下一轮
  // 两名调查员是否都已退场（死亡/永久疯狂）→ 强制坏结局
  const { data: finalChars } = await admin.from('characters').select('status_flags, hp_current, san_current').eq('room_id', roomId);
  const isOut = (c: any) => { const f = c?.status_flags || {}; return !!(f.dead || f.retired) || (c?.hp_current ?? 1) <= 0 || (c?.san_current ?? 1) <= 0; };
  const bothOut = (finalChars?.length || 0) >= 1 && (finalChars || []).every(isOut);

  const roomPatch: any = {
    audio_flags: flags, suspicion: newSuspicion, memory: newMemory, world_clock: newClock,
    current_round: round + 1, turn_count: round,
    pending_actions: {}, player_a_ready: false, player_b_ready: false,
    waiting_for: 'both', resolution_status: 'collecting',
  };
  if (validScenes.has(scene)) roomPatch.scene_state = scene;
  if (out.progress?.ending_triggered) {
    roomPatch.game_state = 'ended';
    const kind = String(out.progress.ending_kind || '').toLowerCase();
    const kindScene = kind === 'good' ? 'GOOD_ENDING' : kind === 'bad' ? 'BAD_ENDING' : kind.includes('bitter') ? 'BITTERSWEET_ENDING' : (scene.includes('ENDING') ? scene : 'BITTERSWEET_ENDING');
    roomPatch.scene_state = kindScene;
    const kindLabel = kind === 'good' ? '好结局' : kind === 'bad' ? '坏结局' : kind === 'hidden' ? '隐藏结局' : kind.includes('bitter') ? '苦涩结局' : '结局';
    const name = out.progress.ending_name ? `《${out.progress.ending_name}》（${kindLabel}）\n` : '';
    await admin.from('messages').insert({ room_id: roomId, sender_type: 'system', turn_no: round, content: '【结局】' + name + (out.progress.ending_text || '调查到此结束。'), payload: { type: 'ending' } });
  } else if (bothOut) {
    roomPatch.game_state = 'ended';
    roomPatch.scene_state = 'BAD_ENDING';
    await admin.from('messages').insert({ room_id: roomId, sender_type: 'system', turn_no: round, content: '【结局】两位调查员都已倒下——一个死去，一个再也认不出这个世界。无人将真相带出此地。', payload: { type: 'ending' } });
  }
  await admin.from('rooms').update(roomPatch).eq('id', roomId);
}
