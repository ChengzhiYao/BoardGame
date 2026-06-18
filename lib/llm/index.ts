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

export type Provider = 'anthropic' | 'openai' | 'deepseek';
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
  if (provider === 'deepseek') return 'deepseek-chat'; // 文本：DeepSeek V4（可用 LLM_MAIN_MODEL/LLM_AUX_MODEL 覆盖为 deepseek-v4-pro/flash）
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
// DeepSeek 与 OpenAI 接口兼容：同一个 SDK，换 baseURL + key 即可。
let _deepseek: OpenAI | null = null;
function deepseek() {
  if (!_deepseek) _deepseek = new OpenAI({
    apiKey: process.env.DEEPSEEK_API_KEY,
    baseURL: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com',
  });
  return _deepseek;
}
// 走 chat.completions 接口的两家（OpenAI / DeepSeek）按 provider 选客户端。
function chatClient(provider: Provider) {
  return provider === 'deepseek' ? deepseek() : openai();
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
    const res = await chatClient(provider).chat.completions.create({
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
  const jsonGuard = '\n\n你必须只输出一个合法 JSON 对象（不要任何思考过程、解释或 markdown 代码块）。Output ONLY one valid JSON object — no reasoning, no prose, no code fences.';

  async function attempt(): Promise<{ text: string; pt: number; ct: number }> {
    if (provider === 'anthropic') {
      const res = await anthropic().messages.create({
        model,
        system: req.system + jsonGuard,
        max_tokens: maxTokens,
        temperature,
        messages: req.messages.map((m) => ({ role: m.role, content: m.content })),
      });
      return {
        text: res.content.filter((b) => b.type === 'text').map((b: any) => b.text).join(''),
        pt: res.usage?.input_tokens ?? 0,
        ct: res.usage?.output_tokens ?? 0,
      };
    }
    const res = await chatClient(provider).chat.completions.create({
      model,
      temperature,
      max_tokens: maxTokens,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: req.system + jsonGuard },
        ...req.messages.map((m) => ({ role: m.role, content: m.content })),
      ],
    });
    return {
      text: res.choices[0]?.message?.content ?? '',
      pt: res.usage?.prompt_tokens ?? 0,
      ct: res.usage?.completion_tokens ?? 0,
    };
  }

  // DeepSeek 等偶尔会夹带思考/代码块导致 JSON 解析失败：最多重试一次。
  let lastErr: any = null;
  let text = '';
  let pt = 0;
  let ct = 0;
  for (let i = 0; i < 2; i++) {
    try {
      const r = await attempt();
      text = r.text; pt += r.pt; ct += r.ct;
      const data = safeParseJson<T>(text);
      return { data, usage: { text, provider, model, promptTokens: pt, completionTokens: ct, latencyMs: Date.now() - t0 } };
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error('LLM JSON 解析失败');
}

function safeParseJson<T>(text: string): T {
  let s = String(text || '').trim();
  // 去掉 markdown 代码围栏 ```json ... ```
  s = s.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  try { return JSON.parse(s) as T; } catch {}
  // 容错：截取第一个 { 到最后一个 }（跳过思考前缀/后缀）
  const start = s.indexOf('{');
  const end = s.lastIndexOf('}');
  if (start !== -1 && end !== -1 && end > start) {
    try { return JSON.parse(s.slice(start, end + 1)) as T; } catch {}
  }
  throw new Error('LLM 未返回合法 JSON：' + s.slice(0, 200));
}
