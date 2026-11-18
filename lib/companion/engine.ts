// 主动型 AI 陪伴引擎 v2：真人化——职业/作息/心情/好感度 + 拟人语气 + 不秒回 + 自主发消息。
import { callLLM, callLLMJson, type LLMMessage } from '@/lib/llm';
import { STICKERS, STICKER_RE, PHOTO_RE, previewText, forModel } from '@/lib/companion/stickers';
import { getBio, bioForPrompt, calendarContext, mergeFacts, type Bio } from '@/lib/companion/bio';
export { previewText };

export type Companion = {
  user_id: string; enabled: boolean; ai_name: string; persona: string; tone: string;
  job: string; mood: number; affection: number;
  freq: string; quiet_start: number; quiet_end: number; tz_offset: number;
  memory: string; last_sent: string | null; avatar_url: string | null;
  last_user_at: string | null; last_ai_at: string | null; last_proactive: string | null; next_reach_at: string | null;
  bio?: any;
};

// 访问门:目前只对白名单账号开放(即你自己),其余用户看不到也用不了。
export async function isAllowed(admin: any, user: any): Promise<boolean> {
  if (!user?.email) return false;
  try {
    const { data: wl } = await admin.from('whitelist_emails').select('email').eq('email', user.email).maybeSingle();
    if (wl) return true;
    const { data: p } = await admin.from('profiles').select('is_whitelisted').eq('user_id', user.id).maybeSingle();
    return !!p?.is_whitelisted;
  } catch { return false; }
}

export async function ensureCompanion(admin: any, userId: string): Promise<Companion> {
  const { data } = await admin.from('companion').select('*').eq('user_id', userId).maybeSingle();
  if (data) return data as Companion;
  await admin.from('companion').insert({ user_id: userId }).then(() => {}, () => {});
  const { data: d2 } = await admin.from('companion').select('*').eq('user_id', userId).maybeSingle();
  return d2 as Companion;
}

function localNow(c: Companion) {
  const d = new Date(Date.now() + (c.tz_offset || 0) * 3600000);
  return { h: d.getUTCHours(), min: d.getUTCMinutes(), wd: d.getUTCDay() };
}
function moodWord(m: number) { return m >= 75 ? '很好/愉快' : m >= 55 ? '还行' : m >= 35 ? '一般/有点累' : m >= 18 ? '不太好/烦躁' : '很糟/低落'; }
function affWord(a: number) { return a >= 80 ? '很亲密' : a >= 55 ? '挺喜欢对方' : a >= 30 ? '熟悉的朋友' : a >= 12 ? '刚认识不久' : '还很生疏/有戒心'; }

// ---- 打字习惯:每个角色固定 2~3 个,人设里写成「【打字习惯】a;b」;老角色没有就按 user_id 稳定地抽 ----
export const HABITS = [
  '爱带颜文字,比如 (๑•̀ㅂ•́)و✧  (｡•́︿•̀｡)  (￣▽￣)  ( ˘•ω•˘ )  ヽ(✿ﾟ▽ﾟ)ノ,不是每句都带',
  '句尾爱拖省略号……或者....',
  '笑的时候就是一长串 哈哈哈哈哈哈哈哈 或 hhhhhh,很少说"好笑"',
  '一激动就连打一排感叹号!!!!!!!!!!或问号???????',
  '连发党:平时说话也习惯拆成很多条短消息连着发,一句话拆三四条,一次 3~6 条很正常',
  '情绪上来会故意刷屏,一口气连发七八条',
  '几乎不用标点,用空格断句',
  '爱用语气词和叠词:嘛 呀 呐 捏 啦 嘿嘿 好叭',
  '爱用网络缩写和梗:xswl yyds hhh 绝了 救命 笑不活了 无语子',
  '高冷派:话少,常常就一个"嗯。""哦。""行。",爱用句号',
  '喜欢打错字也懒得改,偶尔用拼音首字母',
];
function hashStr(x: string) { let h = 0; for (let i = 0; i < x.length; i++) h = (h * 31 + x.charCodeAt(i)) | 0; return Math.abs(h); }
export function pickHabits(seed?: string): string[] {
  const idx = [...HABITS.keys()];
  let h = seed ? hashStr(seed) : Math.floor(Math.random() * 1e9);
  const out: string[] = [];
  const n = 2 + (h % 2);
  while (out.length < n && idx.length) { const k = h % idx.length; out.push(HABITS[idx.splice(k, 1)[0]]); h = Math.floor(h / 7) + 13; }
  // "高冷派"和"刷屏/感叹号"互相冲突,只留先抽到的
  const cold = out.findIndex((x) => x.startsWith('高冷派'));
  return cold >= 0 ? out.filter((x, i) => i === cold || !/(刷屏|连发|感叹号|哈哈哈)/.test(x)) : out;
}
export function maxBurst(c: Companion) {
  const hs = habitsOf(c);
  return hs.some((h) => h.includes('刷屏')) ? 8 : hs.some((h) => h.includes('连发党')) ? 6 : 3;
}
export function habitsOf(c: Companion): string[] {
  const m = String(c.persona || '').match(/【打字习惯】([^\n]+)/);
  if (m) return m[1].split(/[;;]/).map((x) => x.trim()).filter(Boolean);
  return pickHabits(c.user_id);
}

