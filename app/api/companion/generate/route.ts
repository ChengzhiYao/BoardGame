import { NextResponse } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';
import { ensureCompanion } from '@/lib/companion/engine';
import { callLLMJson } from '@/lib/llm';
import { QUIZ } from '@/lib/companion/quiz';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.is_anonymous || !user.email) return NextResponse.json({ ok: false }, { status: 401 });
  const b = await req.json().catch(() => ({} as any));
  const answers = b?.answers || {};
  const freeText = (b?.freeText || '').toString().slice(0, 300);
  const lang: 'zh' | 'en' = b?.lang === 'en' ? 'en' : 'zh';
  const admin = createAdminClient();
  await ensureCompanion(admin, user.id);

  // 把答案翻成可读文本喂模型
  const lines = QUIZ.map((q) => {
    const pick = answers[q.id]; const opt = q.opts.find((o) => o.key === pick);
    return `- ${lang === 'en' ? q.en : q.zh} → ${opt ? (lang === 'en' ? opt.en : opt.zh) : '(skipped)'}`;
  }).join('\n');

  const sys = lang === 'en'
    ? `You design a believable AI companion (a real-feeling person) for a user, based on an indirect preference quiz. Don't give them exactly what they'd pick — design the best MATCH with a little intrigue/complement, so it feels discovered, not ordered. Decide: a name, a vivid personality (incl. speech habits, clinginess, relationship style, a hint of their own dreams/past), and a concrete JOB. Output ONLY JSON: {"aiName": string, "persona": string (2-4 sentences, second person: "你是…"), "job": string, "opening": string (their very first text to the user, in character, short & natural)}.`
    : `你要根据一份"隐晦偏好测验"为用户设计一个可信的 AI 伴侣(像个真实的人)。不要原样给 TA 想要的——设计一个最"配"但带点意外/互补的,让人觉得是"遇到"而非"下单"。你来定:名字、鲜活的性格(含说话习惯、黏人程度、相处方式、以及 TA 自己的一点梦想/过往的暗示)、以及一个**具体职业**。只输出 JSON:{"aiName": 字符串, "persona": 字符串(2~4 句,第二人称"你是…"), "job": 字符串, "opening": 字符串(TA 发给用户的第一条消息,带人设、简短自然)}。`;
  const usr = (lang === 'en' ? `Quiz answers:\n${lines}\n` : `测验答案:\n${lines}\n`) + (freeText ? (lang === 'en' ? `\nSomething they're into / a secret dream: ${freeText}` : `\nTA 最近着迷的东西 / 偷偷的梦想:${freeText}`) : '');

  let gen: any;
  try {
    const { data } = await callLLMJson<any>({ system: sys, messages: [{ role: 'user', content: usr }], tier: 'main', temperature: 1.0, maxTokens: 500, provider: 'deepseek' });
    gen = data;
  } catch {
    return NextResponse.json({ ok: false, reason: 'gen_failed' }, { status: 500 });
  }
  const aiName = String(gen.aiName || (lang === 'en' ? 'Sol' : '夜')).slice(0, 24);
  const persona = String(gen.persona || '').slice(0, 2000);
  const job = String(gen.job || '').slice(0, 500);
  const opening = String(gen.opening || '').slice(0, 500);

  await admin.from('companion').update({ ai_name: aiName, persona, job }).eq('user_id', user.id);
  if (opening) {
    await admin.from('companion_msgs').insert({ user_id: user.id, role: 'ai', text: opening });
    await admin.from('companion').update({ last_ai_at: new Date().toISOString(), last_proactive: new Date().toISOString() }).eq('user_id', user.id);
  }
  return NextResponse.json({ ok: true, aiName, persona, job, opening });
}
