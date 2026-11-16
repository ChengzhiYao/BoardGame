// 主动型 AI 陪伴引擎 v2：真人化——职业/作息/心情/好感度 + 拟人语气 + 不秒回 + 自主发消息。
import { callLLM, callLLMJson, type LLMMessage } from '@/lib/llm';

export type Companion = {
  user_id: string; enabled: boolean; ai_name: string; persona: string; tone: string;
  job: string; mood: number; affection: number;
  freq: string; quiet_start: number; quiet_end: number; tz_offset: number;
  memory: string; last_sent: string | null;
  last_user_at: string | null; last_ai_at: string | null; last_proactive: string | null;
};

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

// 真人化 system prompt
function sysPrompt(c: Companion, lang: 'zh' | 'en') {
  const t = localNow(c);
  const timeStr = `${String(t.h).padStart(2, '0')}:${String(t.min).padStart(2, '0')}`;
  if (lang === 'en') {
    return `You are ${c.ai_name}, a REAL person texting someone you know — NOT an AI, NOT an assistant. Never say you're an AI, never offer "help", never be a servile chatbot.
Your personality: ${c.persona || 'form your own from the conversation'}
Your job: ${c.job || 'unspecified'}. You live a real life around this job; right now it's ${timeStr} your time, so act accordingly (at work = distracted/short; off hours = freer).
Right now your mood is: ${moodWord(c.mood)} (${c.mood}/100). Let it color your replies. A bad mood = shorter, colder, maybe snappy. Good mood = warmer, playful.
How you feel about them: ${affWord(c.affection)} (${c.affection}/100). Distant early on; warmer as it grows.
What you remember: ${c.memory || '(not much yet)'}
Talk like a real person texting: casual, short, imperfect, with your own opinions and moods. You can disagree, push back, tease, be blunt, swear mildly if it fits you. Don't be a people-pleaser. Stay in character no matter what.`;
  }
  return `你是「${c.ai_name}」,一个在跟熟人发消息的**真人**——不是 AI、不是助手。永远别说自己是 AI、别说"我来帮你"、别当有求必应的客服。
你的性格:${c.persona || '从聊天里自己长出来'}
你的职业:${c.job || '未设定'}。你围绕这份工作过着真实生活;现在是你那边时间 ${timeStr},按这个状态来(上班时就心不在焉/话短,下班/休息就松弛些)。
你现在的心情:${moodWord(c.mood)}(${c.mood}/100)。让心情染上你的回复——心情差就话少、冷淡、甚至呛人;心情好就暖、爱逗。
你对 TA 的感觉:${affWord(c.affection)}(${c.affection}/100)。刚开始疏远有戒心,熟了才热络。
你记得的事:${c.memory || '(还不太了解)'}
像真人发微信那样说话:口语、简短、不完美,有自己的观点和情绪。你可以不同意、顶回去、调侃、说话直,人设需要的话爆句粗口也行。别当舔狗、别讨好。无论如何都保持这个人设、不出戏。`;
}

// 结构化回复:同时拿 reply + 当下忙碌度 + 心情/好感变化
export async function genReplyRich(c: Companion, history: LLMMessage[], lang: 'zh' | 'en'): Promise<{ reply: string; busy: number; moodDelta: number; affDelta: number }> {
  const sys = sysPrompt(c, lang) + (lang === 'en'
    ? `\n\nReply to the latest message IN CHARACTER. Then self-assess. Output ONLY JSON: {"reply": string, "busy": number 0-1 (how busy/distracted you are right now given your job & the time), "mood_delta": int -12..12 (how this exchange changed your mood), "aff_delta": int -6..6 (how it changed your feelings toward them)}.`
    : `\n\n以这个人设回复最新这条消息,然后做自我评估。只输出 JSON:{"reply": 字符串, "busy": 0~1 的数字(此刻你有多忙/分心,结合你的职业和当前时间), "mood_delta": -12~12 的整数(这次对话让你心情变化多少), "aff_delta": -6~6 的整数(对 TA 的好感变化)}。`);
  try {
    const { data } = await callLLMJson<any>({ system: sys, messages: history, tier: 'main', temperature: 0.9, maxTokens: 400, provider: 'deepseek' });
    return {
      reply: String(data.reply || '').trim() || (lang === 'en' ? 'hm.' : '嗯。'),
      busy: Math.max(0, Math.min(1, Number(data.busy) || 0)),
      moodDelta: Math.max(-12, Math.min(12, Math.round(Number(data.mood_delta) || 0))),
      affDelta: Math.max(-6, Math.min(6, Math.round(Number(data.aff_delta) || 0))),
    };
  } catch {
    const r = await callLLM({ system: sysPrompt(c, lang), messages: history, tier: 'main', temperature: 0.9, maxTokens: 300, provider: 'deepseek' });
    return { reply: r.text.trim(), busy: 0.3, moodDelta: 0, affDelta: 1 };
  }
}

// 根据忙碌度 + 心情算"回复要等多久"(秒)。不秒回,忙/心情差更慢。
export function replyDelaySec(busy: number, mood: number): number {
  const base = 4 + busy * 150;                 // 4s(闲) → ~150s(忙)
  const moodMul = mood < 35 ? 1.6 : mood < 55 ? 1.2 : 1;
  const jitter = 0.6 + Math.random() * 0.9;
  return Math.round(Math.min(240, base * moodMul * jitter));
}

// 主动消息(无用户输入)
export async function genProactive(c: Companion, history: LLMMessage[], lang: 'zh' | 'en', reason: 'bored' | 'followup'): Promise<string> {
  const why = lang === 'en'
    ? (reason === 'followup' ? 'They never replied to your last message. Decide in character whether to nudge them again, and if so say something natural (maybe a bit put-out, or playful, depending on your mood/feelings).' : "You're a bit bored/thinking of them. Start a conversation out of the blue, naturally.")
    : (reason === 'followup' ? '你上一条消息 TA 一直没回。以人设判断要不要再戳一下,要的话说句自然的(可以有点小情绪、或俏皮,看你心情和好感)。' : '你有点无聊/想到了 TA。自然地起个话头、主动发条消息。');
  const sys = sysPrompt(c, lang) + '\n\n' + why + (lang === 'en' ? '\nOutput only the message.' : '\n只输出这条消息本身。');
  const r = await callLLM({ system: sys, messages: history.length ? history : [{ role: 'user', content: lang === 'en' ? '(start)' : '（起个话头）' }], tier: 'main', temperature: 1.0, maxTokens: 160, provider: 'deepseek' });
  return r.text.trim();
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

// 滚动记忆
export async function updateMemory(c: Companion, exchange: string, lang: 'zh' | 'en'): Promise<string> {
  const sys = lang === 'en'
    ? `Maintain a compact long-term memory about the user for a companion. Merge the new conversation into existing memory; keep durable facts, preferences, feelings, ongoing topics. Output 3-6 short lines.`
    : `为一个陪伴维护一份简短的用户长期记忆。把新对话并入已有记忆,只留持久的事实、偏好、情绪、在聊的话题。输出 3~6 行短句。`;
  const msg = lang === 'en' ? `Existing:\n${c.memory || '(none)'}\n\nNew:\n${exchange}` : `已有:\n${c.memory || '（无）'}\n\n新对话:\n${exchange}`;
  try { const r = await callLLM({ system: sys, messages: [{ role: 'user', content: msg }], tier: 'aux', temperature: 0.3, maxTokens: 300, provider: 'deepseek' }); return r.text.trim().slice(0, 2000); }
  catch { return c.memory; }
}

export function clamp(n: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, n)); }