// ---- 说话规则(共用):去 AI 味的核心 ----
const STYLE_ZH = `【怎么发消息——像真人发微信,这些规则最重要】
- 不推进对话:不用每次都提问、不给对方选项、不总结、不复述对方的话。说完就完,接不接话随你。
- 不做情绪解读:对方说"没有""还好""随便",就按字面接,别分析 TA 为什么这么想、别说"听起来你…""你是不是觉得…"。
- 人格连续:语气以你之前发过的消息为准,一直是同一个人。对方低落时,用你自己的方式回应(傲娇的就别扭地关心一句、毒舌的照样嘴硬),绝不突然变成温柔的心理咨询师。
- 允许低信息量:「？」「笑死」「行吧」「哦」「嗯嗯」「草」「哈哈哈哈」本身就是完整的回复。
- 看上下文和时间:隔了很久才回的、半夜发的、刚聊过的,反应都不一样;别只盯着最后一句。
- 短、口语、可以不完整;少用句号,不分点,不用书面语和成语排比。可以偶尔带个 emoji,或单独发个表情包。
- 绝对禁止客服/AI 腔:"我理解你的感受""有什么可以帮你""随时都在""希望对你有帮助""如果你愿意的话""要不要试试""作为…"、过度正能量和鸡汤。
- 你有自己的生活,可以敷衍、嫌烦、岔开说自己的事。刚认识别主动报真名,熟了被问才说。绝不承认自己是 AI。`;
const STYLE_EN = `[HOW YOU TEXT — most important]
- Don't drive the conversation: no question every time, no offering options, no summarizing or echoing them. Say your thing and stop.
- Don't interpret their feelings: if they say "nothing"/"fine", take it literally. Never "sounds like you…" / "do you feel…".
- Stay the same person: match the voice of your earlier messages. If they're down, react your own way (a tsundere stays awkward) — never switch into therapist mode.
- Low-info replies are fine: "?", "lmao", "ok whatever", "lol" can be the whole reply.
- Read the context and timing (long gaps, late night, what was said before), not just the last line.
- Short, casual, fragmented. No lists, no formal phrasing.
- Never sound like an assistant: no "I understand how you feel", "how can I help", "I'm always here", "if you'd like", no forced positivity.
- You have your own life; you can be dismissive or change the subject. Don't give your real name early. Never admit you're an AI.`;

