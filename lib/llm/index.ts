// =====================================================================
// 双模型 LLM 适配器：Claude（Anthropic）与 GPT（OpenAI）统一接口，可切换。
// 上层（AI KP 工作流）只调 callLLM() / callLLMJson()，不关心底层是哪家。
// 关键设计：
//   - 主/副模型分层：'main' 用强模型主持回合，'aux' 用便宜模型做摘要等轻任务。
//   - callLLMJson() 强制结构化 JSON 输出，给 KP 回合用，杜绝自由文本解析失败。
//   - 用量统计回传，便于写入 api_usage 表做成本控制。
//   - 仅在服务端使用（Edge Function / Route Handler），绝不在前端 import。
// =====================================================================

import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';

export type Provider = 'anthropic' | 'openai';
export type Tier = 'main' | 'aux';

export interface LLMMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface LLMRequest {
  system: string;            // system prompt（KP 行为契约 + 真相注入，仅服务端）
  messages: LLMMessage[];    // 对话历史 + 本回合输入
  tier?: Tier;               // 默认 main
  temperature?: number;      // 真相相关用低温，默认 0.6
  maxTokens?: number;
  provider?: Provider;       // 可强制指定某家，默认读环境变量
}

export interface LLMResult {
  text: string;
  provider: Provider;
  model: string;
  promptTokens: number;
  completionTokens: number;
  latencyMs: number;
}

// ---- 选择 provider 与 model ----
function resolveProvider(req: LLMRequest): Provider {
  return req.provider ?? (process.env.LLM_PROVIDER as Provider) ?? 'anthropic';
}
function resolveModel(provider: Provider, tier: Tier): string {
  const main = process.env.LLM_MAIN_MODEL;
  const aux = process.env.LLM_AUX_MODEL;
  if (tier === 'aux' && aux) return aux;
  if (tier === 'main' && main) return main;
  // 兜底默认（请在 .env 里按官网最新型号覆盖）
  return provider === 'anthropic'
    ? (tier === 'aux' ? 'claude-haiku' : 'claude-sonnet')
    : (tier === 'aux' ? 'gpt-4o-mini' : 'gpt-4o');
}

let _anthropic: Anthropic | null = null;
let _openai: OpenAI | null = null;
function anthropic() {
  if (!_anthropic) _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return _anthropic;
}
function openai() {
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return _openai;
}

// ---- 通用文本调用 ----
export async function callLLM(req: LLMRequest): Promise<LLMResult> {
  const provider = resolveProvider(req);
  const tier = req.tier ?? 'main';
  const model = resolveModel(provider, tier);
  const temperature = req.temperature ?? 0.6;
  const maxTokens = req.maxTokens ?? 1500;
  const t0 = Date.now();

  if (provider === 'anthropic') {
    const res = await anthropic().messages.create({
      model,
      system: req.system,
      max_tokens: maxTokens,
      temperature,
      messages: req.messages.map((m) => ({ role: m.role, content: m.content })),
    });
    const text = res.content
      .filter((b) => b.type === 'text')
      .map((b: any) => b.text)
      .join('');
    return {
      text, provider, model,
      promptTokens: res.usage?.input_tokens ?? 0,
      completionTokens: res.usage?.output_tokens ?? 0,
      latencyMs: Date.now() - t0,
    };
  } else {
    const res = await openai().chat.completions.create({
      model,
      temperature,
      max_tokens: maxTokens,
      messages: [
        { role: 'system', content: req.system },
        ...req.messages.map((m) => ({ role: m.role, content: m.content })),
      ],
    });
    return {
      text: res.choices[0]?.message?.content ?? '',
      provider, model,
      promptTokens: res.usage?.prompt_tokens ?? 0,
      completionTokens: res.usage?.completion_tokens ?? 0,
      latencyMs: Date.now() - t0,
    };
  }
}

// ---- 强制 JSON 输出（KP 回合用）----
// 两家都要求只返回 JSON；解析失败时做一次容错截取。
export async function callLLMJson<T = any>(req: LLMRequest): Promise<{ data: T; usage: LLMResult }> {
  const provider = resolveProvider(req);
  const tier = req.tier ?? 'main';
  const model = resolveModel(provider, tier);
  const temperature = req.temperature ?? 0.4;
  const maxTokens = req.maxTokens ?? 2000;
  const t0 = Date.now();
  let text = '';
  let promptTokens = 0;
  let completionTokens = 0;
  const jsonGuard = '\n\n你必须只输出一个合法 JSON 对象，不要任何额外文字、解释或 markdown 代码块。';

  if (provider === 'anthropic') {
    const res = await anthropic().messages.create({
      model,
      system: req.system + jsonGuard,
      max_tokens: maxTokens,
      temperature,
      messages: req.messages.map((m) => ({ role: m.role, content: m.content })),
    });
    text = res.content.filter((b) => b.type === 'text').map((b: any) => b.text).join('');
    promptTokens = res.usage?.input_tokens ?? 0;
    completionTokens = res.usage?.output_tokens ?? 0;
  } else {
    const res = await openai().chat.completions.create({
      model,
      temperature,
      max_tokens: maxTokens,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: req.system + jsonGuard },
        ...req.messages.map((m) => ({ role: m.role, content: m.content })),
      ],
    });
    text = res.choices[0]?.message?.content ?? '';
    promptTokens = res.usage?.prompt_tokens ?? 0;
    completionTokens = res.usage?.completion_tokens ?? 0;
  }

  const data = safeParseJson<T>(text);
  return {
    data,
    usage: { text, provider, model, promptTokens, completionTokens, latencyMs: Date.now() - t0 },
  };
}

function safeParseJson<T>(text: string): T {
  try {
    return JSON.parse(text) as T;
  } catch {
    // 容错：截取第一个 { 到最后一个 }
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start !== -1 && end !== -1) {
      try { return JSON.parse(text.slice(start, end + 1)) as T; } catch {}
    }
    throw new Error('LLM 未返回合法 JSON：' + text.slice(0, 200));
  }
}
