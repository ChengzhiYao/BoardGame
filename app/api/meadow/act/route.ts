// 童话草原 · D&D 式回合：玩家自然语言描述行动 → LLM 当 DM 裁定并叙事 + 应用机制后果。
import { NextResponse } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';
import { callLLMJson } from '@/lib/llm';
import { gameClock, advanceHunger, clamp01 } from '@/lib/meadow/time';
import { locZh, locOf, dangerLabel, LOCATIONS } from '@/lib/meadow/world';
import { buildMeadowTurnPrompt } from '@/lib/meadow/prompt';

export const maxDuration = 60;

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
  let hunger = advanceHunger(ch.hunger, now - new Date(ch.hunger_updated_at).getTime());
  const clk = gameClock(now);
  const lc = locOf(ch.location);
  const action = String(text).trim().slice(0, 300);

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
    location, status, death_cause: death, busy_until: null, current_action: null,
  }).eq('id', ch.id);

  return NextResponse.json({ ok: true, narration, dead: status === 'dead', death_cause: death });
}