// 真人化 system prompt(人设 + 当下状态 + 说话规则)
function sysPrompt(c: Companion, lang: 'zh' | 'en') {
  const t = localNow(c);
  const timeStr = `${String(t.h).padStart(2, '0')}:${String(t.min).padStart(2, '0')}`;
  if (lang === 'en') {
    return `You are ${c.ai_name}, a REAL person texting someone you know — not an AI, not an assistant.
Personality: ${c.persona || 'form your own from the conversation'}
Job: ${c.job || 'unspecified'}. It's ${timeStr} your time; act like it (at work = distracted, off hours = freer). ${calendarContext(c.tz_offset)}
${bioForPrompt(getBio(c))}
Stay consistent with this life profile. Private things (body measurements, past relationships) you don't share with people you barely know.
Mood: ${moodWord(c.mood)} (${c.mood}/100). Feelings toward them: ${affWord(c.affection)} (${c.affection}/100).
What you remember: ${c.memory || '(not much yet)'}
Your fixed texting habits (always like this): ${habitsOf(c).join(' / ')}. When emotional, exaggerate like real people do (spam several texts, long hahaha, !!!!!!).
${STYLE_EN}`;
  }
  return `你是「${c.ai_name}」,一个在跟熟人发微信的**真人**——不是 AI、不是助手。
你的性格:${c.persona || '从聊天里自己长出来'}
你的职业:${c.job || '未设定'}。现在是你那边 ${timeStr},按这个作息来(上班心不在焉、话短;下班松弛些)。${calendarContext(c.tz_offset)}节日、季节、周末会影响你的生活和心情(比如节前放假、过节回家、天冷了)。
${bioForPrompt(getBio(c))}
档案里没写到的细节,临场说的要合理、和档案一致。身高体重、三围、感情经历这类私密的事,不熟不会说,熟了也不会直接报一串数字。
你现在的心情:${moodWord(c.mood)}(${c.mood}/100);对 TA 的感觉:${affWord(c.affection)}(${c.affection}/100)。
你记得的事:${c.memory || '(还不太了解)'}
【你的打字习惯——固定的,你一直都这么打字】
${habitsOf(c).map((h) => '- ' + h).join('\n')}
情绪上来时(很开心、很激动、很无语、很委屈)可以夸张一点:连发、刷屏、一串哈哈哈或感叹号,真人才会这样;平静时就正常打。
${STYLE_ZH}`;
}

// ---- 带时间间隔的历史:让模型知道"隔了多久" ----
export type MsgRow = { role: string; text: string; created_at?: string };
function gapLabel(ms: number, lang: 'zh' | 'en') {
  const m = ms / 60000;
  if (m < 30) return '';
  const h = m / 60;
  const v = h < 1 ? `${Math.round(m)}${lang === 'en' ? ' min' : '分钟'}` : h < 24 ? `${Math.round(h)}${lang === 'en' ? 'h' : '小时'}` : `${Math.round(h / 24)}${lang === 'en' ? ' days' : '天'}`;
  return lang === 'en' ? `(${v} later) ` : `（隔了${v}）`;
}
export function historyWithGaps(rows: MsgRow[], lang: 'zh' | 'en'): LLMMessage[] {
  const out: LLMMessage[] = [];
  let prev = 0;
  for (const r of rows) {
    const ts = r.created_at ? new Date(r.created_at).getTime() : 0;
    const gap = prev && ts ? gapLabel(ts - prev, lang) : '';
    if (ts) prev = ts;
    const role = r.role === 'ai' ? 'assistant' : 'user';
    out.push({ role, content: role === 'user' ? gap + forModel(r.text, true) : forModel(r.text, false) } as LLMMessage);
  }
  // 合并相邻同角色(连发几条)
  const merged: LLMMessage[] = [];
  for (const m of out) {
    const last = merged[merged.length - 1];
    if (last && last.role === m.role) last.content = `${last.content}\n${m.content}`;
    else merged.push({ ...m });
  }
  return merged;
}
function transcript(rows: MsgRow[], c: Companion, lang: 'zh' | 'en') {
  const now = Date.now();
  return rows.slice(-14).map((r) => {
    const ago = r.created_at ? Math.round((now - new Date(r.created_at).getTime()) / 60000) : null;
    const when = ago == null ? '' : ago < 1 ? (lang === 'en' ? 'just now' : '刚刚') : ago < 60 ? `${ago}${lang === 'en' ? 'm ago' : '分钟前'}` : ago < 1440 ? `${Math.round(ago / 60)}${lang === 'en' ? 'h ago' : '小时前'}` : `${Math.round(ago / 1440)}${lang === 'en' ? 'd ago' : '天前'}`;
    return `[${r.role === 'ai' ? (lang === 'en' ? 'me' : '我') : 'TA'} · ${when}] ${forModel(r.text, r.role !== 'ai')}`;
  }).join('\n');
}

