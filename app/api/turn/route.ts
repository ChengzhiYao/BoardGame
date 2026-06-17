// AI 守秘人回合（两段式行动解析）：
//   玩家行动 → [解析器:意图/澄清/骰检] → 若需澄清则追问并停 → 服务端掷骰/SAN
//   → [叙述器:据结果叙述后果 + 引导/线索/状态/配图/音乐] → 落库广播。
import { NextResponse } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';
import { callLLMJson, type LLMMessage } from '@/lib/llm';
import { buildKpTurnSystem } from '@/lib/kp/prompt';
import { buildResolverSystem } from '@/lib/kp/resolver';
import { skillCheck, OUTCOME_LABEL } from '@/lib/coc/dice';
import { SFX_KEYS } from '@/lib/audio/sfx';

const ACTION_LABEL: Record<string, string> = {
  investigate: '调查', talk: '交谈', combat: '战斗', move: '移动', free: '',
};

function rollLoss(s: string): number {
  if (!s) return 0;
  const m = String(s).match(/(\d+)d(\d+)/i);
  if (m) {
    let t = 0; const n = +m[1], sides = +m[2];
    for (let i = 0; i < n; i++) t += Math.floor(Math.random() * sides) + 1;
    return t;
  }
  return parseInt(s, 10) || 0;
}

