// 童话草原 · 人格测试结算：算分 → 掷物种 → LLM 揭晓解读。MVP：暂不落库。
import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { callLLMJson } from '@/lib/llm';
import { scoreTest } from '@/lib/meadow/persona';
import { buildAnimalRevealPrompt } from '@/lib/meadow/prompt';
import { SP_BY_KEY } from '@/lib/meadow/data';

export const maxDuration = 60;

export async function POST(req: Request) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: '请先登录' }, { status: 401 });

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
  } catch { /* 解读失败不阻断，前端用兜底文案 */ }

  const sp = SP_BY_KEY[result.speciesKey];
  return NextResponse.json({
    ok: true, result, reveal,
    species: { key: sp.key, zh: sp.zh, en: sp.en, emoji: sp.emoji, diet: sp.diet },
  });
}