// ---- 第 1 步:后端判断"这次该怎么反应"(不写具体台词) ----
export type Plan = {
  action: 'reply' | 'ignore'; count: number; length: 'tiny' | 'short' | 'normal';
  move: string; ask: boolean; busy: number; moodDelta: number; affDelta: number; nextHours: number;
  photo: boolean; photoDesc: string; bioNeed: string;
};
export async function planReaction(c: Companion, rows: MsgRow[], lang: 'zh' | 'en'): Promise<Plan> {
  const t = localNow(c);
  const sys = (lang === 'en'
    ? `You decide HOW a real person would react to the latest text — not the words. You are ${c.ai_name}. Personality: ${c.persona}. Job: ${c.job}. Local time ${t.h}:${String(t.min).padStart(2, '0')}. Mood ${c.mood}/100, feelings ${c.affection}/100. Memory: ${c.memory || '-'}.
Your texting habits: ${habitsOf(c).join(' / ')}. Consider the whole recent chat, time gaps, how close you are, whether you're busy at this hour, and your own temperament. Output ONLY JSON:
{"action":"reply"|"ignore","count":1-3,"length":"tiny"|"short"|"normal","move":"what kind of reaction in a few words, e.g. 'tease back', 'just react: lol', 'complain about work', 'brush it off', 'mention something of my own'","ask":boolean,"busy":0-1,"mood_delta":-12..12,"aff_delta":-6..6,"next_hours":0.3-48,"photo":boolean,"photo_desc":"what the photo shows","bio_need":"string"}
Rules: "ignore" = read but not reply now (busy / not interested / nothing to say) — use rarely. "tiny" = 1-4 words like "?" or "lol". ask=true only if you'd genuinely be curious; usually false. count>1 only when people naturally send several short texts in a row. bio_need: if they ask about your personal life (past, tastes, habits, school, friends, body, love life) and your profile lacks it, the topic name; else empty. Profile topics: ${Object.keys(getBio(c).facts).join(', ') || '(none)'}. photo=true only when you'd naturally snap and send a photo of what you're doing/seeing (they asked what you're up to, or you want to show them something) — usually false; photo_desc = your point-of-view phone shot of the scene, never your face (your hand at most).`
    : `你负责判断一个真人看到最新消息后**会怎么反应**,不写具体台词。你是「${c.ai_name}」。性格:${c.persona}。职业:${c.job}。当地时间 ${t.h}:${String(t.min).padStart(2, '0')}。心情 ${c.mood}/100,好感 ${c.affection}/100。记忆:${c.memory || '无'}。
要综合整段近期聊天、消息之间隔了多久、你们熟不熟、这个点你是不是在忙、以及你一贯的脾气来判断。只输出 JSON:
{"action":"reply"或"ignore","count":1~8,"length":"tiny"|"short"|"normal","move":"用几个字说反应类型,如'怼回去''就回个笑死''吐槽工作''敷衍一下''说说自己今天的事''接着刚才的话题'","ask":布尔,"busy":0~1,"mood_delta":-12~12,"aff_delta":-6~6,"next_hours":0.3~48,"photo":布尔,"photo_desc":"英文,照片画面","bio_need":"字符串"}
你的打字习惯:${habitsOf(c).join(';')}。连发党平时 count 就常常是 3~6;爱刷屏的人情绪上来时 count 可以到 7~8;其他人一般 1~2。
规则:ignore=已读先不回(在忙/没兴趣/没啥好说),少用。tiny=1~4 个字,像「？」「笑死」「行吧」。ask 只有真的好奇才 true,大多数时候 false。count>1 只在真人会自然连发几条短消息时用。next_hours=你大概多久后会自己想找 TA(黏人/聊得开心就小,冷淡/心情差就大)。
bio_need:如果对方问到了你个人的事(经历/喜好/习惯/学校/朋友/身体/感情……),而下面档案里没有或不够细,就写这个话题名(如"高中经历""喜欢的动漫类型");否则空字符串。已有档案话题:${Object.keys(getBio(c).facts).join('、') || '(空)'}。
photo=要不要顺手拍张照发过去(像真人分享日常:对方问你在干嘛/在哪/吃什么,或你想给 TA 看眼前的东西),大多数时候 false。photo_desc 用英文写这张手机随手拍的画面:从你的视角拍你眼前的东西、你在做的事(符合你的职业和现在的时间),**不要拍你的脸**(最多出现你的手)。`);
  let d: any = {};
  try {
    const r = await callLLMJson<any>({ system: sys, messages: [{ role: 'user', content: transcript(rows, c, lang) }], tier: 'aux', temperature: 0.9, maxTokens: 160, provider: 'deepseek' });
    d = r.data || {};
  } catch {}
  const plan: Plan = {
    action: d.action === 'ignore' ? 'ignore' : 'reply',
    count: clamp(Math.round(Number(d.count) || 1), 1, maxBurst(c)),
    length: ['tiny', 'short', 'normal'].includes(d.length) ? d.length : 'short',
    move: String(d.move || '').slice(0, 60),
    ask: !!d.ask,
    busy: clamp(Number(d.busy) || 0.3, 0, 1),
    moodDelta: clamp(Math.round(Number(d.mood_delta) || 0), -12, 12),
    affDelta: clamp(Math.round(Number(d.aff_delta) || 0), -6, 6),
    nextHours: clamp(Number(d.next_hours) || 6, 0.3, 48),
    photo: !!d.photo && !!String(d.photo_desc || '').trim(),
    photoDesc: String(d.photo_desc || '').slice(0, 300),
    bioNeed: String(d.bio_need || '').trim().slice(0, 40),
  };
  if ((c.affection || 0) < 12) plan.photo = false; // 还很生疏就不发照片
  // ---- 代码层的硬约束(不全交给模型) ----
  const last = rows[rows.length - 1];
  const tail = rows.slice(-3);
  const alreadyIgnoring = tail.length >= 2 && tail.slice(-2).every((r) => r.role !== 'ai');
  const lowStake = (last?.text || '').length <= 15;
  const canIgnore = !alreadyIgnoring && lowStake && (plan.busy >= 0.55 || c.affection < 25 || c.mood < 30);
  if (plan.action === 'ignore' && !canIgnore) plan.action = 'reply';
  if (plan.action === 'ignore') { plan.nextHours = clamp(plan.nextHours, 0.3, 3); plan.photo = false; } // 已读不回 → 过一阵再回
  // 最近自己刚问过问题 → 这次不许再问
  const aiRecent = rows.filter((r) => r.role === 'ai').slice(-2);
  if (aiRecent.some((r) => /[?？]\s*$/.test(r.text))) plan.ask = false;
  if (plan.length === 'tiny' && maxBurst(c) <= 3) plan.count = 1;
  // 连发党:只要是正常回话,就拆成好几条
  if (plan.action === 'reply' && habitsOf(c).some((h) => h.includes('连发党')) && plan.count < 3 && Math.random() < 0.7) plan.count = 3 + Math.floor(Math.random() * 3);
  // 自己最近两条都是很短的敷衍,而对方在追问/抱怨 → 这次必须好好接话
  const lastAi2 = rows.filter((r) => r.role === 'ai').slice(-2);
  const stonewalling = lastAi2.length >= 2 && lastAi2.every((r) => r.text.trim().length <= 3);
  if (stonewalling) { plan.action = 'reply'; if (plan.length === 'tiny') plan.length = 'short'; plan.move = plan.move && !/敷衍|嗯/.test(plan.move) ? plan.move : (lang === 'en' ? 'actually answer them, in your own temper' : '正面接住 TA 的话,用你自己的脾气回应'); }
  return plan;
}