export async function POST(req: Request) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });

  const { roomId, content, action } = await req.json().catch(() => ({} as any));
  if (!roomId || !content?.trim()) return NextResponse.json({ error: '缺少参数' }, { status: 400 });

  const admin = createAdminClient();
  const { data: me } = await admin.from('players').select('id, seat').eq('room_id', roomId).eq('user_id', user.id).maybeSingle();
  if (!me) return NextResponse.json({ error: '你不在这个房间' }, { status: 403 });

  const { data: room } = await admin.from('rooms').select('*').eq('id', roomId).maybeSingle();
  if (!room) return NextResponse.json({ error: '房间不存在' }, { status: 404 });
  if (room.game_state !== 'playing') return NextResponse.json({ error: '现在还不是跑团阶段。' }, { status: 409 });

  const { data: players } = await admin.from('players').select('id, seat, user_id').eq('room_id', roomId);
  const { data: characters } = await admin.from('characters').select('*').eq('room_id', roomId);
  const { data: users } = await admin.from('users').select('id, display_name').in('id', (players || []).map(p => p.user_id));
  const charBySeat = (seat: string) => {
    const p = players?.find(x => x.seat === seat);
    return characters?.find(c => c.player_id === p?.id);
  };
  const nameOfPlayer = (pid: string | null) => {
    const p = players?.find(x => x.id === pid);
    const u = users?.find(x => x.id === p?.user_id);
    return `${u?.display_name || '调查员'}（${p?.seat || '?'}）`;
  };

  const { data: campaign } = room.campaign_id
    ? await admin.from('campaigns').select('*').eq('id', room.campaign_id).maybeSingle()
    : { data: null };
  const { data: truth } = campaign
    ? await admin.from('hidden_case_files').select('*').eq('campaign_id', campaign.id).maybeSingle()
    : { data: null };
  const { data: clues } = await admin.from('clues').select('title, visible_to').eq('room_id', roomId);

  const turnNo = (room.turn_count || 0) + 1;

  // 落库玩家行动
  await admin.from('messages').insert({
    room_id: roomId, sender_type: 'player', sender_player_id: me.id,
    action_type: action || 'free', content: content.trim(), turn_no: turnNo,
  });

  // 上下文
  const ctxChars = (['A', 'B'] as const).map(seat => {
    const c = charBySeat(seat);
    return {
      seat, name: c?.name || '调查员', occupation: c?.occupation || '',
      hp: `${c?.hp_current ?? '?'}/${c?.hp_max ?? '?'}`,
      san: `${c?.san_current ?? '?'}/${c?.san_max ?? '?'}`,
      skills: c?.skills ? Object.entries(c.skills).map(([k, v]: any) => `${k} ${v.total}`).join('、') : '',
    };
  });
  const imageRemaining = (room.image_budget || 0) - (room.image_used || 0);
  const baseCtx = { truth, campaign, characters: ctxChars, clues: clues || [], imageRemaining, intensity: 'medium', suspicion: room.suspicion || 0 };

  const { data: history } = await admin.from('messages')
    .select('sender_type, sender_player_id, action_type, content')
    .eq('room_id', roomId).order('created_at', { ascending: true }).limit(400);
  const recent = (history || []).slice(-16);
  const llmMessages: LLMMessage[] = recent.map(m => {
    if (m.sender_type === 'kp') return { role: 'assistant', content: m.content };
    const who = m.sender_type === 'player' ? nameOfPlayer(m.sender_player_id) : '【系统】';
    const act = m.action_type && ACTION_LABEL[m.action_type] ? `[${ACTION_LABEL[m.action_type]}] ` : '';
    return { role: 'user', content: `${who} ${act}${m.content}` };
  });

  // ---------- 第一段：解析行动 ----------
  let plan: any;
  try {
    const r = await callLLMJson<any>({
      system: buildResolverSystem(baseCtx), messages: llmMessages, tier: 'aux', temperature: 0.3, maxTokens: 700,
    });
    plan = r.data;
    await admin.from('api_usage').insert({
      room_id: roomId, kind: 'llm_aux', model: r.usage.model,
      prompt_tokens: r.usage.promptTokens, completion_tokens: r.usage.completionTokens, latency_ms: r.usage.latencyMs,
    });
  } catch (e: any) {
    await admin.from('error_logs').insert({ room_id: roomId, scope: 'llm', message: '解析器:' + e.message });
    plan = { needs_clarification: false, checks: [], san_checks: [] };
  }

  // 需要澄清 → 追问并停（不推进剧情）
  if (plan.needs_clarification && plan.clarify_question) {
    await admin.from('messages').insert({
      room_id: roomId, sender_type: 'kp', turn_no: turnNo,
      content: plan.clarify_question, payload: { type: 'clarify' },
    });
    await admin.from('rooms').update({ turn_count: turnNo }).eq('id', roomId);
    return NextResponse.json({ ok: true, clarify: true });
  }

  // ---------- 掷骰 + SAN（服务端，结果不可改）----------
  const resultLines: string[] = [];
  for (const d of plan.checks || []) {
    const c = charBySeat(d.character);
    const sv = Number(d.skill_value) || 0;
    const r = skillCheck(sv);
    await admin.from('dice_rolls').insert({
      room_id: roomId, character_id: c?.id || null, dice_type: 'd100',
      skill_name: d.skill, skill_value: sv, target_value: sv, result: r.result,
      outcome: r.outcome, context: d.reason, turn_no: turnNo,
    });
    const line = `${d.character} · ${d.skill}（${sv}）→ ${r.result} · ${OUTCOME_LABEL[r.outcome]}`;
    resultLines.push(line);
    await admin.from('messages').insert({
      room_id: roomId, sender_type: 'system', turn_no: turnNo,
      content: `🎲 ${line}`, payload: { type: 'dice', outcome: r.outcome },
    });
  }
  for (const s of plan.san_checks || []) {
    const c = charBySeat(s.character);
    if (!c) continue;
    const before = c.san_current ?? 0;
    const roll = skillCheck(before).result;
    const success = roll <= before;
    const loss = rollLoss(success ? s.loss_success : s.loss_fail);
    const after = Math.max(0, before - loss);
    let insanity = 'none';
    if (loss >= 5) insanity = 'temporary';
    if (after === 0) insanity = 'indefinite';
    await admin.from('san_logs').insert({
      room_id: roomId, character_id: c.id, trigger: s.trigger, roll_result: roll,
      san_before: before, san_after: after, loss, insanity_triggered: insanity, turn_no: turnNo,
    });
    const flags = { ...(c.status_flags || {}) };
    if (insanity === 'temporary') flags.temp_insanity = true;
    if (insanity === 'indefinite') { flags.indef_insanity = true; if (after === 0) flags.retired = true; }
    await admin.from('characters').update({ san_current: after, status_flags: flags }).eq('id', c.id);
    const sline = `${s.character} 理智检定（${s.trigger}）：${before}→${after}（-${loss}）${insanity !== 'none' ? (insanity === 'temporary' ? ' · 临时疯狂' : ' · 陷入疯狂') : ''}`;
    resultLines.push(sline);
    await admin.from('messages').insert({
      room_id: roomId, sender_type: 'system', turn_no: turnNo, content: `🧠 ${sline}`, payload: { type: 'san' },
    });
  }

  // ---------- 第二段：据结果叙述后果 ----------
  const resultNote = resultLines.length
    ? `【本回合判定结果（骰子/SAN 已由系统判定，请据此叙述后果，不要再请求骰子）】\n${resultLines.join('\n')}`
    : `【本回合无需骰子判定，请直接叙述这个行动的合理结果】`;
  const narratorMessages: LLMMessage[] = [...llmMessages, { role: 'user', content: resultNote }];

  let out: any;
  try {
    const { data, usage } = await callLLMJson<any>({
      system: buildKpTurnSystem(baseCtx), messages: narratorMessages, tier: 'main', temperature: 0.7, maxTokens: 1400,
    });
    out = data;
    await admin.from('api_usage').insert({
      room_id: roomId, kind: 'llm_main', model: usage.model,
      prompt_tokens: usage.promptTokens, completion_tokens: usage.completionTokens, latency_ms: usage.latencyMs,
    });
  } catch (e: any) {
    await admin.from('error_logs').insert({ room_id: roomId, scope: 'llm', message: '叙述器:' + e.message });
    return NextResponse.json({ error: 'AI 守秘人出错：' + e.message }, { status: 500 });
  }

  // KP 旁白 + 引导 + 音效（注意：忽略叙述器返回的 needs_dice/needs_san，骰子已在上面判定）
  const validSfx = Array.isArray(out.sfx) ? out.sfx.filter((k: string) => SFX_KEYS.includes(k)) : [];
  if (out.narration) {
    await admin.from('messages').insert({
      room_id: roomId, sender_type: 'kp', content: out.narration, turn_no: turnNo,
      payload: {
        image_suggestion: out.image_suggestion?.should ? out.image_suggestion : undefined,
        sfx: validSfx.length ? validSfx : undefined,
        guidance: out.guidance && (out.guidance.location || out.guidance.options?.length) ? out.guidance : undefined,
      },
    });
  }

  // 状态变化
  for (const sc of out.state_changes || []) {
    const c = charBySeat(sc.character);
    if (!c) continue;
    const patch: any = {};
    if (sc.hp_delta) patch.hp_current = Math.max(0, Math.min(c.hp_max, (c.hp_current ?? 0) + sc.hp_delta));
    if (sc.san_delta) patch.san_current = Math.max(0, (c.san_current ?? 0) + sc.san_delta);
    if (Object.keys(patch).length) await admin.from('characters').update(patch).eq('id', c.id);
  }

  // 世界反应：嫌疑值
  const susDelta = Number(out.suspicion_delta) || 0;
  const newSuspicion = Math.max(0, (room.suspicion || 0) + susDelta);
  if (susDelta !== 0 || out.world_reaction) {
    const parts: string[] = [];
    if (out.world_reaction) parts.push(out.world_reaction);
    if (susDelta !== 0) parts.push(`嫌疑值 ${susDelta > 0 ? '+' : ''}${susDelta}（现 ${newSuspicion}）`);
    await admin.from('messages').insert({
      room_id: roomId, sender_type: 'system', turn_no: turnNo,
      content: '【世界反应】' + parts.join(' · '), payload: { type: 'world' },
    });
  }

  // 线索 / NPC / 地点 / 时间线
  for (const cl of out.clue_updates || []) {
    if (!cl.title) continue;
    await admin.from('clues').insert({
      room_id: roomId, title: cl.title, description: cl.description, source: cl.source,
      is_key: !!cl.is_key, is_red_herring: !!cl.is_red_herring,
      thread: ['A', 'B', 'C', 'D', 'E'].includes(cl.thread) ? cl.thread : null,
      visible_to: ['all', 'A', 'B'].includes(cl.visible_to) ? cl.visible_to : 'all', discovered_turn: turnNo,
    });
  }
  const existingNpcs = new Set((await admin.from('npcs').select('name').eq('room_id', roomId)).data?.map((n: any) => n.name));
  for (const n of out.npc_updates || []) {
    if (!n.name || existingNpcs.has(n.name)) continue;
    await admin.from('npcs').insert({ room_id: roomId, name: n.name, role: n.role, description: n.description, disposition: n.disposition, first_seen_turn: turnNo });
  }
  const existingLocs = new Set((await admin.from('locations').select('name').eq('room_id', roomId)).data?.map((l: any) => l.name));
  for (const l of out.location_updates || []) {
    if (!l.name || existingLocs.has(l.name)) continue;
    await admin.from('locations').insert({ room_id: roomId, name: l.name, description: l.description, first_seen_turn: turnNo });
  }
  for (const tl of out.timeline_updates || []) {
    if (!tl.description) continue;
    await admin.from('timeline_events').insert({
      room_id: roomId, event_time: tl.event_time, description: tl.description,
      visible_to: ['all', 'A', 'B'].includes(tl.visible_to) ? tl.visible_to : 'all', revealed_turn: turnNo,
    });
  }

  // 配图建议
  if (out.image_suggestion?.should && imageRemaining > 0) {
    const is = out.image_suggestion;
    const validType = ['scene_image', 'npc_portrait', 'clue_evidence', 'monster_image', 'event_illustration'].includes(is.type) ? is.type : 'scene_image';
    if ((is.subject || '').trim()) {
      await admin.from('images').insert({
        room_id: roomId, image_type: validType, trigger_type: is.reason || validType, prompt: is.subject, status: 'suggested', turn_no: turnNo,
      });
    }
  }

  // 音乐情绪 + 怪物去重
  let scene = String(out.scene_state || '').toUpperCase();
  const flags = { ...(room.audio_flags || {}) };
  if (scene === 'MONSTER_REVEAL') {
    const seen: string[] = flags.monsters || [];
    const id = (out.monster_id || '').trim();
    if (id && seen.includes(id)) scene = 'COMBAT';
    else if (id) flags.monsters = [...seen, id];
  }
  const validScenes = new Set(['MENU','CHARACTER_CREATION','EXPLORATION_SAFE','EXPLORATION_DANGEROUS','HIDDEN_CLUE','PARANORMAL_EVENT','MONSTER_REVEAL','CHASE_SEQUENCE','COMBAT','INVESTIGATION_BREAKTHROUGH','RITUAL_DISCOVERY','FINAL_CONFRONTATION','COSMIC_HORROR','GOOD_ENDING','BITTERSWEET_ENDING','BAD_ENDING','TRUTH_REVEAL']);

  const roomPatch: any = { turn_count: turnNo, audio_flags: flags, suspicion: newSuspicion };
  if (validScenes.has(scene)) roomPatch.scene_state = scene;
  if (out.progress?.ending_triggered) {
    roomPatch.game_state = 'ended';
    if (!scene.includes('ENDING')) roomPatch.scene_state = 'BAD_ENDING';
    await admin.from('messages').insert({
      room_id: roomId, sender_type: 'system', turn_no: turnNo,
      content: '【结局】' + (out.progress.ending_text || '调查到此结束。'), payload: { type: 'ending' },
    });
  }
  await admin.from('rooms').update(roomPatch).eq('id', roomId);

  return NextResponse.json({ ok: true });
}
