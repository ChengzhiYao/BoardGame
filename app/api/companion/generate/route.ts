import { NextResponse } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';
import { ensureCompanion, isAllowed } from '@/lib/companion/engine';
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
  const gRaw = b?.gender === 'm' ? 'm' : b?.gender === 'any' ? (Math.random() < 0.5 ? 'f' : 'm') : 'f';
  const genderZh = gRaw === 'm' ? '男' : '女';
  const lang: 'zh' | 'en' = b?.lang === 'en' ? 'en' : 'zh';
  const admin = createAdminClient();
  if (!(await isAllowed(admin, user))) return NextResponse.json({ ok: false, reason: 'not_allowed' }, { status: 403 });
  await ensureCompanion(admin, user.id);

  // 把答案翻成可读文本喂模型
  const lines = QUIZ.map((q) => {
    const pick = answers[q.id]; const opt = q.opts.find((o) => o.key === pick);
    return `- ${lang === 'en' ? q.en : q.zh} → ${opt ? (lang === 'en' ? opt.en : opt.zh) : '(skipped)'}`;
  }).join('\n');

  const rnd = <T,>(a: T[]): T => a[Math.floor(Math.random() * a.length)];
  // 名字风格由代码随机定,不让模型自己套"阿X+对应emoji"的模板
  const NAME_STYLES = [
    { k: '英文名', d: '随手起的英文名,大小写随意,像 vivian / Cici / ellie / Joey / Ivy(不要照抄这些)' },
    { k: '叠字小名', d: '叠字或口头小名,像 momo / 七七 / 糖糖 / 啾啾(不要照抄)' },
    { k: '随口网名短语', d: '一句随口的网名短语,像"不想上班""今天也没睡醒""晚安玛卡巴卡""周五快来"(不要照抄)' },
    { k: '日文', d: '日文假名或罗马音昵称,像 ゆき / Aoi / ちー / Rin(不要照抄)' },
    { k: '法语或小语种', d: '法语/其它小语种名,像 Léa / Margaux / Noa / Elodie(不要照抄)' },
    { k: '字母或拼音缩写', d: '拼音缩写或字母组合,可带下划线或数字,像 lxy_ / Q / yy0812 / Lin.(不要照抄)' },
    { k: '单字或两字中文', d: '一两个普通的中文字,像 林 / 鱼 / 小周 / 一一(不要照抄)' },
    { k: '文艺短词', d: '有点文艺的短词,像 晚风 / 雾岛 / 不眠 / 山野(不要照抄)' },
  ];
  const ns = rnd(NAME_STYLES);

  const sys = lang === 'en'
    ? `The companion is a young ${gRaw === 'm' ? 'man' : 'woman'} in their 20s. You design a believable AI companion (a real-feeling person) for a user, based on an indirect preference quiz. Don't give them exactly what they'd pick — design the best MATCH with a little intrigue/complement, so it feels discovered, not ordered. Decide: a name, a vivid personality (incl. speech habits, clinginess, relationship style, a hint of their own dreams/past), and a concrete JOB. Output ONLY JSON: {"aiName": string, "persona": string (2-4 sentences, second person: "你是…"), "job": string}. The name must be a casual handle with no emoji.`
    : `你要根据一份"隐晦偏好测验"为用户设计一个可信的 AI 伴侣(像个真实的人)。不要原样给 TA 想要的——设计一个最"配"但带点意外/互补的,让人觉得是"遇到"而非"下单"。
【性别】这次 TA 是**${genderZh}生**(20 多岁的年轻人),名字、性格、说话方式都要符合。
【名字·重要】aiName 是 TA 的微信昵称,不是真名。这次的昵称风格:**${ns.k}**——${ns.d}。aiName 里**不要放任何 emoji 或符号**,也不要用"阿X""小X"这种套路。真名藏进 persona,熟了被问起才说。
【性格·重要】刚认识时 TA 跟用户还不熟:有距离感、不会主动热情、不会一上来就分享一大堆或约见面,慢慢熟了才放开。
你来定:名字(网名式)、鲜活的性格(含说话习惯、黏人程度、相处方式、真名及 TA 自己的一点梦想/过往)、以及一个**具体职业**。只输出 JSON:{"aiName": 字符串(按上面指定风格,不带 emoji/符号), "persona": 字符串(2~4 句,第二人称"你是…",里面写上 TA 的真名但注明"熟了才说"), "job": 字符串}。`;
  const usr = (lang === 'en' ? `Quiz answers:\n${lines}\n` : `测验答案:\n${lines}\n`) + (freeText ? (lang === 'en' ? `\nSomething they're into / a secret dream: ${freeText}` : `\nTA 最近着迷的东西 / 偷偷的梦想:${freeText}`) : '');

  let gen: any;
  try {
    const { data } = await callLLMJson<any>({ system: sys, messages: [{ role: 'user', content: usr }], tier: 'main', temperature: 1.0, maxTokens: 500, provider: 'deepseek' });
    gen = data;
  } catch {
    return NextResponse.json({ ok: false, reason: 'gen_failed' }, { status: 500 });
  }
  // 去掉模型塞进名字里的 emoji/符号,再由代码决定要不要加一点点装饰(大多数人不加)
  let baseName = String(gen.aiName || (lang === 'en' ? 'Sol' : '林')).replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}]/gu, '').replace(/[~～·•✧★☆♡♥]+/g, '').trim().slice(0, 20) || '林';
  const decoR = Math.random();
  const deco = decoR < 0.62 ? '' : decoR < 0.74 ? rnd(['.', '。', '_', '-']) : decoR < 0.84 ? rnd(['ゞ', 'ˊ', '゜', '⁰']) : rnd(['🫧', '🌙', '☁️', '🐾', '🍃', '✨']); // 装饰跟名字意思无关
  const aiName = (baseName + deco).slice(0, 24);
  const persona = (`【性别】${genderZh}\n` + String(gen.persona || '')).slice(0, 2000);
  const job = String(gen.job || '').slice(0, 500);

  // 开场白不让模型写(它总写得像在推销)。像真人刚加好友:大多数时候不说话等你先开口,要么就一句很短的
  const r = Math.random();
  const opening = lang === 'en'
    ? (r < 0.5 ? '' : rnd(['hi', 'hey', 'hello', '?', '👋', 'who is this']))
    : (r < 0.45 ? '' : r < 0.6 ? '我通过了你的朋友验证请求,现在我们可以开始聊天了' : rnd(['你好', 'hi', '嗨', '？', '👋', '你好呀', '你是？', 'hello', '在']));

  await admin.from('companion').update({ ai_name: aiName, persona, job, affection: 8 }).eq('user_id', user.id);
  if (opening) {
    await admin.from('companion_msgs').insert({ user_id: user.id, role: 'ai', text: opening });
    await admin.from('companion').update({ last_ai_at: new Date().toISOString(), last_proactive: new Date().toISOString() }).eq('user_id', user.id);
  }
  return NextResponse.json({ ok: true, aiName, persona, job, opening });
}
