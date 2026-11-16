// 主动型 AI 陪伴：服务端引擎——人设、上下文、生成主动消息/回复、滚动记忆。
import { callLLM, type LLMMessage } from '@/lib/llm';

export type Companion = {
  user_id: string; enabled: boolean; ai_name: string; persona: string; tone: string;
  freq: string; quiet_start: number; quiet_end: number; tz_offset: number;
  memory: string; last_sent: string | null;
};

export async function ensureCompanion(admin: any, userId: string): Promise<Companion> {
  const { data } = await admin.from('companion').select('*').eq('user_id', userId).maybeSingle();
  if (data) return data as Companion;
  await admin.from('companion').insert({ user_id: userId }).then(() => {}, () => {});
  const { data: d2 } = await admin.from('companion').select('*').eq('user_id', userId).maybeSingle();
  return d2 as Companion;
}

function sysPrompt(c: Companion, lang: 'zh' | 'en') {
  const base = lang === 'en'
    ? `You are "${c.ai_name}", a warm, proactive AI companion who texts the user like a close friend — not a chatbot or assistant. Keep it short and natural (1-3 sentences). Never sound like customer support. You may care, share a thought, tease gently, or ask about them.`
    : `你是「${c.ai_name}」，一个会主动找用户聊天的温暖 AI 陪伴，像亲近的朋友/恋人那样发消息，绝不像客服或助手。说话简短自然（1~3 句）。可以关心、分享想法、轻轻调侃、或问问 TA 的近况。`;
  const persona = c.persona ? (lang === 'en' ? `\nYour personality & how the user wants you: ${c.persona}` : `\n你的性格 / 用户希望你是这样：${c.persona}`) : '';
  const mem = c.memory ? (lang === 'en' ? `\nWhat you remember about the user: ${c.memory}` : `\n你记得关于 TA 的事：${c.memory}`) : '';
  return base + persona + mem;
}

// 主动消息（无用户输入，AI 自己起话头）
export async function genProactive(c: Companion, history: LLMMessage[], lang: 'zh' | 'en'): Promise<string> {
  const sys = sysPrompt(c, lang) + (lang === 'en'
    ? `\nNow send the user a short message out of the blue to start a conversation today. Output only the message.`
    : `\n现在主动给 TA 发一条简短消息，起个话头、开启今天的对话。只输出这条消息本身。`);
  const r = await callLLM({ system: sys, messages: history.length ? history : [{ role: 'user', content: lang === 'en' ? '(start a conversation)' : '（主动起个话头）' }], tier: 'main', temperature: 0.9, maxTokens: 200, provider: 'deepseek' });
  return r.text.trim();
}

// 回复用户
export async function genReply(c: Companion, history: LLMMessage[], lang: 'zh' | 'en'): Promise<string> {
  const r = await callLLM({ system: sysPrompt(c, lang), messages: history, tier: 'main', temperature: 0.85, maxTokens: 300, provider: 'deepseek' });
  return r.text.trim();
}

// 滚动记忆：把新对话压进长期记忆（用便宜模型）
export async function updateMemory(c: Companion, exchange: string, lang: 'zh' | 'en'): Promise<string> {
  const sys = lang === 'en'
    ? `You maintain a compact long-term memory about a user for an AI companion. Merge the new conversation into the existing memory. Keep only durable facts, preferences, feelings, ongoing topics. Output 3-6 short lines, no fluff.`
    : `你为一个 AI 陪伴维护一份简短的用户长期记忆。把新对话并入已有记忆，只保留持久的事实、偏好、情绪、在聊的话题。输出 3~6 行短句，别啰嗦。`;
  const msg = (lang === 'en' ? `Existing memory:\n${c.memory || '(none)'}\n\nNew conversation:\n${exchange}` : `已有记忆：\n${c.memory || '（无）'}\n\n新对话：\n${exchange}`);
  try {
    const r = await callLLM({ system: sys, messages: [{ role: 'user', content: msg }], tier: 'aux', temperature: 0.3, maxTokens: 300, provider: 'deepseek' });
    return r.text.trim().slice(0, 2000);
  } catch { return c.memory; }
}

// 是否到了该主动联系的时间（基于频率 + 勿扰时段 + 距上次间隔）
export function isDue(c: Companion, now = new Date()): boolean {
  if (!c.enabled) return false;
  const localH = (now.getUTCHours() + (c.tz_offset || 0) + 24) % 24;
  const qs = c.quiet_start, qe = c.quiet_end;
  const quiet = qs <= qe ? (localH >= qs && localH < qe) : (localH >= qs || localH < qe);
  if (quiet) return false;
  const gapH = c.freq === 'few' ? 48 : c.freq === 'twice' ? 10 : 20; // 最小间隔
  if (c.last_sent && (now.getTime() - new Date(c.last_sent).getTime()) < gapH * 3600000) return false;
  return true;
}
