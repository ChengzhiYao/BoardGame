// 选定剧本 → 生成隐藏案件 + 全部角色（含 AI 补位）→ 分配真人角色 + 私信下发秘密 → 开本第一幕。
import { NextResponse } from 'next/server';
import { companionNote, sendRecap } from '@/lib/linger/companion';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';
import { callLLMJson } from '@/lib/llm';
import { buildJbsCasePrompt } from '@/lib/jbs/prompt';
import { ensureStage, publicStage, condenseActs } from '@/lib/jbs/stage';
import { dmBeat } from '@/lib/jbs/turn';
import { buildModuleReviewSystem, normalizeModuleQuality } from '@/lib/review/quality';
import { langDirective } from '@/lib/i18n';

export const maxDuration = 300;

export async function POST(req: Request) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });

  const { roomId, scriptId, actMinutes, short } = await req.json().catch(() => ({} as any));
  const isShort = short !== false; // 默认短本
  if (!roomId || !scriptId) return NextResponse.json({ error: '缺少参数' }, { status: 400 });
  const actMin = Math.min(20, Math.max(2, Number(actMinutes) || (isShort ? 6 : 9)));

  const admin = createAdminClient();
  const { data: room } = await admin.from('rooms').select('*').eq('id', roomId).maybeSingle();
  if (!room) return NextResponse.json({ error: '房间不存在' }, { status: 404 });
  // 房间内任何玩家都能选本开本
  const { data: me } = await admin.from('players').select('id').eq('room_id', roomId).eq('user_id', user.id).maybeSingle();
  if (!me) return NextResponse.json({ error: '你不在这个房间' }, { status: 403 });
  if (room.jbs_phase === 'playing') return NextResponse.json({ ok: true }); // 幂等

  const chosen = (room.jbs_options || []).find((s: any) => s.id === scriptId);
  if (!chosen) return NextResponse.json({ error: '剧本不存在' }, { status: 400 });

  const { data: players } = await admin.from('players').select('id, seat').eq('room_id', roomId);
  const realSeats = (players || []).map((p: any) => p.seat).filter((s: string) => /^[A-H]$/.test(s)).sort();
  let headcount = Math.max(realSeats.length, Math.min(8, Number(chosen.headcount) || 6));
  // 题库现成案件：人数够就直接用（不再生成，开场白有配音）
  let libCase: any = null;
  if (chosen.from_library) {
    const { data: lc } = await admin.from('jbs_case_library').select('id, headcount, case_file, opening_audio, plays').eq('id', chosen.from_library).maybeSingle();
    if (lc?.case_file && lc.headcount >= realSeats.length) { libCase = lc; headcount = lc.headcount; }
  }

  // 原子锁：只有把 phase 从 script/lobby 抢到 locking 的那一个请求能继续，避免多人同时点"选这个"导致重复开本。
  const { data: claimed } = await admin.from('rooms').update({ jbs_phase: 'locking', modules_generating: true }).eq('id', roomId).in('jbs_phase', ['script', 'lobby']).select('id');
  if (!claimed || !claimed.length) return NextResponse.json({ ok: true, already: true });
  // 清掉本房间可能残留的旧案件/角色，保证只有一套
  await admin.from('jbs_cases').delete().eq('room_id', roomId);
  await admin.from('jbs_characters').delete().eq('room_id', roomId);
  try {
    let cf: any;
    if (libCase) {
      cf = JSON.parse(JSON.stringify(libCase.case_file));
      await admin.from('jbs_case_library').update({ plays: (libCase.plays || 0) + 1 }).eq('id', libCase.id);
    } else {
      const g = await callLLMJson<any>({
        system: buildJbsCasePrompt(chosen, headcount, realSeats) + langDirective(room.language),
        messages: [{ role: 'user', content: '请生成隐藏案件与全部角色。' }],
        tier: 'main', temperature: 0.8, maxTokens: 8000,
      });
      cf = g.data;
      await admin.from('api_usage').insert({ room_id: roomId, kind: 'llm_main', model: g.usage.model, prompt_tokens: g.usage.promptTokens, completion_tokens: g.usage.completionTokens, latency_ms: g.usage.latencyMs });
    }
    // 舞台（场景 / 配角 / 每幕演出与突发事件 / 分幕剧本）：缺的话补一次，本库里的案件补完就存回去
    try {
      const st = await ensureStage(admin, cf, libCase?.id || null, room.language);
      cf = st.cf;
      if (st.usage) await admin.from('api_usage').insert({ room_id: roomId, kind: 'llm_main', model: st.usage.model, prompt_tokens: st.usage.promptTokens, completion_tokens: st.usage.completionTokens, latency_ms: st.usage.latencyMs });
    } catch (e: any) { await admin.from('error_logs').insert({ room_id: roomId, scope: 'llm', message: '剧本杀补舞台:' + e.message }); }
    if (isShort) cf = condenseActs(cf);

    // 共享评审引擎：对锁定的剧本案件打加权分 + 封顶 + 诊断，存入 case_file.quality（不改表）
    if (!libCase) try {
      const { data: rev, usage: ru } = await callLLMJson<any>({
        system: buildModuleReviewSystem('jbs', room.language),
        messages: [{ role: 'user', content: '剧本案件：\n' + JSON.stringify(cf).slice(0, 6000) }],
        tier: 'aux', temperature: 0.2, maxTokens: 1100,
      });
      cf.quality = normalizeModuleQuality(rev, 'jbs');
      await admin.from('api_usage').insert({ room_id: roomId, kind: 'llm_aux', model: ru.model, prompt_tokens: ru.promptTokens, completion_tokens: ru.completionTokens, latency_ms: ru.latencyMs });
    } catch {}

    const chars: any[] = Array.isArray(cf.characters) ? cf.characters : [];
    if (chars.length < headcount) throw new Error('角色生成不足');

    // 锁定隐藏案件
    await admin.from('jbs_cases').insert({
      room_id: roomId, type: cf.type || chosen.type, title: cf.title || chosen.title,
      headcount, meter_key: cf.meter_key || '推理值', case_file: cf, locked_at: new Date().toISOString(),
    });

    // 分配：真人座位拿前 N 个角色，其余 AI 补位
    await admin.from('jbs_characters').delete().eq('room_id', roomId);
    const en = room.language === 'en';
    const roster: string[] = [];
    // Linger 伴侣:演第一个 AI 角色
    const comp = room.companion && room.companion.name ? room.companion : null;
    const compIdx = comp && chars.length > realSeats.length ? realSeats.length : -1;
    if (comp && compIdx >= 0) await admin.from('rooms').update({ companion: { ...comp, role: chars[compIdx].name } }).eq('id', roomId);
    for (let i = 0; i < chars.length; i++) {
      const c = chars[i];
      const seat = i < realSeats.length ? realSeats[i] : null;
      const row: any = {
        room_id: roomId, name: c.name, age: c.age || '', occupation: c.occupation || '',
        public_info: c.public_info || '', is_ai: !seat, assigned_seat: seat, faction: c.faction || null, status: 'alive',
      };
      const g = (c.gender === 'female' || c.gender === '女' || c.gender === 'f') ? 'female' : 'male';
      const ins = await admin.from('jbs_characters').insert({ ...row, gender: g });
      if (ins.error) await admin.from('jbs_characters').insert(row);
      roster.push(`· ${c.name}（${c.occupation || ''}）${c.public_info || ''}${seat ? `　[${seat}]` : i === compIdx ? `　[${comp.name}]` : '　[AI]'}`);
    }

    // 公开角色名册
    await admin.from('messages').insert({
      room_id: roomId, sender_type: 'system', turn_no: 0,
      content: (en ? '[Cast]\n' : '【角色名册】\n') + roster.join('\n'),
      payload: { type: 'jbs_roster' },
    });
    // 私信每位真人本人的秘密角色卡
    for (let i = 0; i < realSeats.length; i++) {
      const c = chars[i];
      const seat = realSeats[i];
      const card = (en ? `You are 「${c.name}」 (${c.occupation || ''})\n` : `你扮演「${c.name}」（${c.occupation || ''}）\n`)
        + (en ? 'Background: ' : '背景：') + (c.background || '') + '\n'
        + (en ? 'Secret (yours only): ' : '你的秘密（仅你可见）：') + (c.secret || '') + '\n'
        + (en ? 'Private goal: ' : '私人目标：') + (c.private_goal || '') + '\n'
        + (en ? 'Private task: ' : '私人任务：') + (c.private_task || '') + '\n'
        + (en ? 'Relationships: ' : '隐藏关系：') + (c.relationships || '')
        + (c.faction ? (en ? `\nFaction: ${c.faction}` : `\n所属阵营：${c.faction}`) : '');
      await admin.from('messages').insert({
        room_id: roomId, sender_type: 'system', turn_no: 0, content: card,
        visibility: `seat:${seat}`, payload: { type: 'jbs_role' },
      });
      // 结构化私人任务清单（DM 据此裁定完成度，结算计入）
      const factionWin = c.faction ? ((cf.factions || []).find((f: any) => f.name === c.faction)?.win || '') : '';
      const objs: { kind: string; text: string }[] = [];
      if (c.private_task) objs.push({ kind: 'task', text: String(c.private_task) });
      if (c.private_goal) objs.push({ kind: 'goal', text: String(c.private_goal) });
      if (c.faction && factionWin) objs.push({ kind: 'faction', text: `【阵营·${c.faction}】${factionWin}` });
      for (let oi = 0; oi < objs.length; oi++) {
        await admin.from('jbs_objectives').insert({ room_id: roomId, seat, idx: oi, kind: objs[oi].kind, text: objs[oi].text, status: 'pending' });
      }
    }
    // 第一幕：先亮出地点，再是开场白，再是开场演出
    const stage: any = { ...publicStage(cf), meta: { era: cf.era || chosen.era, genre: chosen.genre, place: chosen.place, type: cf.type || chosen.type, title: cf.title || chosen.title } };
    const sc0 = stage.scenes.find((x: any) => x.id === stage.scene);
    if (sc0) await admin.from('messages').insert({ room_id: roomId, sender_type: 'system', turn_no: 1, content: sc0.name, payload: { type: 'jbs_scene', scene: sc0.id } });
    await admin.from('messages').insert({
      room_id: roomId, sender_type: 'kp', turn_no: 1,
      content: cf.opening || (en ? 'The story begins.' : '故事，从这里开始。'),
      payload: { type: 'jbs_dm', audio: libCase?.opening_audio || undefined },
    });
    const show1 = cf.acts?.[0]?.show;
    if (show1) await admin.from('messages').insert({ room_id: roomId, sender_type: 'kp', turn_no: 1, content: show1, payload: { type: 'jbs_dm', show: true } });

    const acts: any[] = Array.isArray(cf.acts) && cf.acts.length >= 4 ? cf.acts : [];
    const totalActs = acts.length ? Math.min(8, Math.max(cf.short ? 4 : 5, acts.length)) : (isShort ? 5 : 7);
    const actNames = acts.length
      ? acts.slice(0, totalActs).map((a: any) => a?.name || '')
      : (en ? ['Opening', 'Investigate', 'Relationships', 'Key Evidence', 'Discussion', 'Accusation', 'Reveal'] : ['案件开场', '搜证', '人物关系', '关键证据', '推理讨论', '最终指认', '真相揭晓']);

    await admin.from('rooms').update({
      game_state: 'playing', jbs_phase: 'playing', jbs_act: 1, modules_generating: false, jbs_type: cf.type || chosen.type || '推理',
      jbs_act_minutes: actMin, jbs_act_started_at: new Date().toISOString(),
      jbs_total_acts: totalActs, jbs_act_names: actNames, jbs_stage: stage,
    }).eq('id', roomId);

    // 第一幕别让人干等：主持人逐个点名真人玩家，给每人一件马上能做的事
    try {
      await dmBeat(admin, roomId, { ...room, jbs_act: 1, jbs_act_minutes: actMin, jbs_stage: stage }, cf,
        en ? '(Kick-off) Everyone has read their script. Call on each real player BY CHARACTER NAME, one short line each: a pointed question or a concrete first thing to do right now (a place to search, a person to confront). Have one AI character react. Do not reveal clues.'
           : '（开局点名）大家都读完剧本了。请按角色名逐个点名在座的真人玩家，每人一句：一个尖锐的问题，或一件现在就能做的事（去哪里搜、去质问谁）。再让一个 AI 角色接一句话。不要公布线索。', 1);
    } catch (e: any) { await admin.from('error_logs').insert({ room_id: roomId, scope: 'llm', message: '剧本杀开局点名:' + e.message }); }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    await admin.from('rooms').update({ jbs_phase: 'script', modules_generating: false }).eq('id', roomId);
    await admin.from('error_logs').insert({ room_id: roomId, scope: 'llm', message: '剧本杀开本:' + e.message });
    return NextResponse.json({ error: '开本失败：' + e.message }, { status: 500 });
  }
}