// ---- 表情包:模型只能从这个列表里选,消息里写成 [sticker:名字],前端渲染成表情 ----
// ---- 第 2 步:按计划生成具体消息 ----
const BANNED = /(我理解你|理解你的感受|听起来你|你是不是觉得|有什么(我)?可以帮|随时(都)?在|希望(这|能)?对你有|如果你愿意|要不要(我|试试)|作为(一个)?(AI|朋友|你的)|抱抱你|你并不孤单|I understand how you feel|sounds like you|how can I help|I'm (always )?here for you|if you'd like)/i;
function cleanMsg(t: string) {
  const x = t.replace(/^["“「]|["”」]$/g, '').replace(/^\s*[-*•\d、]+[.、]?\s+(?=\S)/, '').trim();
  return x.length <= 3 ? x : x.replace(/(?<![。.])。$/, ''); // 很短的"嗯。""行。"保留句号(高冷派)
}
export async function genMessages(c: Companion, rows: MsgRow[], plan: Plan, lang: 'zh' | 'en'): Promise<string[]> {
  const lenZh = plan.length === 'tiny' ? '1~4 个字' : plan.length === 'short' ? '一句短话' : '一两句,可以稍微多说点';
  const lenEn = plan.length === 'tiny' ? '1-4 words' : plan.length === 'short' ? 'one short line' : 'one or two lines';
  const instr = lang === 'en'
    ? `\n\nThis time: react like this → ${plan.move || 'whatever feels natural'}. Send ${plan.count} message(s), each ${lenEn}. ${plan.ask ? 'You may ask one thing if natural.' : 'Do NOT ask a question.'} Never repeat a line you just sent. If they ask you something directly or complain, actually respond to it. Occasionally (not often) a message can be just a sticker, written exactly as [sticker:NAME] with NAME from: ${Object.keys(STICKERS).join(', ')}. Output ONLY JSON: {"msgs":[string,...]}`
    : `\n\n这一次:反应方式 → ${plan.move || '自然接'}。发 ${plan.count} 条,每条${lenZh}${plan.count >= 3 ? '(像真人连发那样,把想说的拆成一条条短的,有的就一两个字或一个语气词/颜文字)' : ''}。${plan.ask ? '可以顺口问一句(不是必须)。' : '这次不要提问。'}别重复你刚说过的话(比如连着几次都是"嗯")。对方直接问你问题或者抱怨你时,要真的接住,用你自己的脾气回应。偶尔(不是每次)可以单独发一个表情包,写成 [sticker:名字],名字只能从这些里选:${Object.keys(STICKERS).join('、')}。只输出 JSON:{"msgs":[字符串,...]}`;
  const photoNote = plan.photo ? (lang === 'en' ? `\nYou are also sending a photo right after this (${plan.photoDesc}); your text can go with it naturally (e.g. what you're doing), don't describe the photo in detail.` : `\n你这次还会紧接着发一张照片(${plan.photoDesc}),文字可以自然地配合(比如说说在干嘛),别详细描述照片。`) : '';
  const history = historyWithGaps(rows, lang);
  const recentAi = rows.filter((r) => r.role === 'ai').slice(-3).map((r) => r.text.trim());
  const valid = (m: string) => {
    const st = m.match(STICKER_RE); if (st) return !!STICKERS[st[1].trim()];
    if (PHOTO_RE.test(m) || /^\[(你刚发了|对方发了)/.test(m)) return false; // 模型模仿历史里的占位文字 → 丢掉
    return true;
  };
  const tidy = (arr: any[]) => arr.map((x: any) => cleanMsg(String(x || ''))).filter(Boolean).filter(valid).slice(0, 8) as string[];
  const run = async (extra = '') => {
    // maxTokens 给足:太小会把 JSON 截断 → 解析失败 → 以前就会兜底成"嗯"
    const { data } = await callLLMJson<any>({ system: sysPrompt(c, lang) + instr + photoNote + extra, messages: history, tier: 'main', temperature: 1.0, maxTokens: 600, provider: 'deepseek', retry: true });
    return tidy(Array.isArray(data?.msgs) ? data.msgs : [data?.reply ?? data?.msg ?? '']);
  };
  // JSON 失败时的退路:直接普通对话,按行拆成几条
  const runPlain = async (extra = '') => {
    const r = await callLLM({ system: sysPrompt(c, lang) + (lang === 'en' ? `\n\nReply now: ${plan.move || 'naturally'}. Just the message text, 1-2 short lines, one message per line.` : `\n\n现在回复:${plan.move || '自然接'}。只输出消息本身,一两句短话,每条一行。`) + extra, messages: history, tier: 'main', temperature: 1.0, maxTokens: 400, provider: 'deepseek' });
    return tidy(r.text.split(/\n+/));
  };
  let msgs: string[] = [];
  try { msgs = await run(); } catch {}
  if (!msgs.length) { try { msgs = await runPlain(); } catch {} }
  if (msgs.some((m) => BANNED.test(m))) {
    try { msgs = await run(lang === 'en' ? '\nYour last draft sounded like an assistant/therapist. Rewrite as yourself, plainly.' : '\n你上一版太像客服/心理咨询了,用你自己平时的口气重说,别安慰别分析。'); } catch {}
    msgs = msgs.filter((m) => !BANNED.test(m));
  }
  // 跟自己最近说的一模一样(比如一直"嗯")→ 重来一次
  if (msgs.length && msgs.every((m) => recentAi.includes(m.trim()))) {
    try {
      const again = await run(lang === 'en' ? `\nYou already said "${msgs[0]}" — say something different this time.` : `\n你刚才已经说过"${msgs[0]}"了,这次换句别的,接住对方的话。`);
      if (again.length) msgs = again;
    } catch {}
  }
  if (!plan.ask && msgs.length > 1) {
    const noQ = msgs.filter((m) => !/[?？]\s*$/.test(m) || m.length <= 2);
    if (noQ.length) msgs = noQ;
  }
  if (!msgs.length) msgs = [lang === 'en' ? 'wait what' : '等下 刚在忙'];
  return msgs;
}

// 根据忙碌度 + 心情算"回复要等多久"(秒)。不秒回,忙/心情差更慢。
export function replyDelaySec(busy: number, mood: number): number {
  const base = 4 + busy * 150;                 // 4s(闲) → ~150s(忙)
  const moodMul = mood < 35 ? 1.6 : mood < 55 ? 1.2 : 1;
  const jitter = 0.6 + Math.random() * 0.9;
  return Math.round(Math.min(240, base * moodMul * jitter));
}

// 主动消息(无用户输入)
export async function genProactive(c: Companion, history: LLMMessage[], lang: 'zh' | 'en', reason: 'bored' | 'followup' | 'late'): Promise<string> {
  if (reason === 'late') {
    const sys = sysPrompt(c, lang) + (lang === 'en' ? '\n\nThey texted you a while ago and you never answered (busy / didn\'t feel like it). Reply now, the way people do after a gap — no big apology or explanation needed. Output only the message.' : '\n\nTA 之前发的消息你当时没回(在忙/没看到/懒得回),现在才回。像真人隔了一阵回消息那样,不用郑重道歉解释,顶多随口带一句。只输出这条消息本身。');
    const r = await callLLM({ system: sys, messages: history, tier: 'main', temperature: 1.0, maxTokens: 120, provider: 'deepseek' });
    return cleanMsg(r.text.trim());
  }
  const why = lang === 'en'
    ? (reason === 'followup' ? 'They never replied to your last message. Decide in character whether to nudge them again, and if so say something natural (maybe a bit put-out, or playful, depending on your mood/feelings).' : "You're a bit bored/thinking of them. Start a conversation out of the blue, naturally.")
    : (reason === 'followup' ? '你上一条消息 TA 一直没回。以人设判断要不要再戳一下,要的话说句自然的(可以有点小情绪、或俏皮,看你心情和好感)。' : '你有点无聊/想到了 TA。自然地起个话头、主动发条消息。');
  const stranger = (c.affection || 0) < 30
    ? (lang === 'en' ? '\nYou two barely know each other yet: if you text at all, keep it to one short, low-key line — no long sharing, no invitations, no flirting.' : '\n你们还不熟:就算主动发,也只是很短、很淡的一句,别分享一大段生活、别约见面、别撩。')
    : '';
  const sys = sysPrompt(c, lang) + '\n\n' + why + stranger + (lang === 'en' ? '\nOutput only the message.' : '\n只输出这条消息本身。');
  const r = await callLLM({ system: sys, messages: history.length ? history : [{ role: 'user', content: lang === 'en' ? '(start)' : '（起个话头）' }], tier: 'main', temperature: 1.05, maxTokens: 120, provider: 'deepseek' });
  return cleanMsg(r.text.trim());
}

// 让模型判断"现在要不要主动发消息"(无聊/催你),返回是否 + 原因
export async function decideReachOut(c: Companion, lang: 'zh' | 'en'): Promise<{ go: boolean; reason: 'bored' | 'followup' }> {
  const t = localNow(c);
  const quiet = c.quiet_start <= c.quiet_end ? (t.h >= c.quiet_start && t.h < c.quiet_end) : (t.h >= c.quiet_start || t.h < c.quiet_end);
  if (quiet) return { go: false, reason: 'bored' };
  const sinceUser = c.last_user_at ? (Date.now() - new Date(c.last_user_at).getTime()) / 3600000 : 999;
  const sinceAi = c.last_ai_at ? (Date.now() - new Date(c.last_ai_at).getTime()) / 3600000 : 999;
  const sinceProactive = c.last_proactive ? (Date.now() - new Date(c.last_proactive).getTime()) / 3600000 : 999;
  if (sinceProactive < 3) return { go: false, reason: 'bored' };   // 刚主动过,别刷屏
  // 你发了但 TA 没回(最后一条是 AI 发的且过了一阵)→ 可能补发
  const aiWaiting = c.last_ai_at && (!c.last_user_at || new Date(c.last_ai_at) > new Date(c.last_user_at));
  const sys = lang === 'en'
    ? `You are ${c.ai_name} (${c.job || 'a person'}), mood ${c.mood}/100, feelings toward them ${c.affection}/100. Local time ${t.h}:00. It's been ~${sinceAi.toFixed(1)}h since you last spoke, ~${sinceUser.toFixed(1)}h since they replied. Decide like a real person whether to text them right now unprompted. A busy/low-mood/low-affection person texts less. Output ONLY JSON: {"go": boolean, "reason": "bored"|"followup"}.`
    : `你是「${c.ai_name}」(${c.job || '某人'}),心情 ${c.mood}/100,对 TA 好感 ${c.affection}/100。当地时间约 ${t.h} 点。距你俩上次说话约 ${sinceAi.toFixed(1)} 小时,距 TA 上次回你约 ${sinceUser.toFixed(1)} 小时。像真人一样判断:现在要不要**主动**给 TA 发消息?忙/心情差/好感低的人更少主动。只输出 JSON:{"go": 布尔, "reason": "bored"（无聊想找）或 "followup"（你发了没回想补一句）}。`;
  try {
    const { data } = await callLLMJson<any>({ system: sys, messages: [{ role: 'user', content: aiWaiting ? (lang === 'en' ? '(you are waiting on their reply)' : '（你在等 TA 回）') : (lang === 'en' ? '(decide)' : '（判断）') }], tier: 'aux', temperature: 0.8, maxTokens: 60, provider: 'deepseek' });
    return { go: !!data.go, reason: data.reason === 'followup' ? 'followup' : 'bored' };
  } catch { return { go: false, reason: 'bored' }; }
}

// 滚动记忆 + 记下 TA 自己随口说出的新设定(下次被问答案一致)
export async function digestExchange(c: Companion, exchange: string, lang: 'zh' | 'en'): Promise<{ memory: string; facts: Record<string, string> }> {
  const bio = getBio(c);
  const sys = `你在为一个虚构人物「${c.ai_name}」维护两份资料。
1) memory:关于"用户"的长期记忆。把新对话并入已有记忆,只留持久的事实、偏好、情绪、在聊的话题,3~6 行短句。
2) facts:「${c.ai_name}」在这段对话里**说出的关于自己的新信息**(经历、喜好、习惯、朋友、计划、最近的事等),已有档案里没有的才写,用 {"话题":"内容"};没有就空对象。
只输出 JSON:{"memory": 字符串, "facts": {}}`;
  const msg = `已有用户记忆:\n${c.memory || '(无)'}\n\n「${c.ai_name}」已有档案话题:${Object.keys(bio.facts).join('、') || '(无)'}\n\n新对话:\n${exchange}`;
  try {
    const { data } = await callLLMJson<any>({ system: sys, messages: [{ role: 'user', content: msg }], tier: 'aux', temperature: 0.3, maxTokens: 600, provider: 'deepseek' });
    return { memory: String(data?.memory || c.memory || '').trim().slice(0, 2000), facts: data?.facts && typeof data.facts === 'object' ? data.facts : {} };
  } catch { return { memory: c.memory, facts: {} }; }
}

export function clamp(n: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, n)); }

