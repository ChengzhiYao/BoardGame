// 抽一题真心话/大冒险。免费：从内置题库 + 历史题库随机；AI 定制：按设置生成并存库复用。
import { NextResponse } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';
import { callLLMJson } from '@/lib/llm';
import { TRUTHS, DARES, filterByIntensity } from '@/lib/td/pool';
import { buildTDGenPrompt } from '@/lib/td/prompt';
import { langDirective } from '@/lib/i18n';

export const maxDuration = 60;

export async function POST(req: Request) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });

  const { roomId, kind, ai } = await req.json().catch(() => ({} as any));
  if (!roomId || !['truth', 'dare'].includes(kind)) return NextResponse.json({ error: '缺少参数' }, { status: 400 });

  const admin = createAdminClient();
  const { data: me } = await admin.from('players').select('id, user_id').eq('room_id', roomId).eq('user_id', user.id).maybeSingle();
  if (!me) return NextResponse.json({ error: '你不在这个房间' }, { status: 403 });
  const { data: u } = await admin.from('users').select('display_name').eq('id', user.id).maybeSingle();

  const { data: room } = await admin.from('rooms').select('td_settings, language').eq('id', roomId).maybeSingle();
  const lang = room?.language || 'zh';
  const en = lang === 'en';
  const myName = u?.display_name || (en ? 'Player' : '玩家');
  const useAi = ai || en; // 英文局没有内置中文题库，统一用 AI 现编英文题
  const s = room?.td_settings || { types: ['truth', 'dare'], intensity: 'medium' };
  if (Array.isArray(s.types) && !s.types.includes(kind)) {
    return NextResponse.json({ error: '本局没有开启这个类型' }, { status: 409 });
  }
  const cap = s.intensity || 'medium';
  const label = en ? (kind === 'truth' ? 'Truth' : 'Dare') : (kind === 'truth' ? '真心话' : '大冒险');

  let text = '';
  try {
    if (useAi) {
      const { data, usage } = await callLLMJson<any>({
        system: buildTDGenPrompt(kind, s) + langDirective(lang),
        messages: [{ role: 'user', content: '请出一题。' }],
        tier: 'aux', temperature: 1.0, maxTokens: 200,
      });
      text = (data.text || '').trim();
      if (text) await admin.from('td_library').insert({ kind, intensity: data.intensity || cap, text });
      await admin.from('api_usage').insert({ room_id: roomId, kind: 'llm_aux', model: usage.model, prompt_tokens: usage.promptTokens, completion_tokens: usage.completionTokens, latency_ms: usage.latencyMs });
    } else {
      // 内置题库 + 历史 AI 题库，按尺度过滤后随机
      const base = filterByIntensity(kind === 'truth' ? TRUTHS : DARES, cap).map((i) => i.text);
      const { data: lib } = await admin.from('td_library').select('text, intensity').eq('kind', kind).limit(200);
      const libTexts = (lib || []).map((l: any) => l.text);
      const pool = [...base, ...libTexts];
      text = pool.length ? pool[Math.floor(Math.random() * pool.length)] : (en ? '(Pool empty — try AI custom)' : '（题库为空，试试 AI 定制）');
    }
  } catch (e: any) {
    return NextResponse.json({ error: '抽题失败：' + e.message }, { status: 500 });
  }

  await admin.from('messages').insert({
    room_id: roomId, sender_type: 'kp', turn_no: 0,
    content: en ? `🎲 ${myName} · ${label}: ${text}` : `🎲 给 ${myName} 的【${label}】：${text}`,
    payload: { type: 'td', kind },
  });

  return NextResponse.json({ ok: true });
}
