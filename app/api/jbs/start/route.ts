// 选定剧本 → 生成隐藏案件 + 全部角色（含 AI 补位）→ 分配真人角色 + 私信下发秘密 → 开本第一幕。
import { NextResponse } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';
import { callLLMJson } from '@/lib/llm';
import { buildJbsCasePrompt } from '@/lib/jbs/prompt';
import { langDirective } from '@/lib/i18n';

export const maxDuration = 60;

export async function POST(req: Request) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });

  const { roomId, scriptId, actMinutes } = await req.json().catch(() => ({} as any));
  if (!roomId || !scriptId) return NextResponse.json({ error: '缺少参数' }, { status: 400 });
  const actMin = Math.min(20, Math.max(2, Number(actMinutes) || 9));

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
  const headcount = Math.max(realSeats.length, Math.min(8, Number(chosen.headcount) || 6));

  // 原子锁：只有把 phase 从 script/lobby 抢到 locking 的那一个请求能继续，避免多人同时点"选这个"导致重复开本。
  const { data: claimed } = await admin.from('rooms').update({ jbs_phase: 'locking', modules_generating: true }).eq('id', roomId).in('jbs_phase', ['script', 'lobby']).select('id');
  if (!claimed || !claimed.length) return NextResponse.json({ ok: true, already: true });
  // 清掉本房间可能残留的旧案件/角色，保证只有一套
  await admin.from('jbs_cases').delete().eq('room_id', roomId);
  await admin.from('jbs_characters').delete().eq('room_id', roomId);
  try {
    const { data: cf, usage } = await callLLMJson<any>({
      system: buildJbsCasePrompt(chosen, headcount, realSeats) + langDirective(room.language),
      messages: [{ role: 'user', content: '请生成隐藏案件与全部角色。' }],
      tier: 'main', temperature: 0.8, maxTokens: 5200,
    });
    await admin.from('api_usage').insert({ room_id: roomId, kind: 'llm_main', model: usage.model, prompt_tokens: usage.promptTokens, completion_tokens: usage.completionTokens, latency_ms: usage.latencyMs });

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
      roster.push(`· ${c.name}（${c.occupation || ''}）${c.public_info || ''}${seat ? `　[${seat}]` : '　[AI]'}`);
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
    // DM 开场白
    await admin.from('messages').insert({
      room_id: roomId, sender_type: 'kp', turn_no: 1,
      content: cf.opening || (en ? 'The story begins.' : '故事，从这里开始。'),
      payload: { type: 'jbs_dm' },
    });

    const acts: any[] = Array.isArray(cf.acts) && cf.acts.length >= 4 ? cf.acts : [];
    const totalActs = acts.length ? Math.min(8, Math.max(5, acts.length)) : 7;
    const actNames = acts.length
      ? acts.slice(0, totalActs).map((a: any) => a?.name || '')
      : (en ? ['Opening', 'Investigate', 'Relationships', 'Key Evidence', 'Discussion', 'Accusation', 'Reveal'] : ['案件开场', '搜证', '人物关系', '关键证据', '推理讨论', '最终指认', '真相揭晓']);

    await admin.from('rooms').update({
      game_state: 'playing', jbs_phase: 'playing', jbs_act: 1, modules_generating: false, jbs_type: cf.type || chosen.type || '推理',
      jbs_act_minutes: actMin, jbs_act_started_at: new Date().toISOString(),
      jbs_total_acts: totalActs, jbs_act_names: actNames,
    }).eq('id', roomId);

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    await admin.from('rooms').update({ jbs_phase: 'script', modules_generating: false }).eq('id', roomId);
    await admin.from('error_logs').insert({ room_id: roomId, scope: 'llm', message: '剧本杀开本:' + e.message });
    return NextResponse.json({ error: '开本失败：' + e.message }, { status: 500 });
  }
}