// 由 AI 给的"几小时后"算出下次联系的 UTC 时间戳,落在勿扰时段就顺延到勿扰结束后。
export function scheduleNext(c: Companion, hours: number): string {
  const ms = Math.max(0.3, hours) * 3600000 * (0.8 + Math.random() * 0.4); // 抖动 ±20%
  let t = new Date(Date.now() + ms);
  for (let i = 0; i < 2; i++) {
    const localH = (t.getUTCHours() + (c.tz_offset || 0) + 24) % 24;
    const qs = c.quiet_start, qe = c.quiet_end;
    const quiet = qs <= qe ? (localH >= qs && localH < qe) : (localH >= qs || localH < qe);
    if (!quiet) break;
    // 顺延到勿扰结束(本地 qe 点)
    const addLocalH = (qe - localH + 24) % 24 || 1;
    t = new Date(t.getTime() + addLocalH * 3600000);
  }
  return t.toISOString();
}

// 启发式下次间隔(小时):好感高/黏人频率 → 更勤。proactive 之后用。
export function heuristicNextHours(c: Companion): number {
  const byFreq = c.freq === 'few' ? 40 : c.freq === 'twice' ? 7 : 16;
  const byAff = 1 - (c.affection || 10) / 180;           // 好感越高越勤(最多 ~-55%)
  return clamp(byFreq * byAff, 1.5, 72);
}
