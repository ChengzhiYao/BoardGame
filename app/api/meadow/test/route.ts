// 童话草原 · 人格测试结算 → 掷物种 → LLM 解读 → 落库出生（一号一命）。
import { NextResponse } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';
import { callLLMJson } from '@/lib/llm';
import { scoreTest } from '@/lib/meadow/persona';
import { buildAnimalRevealPrompt } from '@/lib/meadow/prompt';
import { SP_BY_KEY } from '@/lib/meadow/data';
import { gameClock } from '@/lib/meadow/time';

export const maxDuration = 60;

export async function POST(req: Request) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: '请先登录' }, { status: 401 });
  const admin = createAdminClient();

  const { data: existing } = await admin.from('meadow_characters').select('id').eq('user_id', user.id).eq('status', 'alive').maybeSingle();
  if (existing) return NextResponse.json({ error: '你已经有一只在世的动物了', existing: true }, { status: 409 });

  const { answers, notable } = await req.json().catch(() => ({} as any));
  if (!Array.isArray(answers)) return NextResponse.json({ error: '缺少答案' }, { status: 400 });

  const result = scoreTest(answers.map((x: any) => (x === null || x === undefined ? null : Number(x))));
  let reveal = '';
  try {
    const { data } = await callLLMJson<any>({
      system: buildAnimalRevealPrompt(result, Array.isArray(notable) ? notable.slice(0, 5) : []),
      messages: [{ role: 'user', content: '请揭晓。' }],
      tier: 'main', temperature: 0.8, maxTokens: 500,
    });
    reveal = data.verdict || '';
  } catch { /* 解读失败用兜底 */ }

  const sp = SP_BY_KEY[result.speciesKey];
  const { data: ch, error } = await admin.from('meadow_characters').insert({
    user_id: user.id, species: result.speciesKey, diet: result.diet,
    attributes: result.attributes, instincts: result.instincts, personality: result.personality,
    traits: result.traits, hunger: 0, location: 'meadow', status: 'alive',
  }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await admin.from('meadow_events').insert({ character_id: ch.id, game_label: gameClock().label, kind: 'birth', text: `一只${sp.zh}睁开了眼睛，来到了草原。` });

  return NextResponse.json({ ok: true, result, reveal, species: { key: sp.key, zh: sp.zh, en: sp.en, emoji: sp.emoji, diet: sp.diet } });
}
