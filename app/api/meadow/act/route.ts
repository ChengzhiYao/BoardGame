// 童话草原 · D&D 式回合：玩家自然语言描述行动 → LLM 当 DM 裁定并叙事 + 应用机制后果。
import { NextResponse } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';
import { callLLMJson } from '@/lib/llm';
import { gameClock, advanceHunger, clamp01, TIME_SCALE } from '@/lib/meadow/time';
import { locZh, locOf, dangerLabel, LOCATIONS, ACTIONS, actionDuration } from '@/lib/meadow/world';
import { buildMeadowTurnPrompt } from '@/lib/meadow/prompt';

export const maxDuration = 60;

function inferKind(text: string): 'forage' | 'hunt' | 'rest' | 'move' {
  if (/(猎|捕|伏击|扑|追|咬|杀|尾随|猎物|偷袭)/.test(text)) return 'hunt';
  if (/(迁徙|前往|动身|走向|游到|爬上|赶往)/.test(text)) return 'move';
  if (/(休息|歇|躲|睡|藏|蹲守|观察|警觉|养神)/.test(text)) return 'rest';
  return 'forage';
}

export async function POST(req: Request) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });
  const { text } = await req.json().catch(() => ({} as any));
  if (!text || !String(text).trim()) return NextResponse.json({ error: '说点什么吧' }, { status: 400 });

  const admin = createAdminClient();
  const { data: ch } = await admin.from('meadow_characters').select('*').eq('user_id', user.id).eq('status', 'alive').maybeSingle();
  if (!ch) return NextResponse.json({ error: '你没有在世的动物' }, { status: 404 });

  const now = Date.now();
  if (ch.busy_until && new Date(ch.busy_until).getTime() > now) {
    const remain = Math.ceil((new Date(ch.busy_until).getTime() - now) / 1000);
    return NextResponse.json({ error: `还在${ch.current_action || '行动'}中，再等约 ${remain} 秒`, busy_until: ch.busy_until, current_action: ch.current_action }, { status: 429 });
  }
  let hunger = advanceHunger(ch.hunger, now - new Date(ch.hunger_updated_at).getTime());
  const clk = gameClock(now);
  const lc = locOf(ch.location);
  const action = String(text).trim().slice(0, 300);
  const kind = inferKind(action);
  const busyUntilISO = new Date(now + Math.round(actionDuration(ch, kind) / TIME_SCALE) * 1000).toISOString();
  const actionZh = ACTIONS[kind].zh;

  const { data: recentEv } = await admin.from('meadow_events').select('text').eq('character_id', ch.id).order('created_at', { ascending: false }).limit(6);
  const recent = (recentEv || []).map((e: any) => e.text).reverse().join(' / ');

  await admin.from('meadow_events').insert({ character_id: ch.id, game_label: clk.label, kind: 'player', text: '» ' + action });

  let narration = ''; let status = ch.status; let death = ch.death_cause; let location = ch.location;
  try {
    const { data, usage } = await callLLMJson<any>({
      system: buildMeadowTurnPrompt({ ...ch, hunger: Math.round(hunger) }, { locationZh: locZh(ch.location), danger: dangerLabel(lc.exposure), clock: clk.label, recent }, action),
      messages: [{ role: 'user', content: action }],
      tier: 'main', temperature: 0.8, maxTokens: 500,
    });
    narration = data.narration || '';
    hunger = clamp01(hunger + Math.max(-60, Math.min(60, Number(data.hunger_delta) || 0)));
    if (data.moved_to && LOCATIONS.find((l) => l.key === data.moved_to)) location = data.moved_to;
    if (data.death === true) { status = 'dead'; death = data.death_cause || '死了'; }
    await admin.from('api_usage').insert({ room_id: null, kind: 'llm_main', model: usage.model, prompt_tokens: usage.promptTokens, completion_tokens: usage.completionTokens, latency_ms: usage.latencyMs });
  } catch {
    narration = '（草原一阵恍惚……再试一次吧。）';
  }

  if (hunger >= 100 && status === 'alive') { status = 'dead'; death = '饿死'; }
  if (narration) await admin.from('meadow_events').insert({ character_id: ch.id, game_label: clk.label, kind: 'narration', text: narration });
  if (status === 'dead' && death) await admin.from('meadow_events').insert({ character_id: ch.id, game_label: clk.label, kind: 'death', text: '——' + death + '。这一世，到此为止。' });

  await admin.from('meadow_characters').update({
    hunger: Math.round(hunger), hunger_updated_at: new Date(now).toISOString(),
    location, status, death_cause: death,
    busy_until: status === 'alive' ? busyUntilISO : null,
    current_action: status === 'alive' ? actionZh : null,
  }).eq('id', ch.id);

  return NextResponse.json({ ok: true, narration, dead: status === 'dead', death_cause: death, busy_until: status === 'alive' ? busyUntilISO : null, current_action: status === 'alive' ? actionZh : null });
}
