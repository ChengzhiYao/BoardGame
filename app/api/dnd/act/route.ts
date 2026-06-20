// D&D · 探索行动：玩家自由声明 → AI DM 裁定为检定/社交/战斗/休整 → 引擎确定性结算。
import { NextResponse } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';
import { callLLMJson } from '@/lib/llm';
import { skillCheck, startCombat, shortRest, longRest, sanitizeMonsters, clampInt, pushLog, endAdventure, RACES, CLASSES, SKILLS } from '@/lib/dnd/engine';
import { loadState, mutateState } from '@/lib/dnd/db';
import { buildDndActPrompt } from '@/lib/dnd/prompt';
import { langDirective } from '@/lib/i18n';

export const maxDuration = 60;

export async function POST(req: Request) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });
  const { roomId, action } = await req.json().catch(() => ({} as any));
  if (!roomId || !action || !String(action).trim()) return NextResponse.json({ error: '缺少行动描述' }, { status: 400 });

  const admin = createAdminClient();
  const { data: room } = await admin.from('rooms').select('language').eq('id', roomId).maybeSingle();
  const { data: me } = await admin.from('players').select('seat').eq('room_id', roomId).eq('user_id', user.id).maybeSingle();
  if (!me) return NextResponse.json({ error: '你不在这个房间' }, { status: 403 });

  const s0 = await loadState(admin, roomId);
  if (!s0) return NextResponse.json({ error: '冒险未开始' }, { status: 409 });
  if (s0.phase !== 'explore' || s0.combat?.active) return NextResponse.json({ error: '现在不能自由行动（战斗中请用战斗按钮）' }, { status: 409 });
  const char = s0.chars[me.seat];
  if (!char) return NextResponse.json({ error: '请先创建你的角色' }, { status: 409 });

  const party = s0.seats.map((seat) => { const c = s0.chars[seat]; return c ? `${seat}·${c.name}(${RACES[c.race]?.cn}${CLASSES[c.cls]?.cn} Lv${c.level})` : null; }).filter(Boolean).join('；');
  const recent = s0.log.slice(-6).map((l) => l.msg).join('\n');

  let adj: any;
  try {
    const { data, usage } = await callLLMJson<any>({
      system: buildDndActPrompt(s0.scene, s0.quest, party, recent, char.name, String(action).slice(0, 300), room?.language) + langDirective(room?.language),
      messages: [{ role: 'user', content: '裁定该行动。' }], tier: 'main', temperature: 0.7, maxTokens: 700,
    });
    adj = data;
    await admin.from('api_usage').insert({ room_id: roomId, kind: 'llm_main', model: usage.model, prompt_tokens: usage.promptTokens, completion_tokens: usage.completionTokens, latency_ms: usage.latencyMs });
  } catch (e: any) {
    return NextResponse.json({ error: 'DM 卡住了：' + e.message }, { status: 500 });
  }

  const out = await mutateState(admin, roomId, (s) => {
    const c = s.chars[me.seat]; if (!c) return { ok: false, error: '无角色' };
    if (s.phase !== 'explore' || s.combat?.active) return { ok: false, error: '状态已变化' };
    pushLog(s, `🗨️ ${c.name}：${String(action).slice(0, 300)}`, 'act');
    if (typeof adj?.safe === 'boolean') s.safe = adj.safe;
    if (adj?.scene_update) s.scene = String(adj.scene_update).slice(0, 80);
    if (adj?.quest_update) s.quest = String(adj.quest_update).slice(0, 120);
    const kind = adj?.kind;
    if (kind === 'check') {
      const skill = SKILLS[adj.skill] ? adj.skill : 'perception';
      const res = skillCheck(c, skill, clampInt(adj.dc, 5, 25, 12));
      pushLog(s, `🎲 ${c.name} ${SKILLS[skill].cn}检定：d20(${res.roll})+${res.bonus}=${res.total} vs DC${res.dc} → ${res.success ? '成功' : '失败'}${res.crit ? '（自然20）' : res.fumble ? '（自然1）' : ''}`, 'roll');
      pushLog(s, (res.success ? adj.success : adj.fail) || (res.success ? '你成功了。' : '你失败了。'), 'dm');
    } else if (kind === 'combat') {
      pushLog(s, adj.narration || '敌人扑了上来！', 'dm');
      const monsters = sanitizeMonsters(adj.monsters);
      if (monsters.length) { startCombat(s, monsters, !!adj.boss); if (adj.env && s.combat) s.combat.env = String(adj.env).slice(0, 60); }
    } else if (kind === 'rest') {
      pushLog(s, adj.narration || '你们停下休整。', 'dm');
      if (adj.rest === 'long') longRest(s); else shortRest(s);
    } else if (kind === 'end') {
      if (adj.narration) pushLog(s, adj.narration, 'dm');
      endAdventure(s, adj.epilogue || adj.narration || '', adj.victory !== false);
    } else {
      pushLog(s, adj.narration || '……', 'dm');
    }
    return { ok: true };
  });
  if (!out.ok) return NextResponse.json({ error: out.error }, { status: 409 });
  return NextResponse.json({ ok: true });
}
