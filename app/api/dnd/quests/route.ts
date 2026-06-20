// D&D · 生成 3 个冒险选项供挑选（房主触发）。
import { NextResponse } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';
import { callLLMJson } from '@/lib/llm';
import { buildDndQuestsPrompt } from '@/lib/dnd/prompt';
import { langDirective } from '@/lib/i18n';

export const maxDuration = 60;

export async function POST(req: Request) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });
  const { roomId, custom } = await req.json().catch(() => ({} as any));
  if (!roomId) return NextResponse.json({ error: '缺少参数' }, { status: 400 });

  const admin = createAdminClient();
  const { data: room } = await admin.from('rooms').select('host_user_id, language, dnd_phase').eq('id', roomId).maybeSingle();
  if (!room) return NextResponse.json({ error: '房间不存在' }, { status: 404 });
  if (room.host_user_id !== user.id) return NextResponse.json({ error: '只有房主可以生成冒险' }, { status: 403 });
  if (room.dnd_phase && !['lobby', 'select'].includes(room.dnd_phase)) return NextResponse.json({ ok: true, already: true });

  const { data: claimed } = await admin.from('rooms').update({ modules_generating: true }).eq('id', roomId).eq('modules_generating', false).select('id');
  if (!claimed || !claimed.length) return NextResponse.json({ ok: true, busy: true });

  try {
    const { data: players } = await admin.from('players').select('seat').eq('room_id', roomId);
    const size = Math.max(1, (players || []).filter((p: any) => /^[A-H]$/.test(p.seat)).length);
    const { data: out, usage } = await callLLMJson<any>({
      system: buildDndQuestsPrompt(String(custom || '').slice(0, 400), size, room.language) + langDirective(room.language),
      messages: [{ role: 'user', content: '生成 3 个冒险选项。' }], tier: 'main', temperature: 0.9, maxTokens: 1200, retry: true,
    });
    await admin.from('api_usage').insert({ room_id: roomId, kind: 'llm_main', model: usage.model, prompt_tokens: usage.promptTokens, completion_tokens: usage.completionTokens, latency_ms: usage.latencyMs });
    const fresh = (Array.isArray(out.quests) ? out.quests : []).map((q: any) => ({ title: String(q.title || ''), setting: String(q.setting || ''), hook: String(q.hook || ''), tone: String(q.tone || ''), threat: String(q.threat || ''), length: String(q.length || '') }));
    if (!fresh.length) throw new Error('未生成有效选项');
    // 复用库存：中文且无自定义方向时，混入 1 个达标的现成冒险（被选中则跳过生成+审查，省 token）
    let libOption: any = null;
    if (room.language === 'zh' && !String(custom || '').trim()) {
      const { data: libs } = await admin.from('dnd_library').select('id, title, setting, hook, tone, threat, length, quality').eq('passed', true).order('created_at', { ascending: false }).limit(20);
      if (libs && libs.length) { const l = libs[Math.floor(Math.random() * libs.length)]; libOption = { title: l.title, setting: l.setting, hook: l.hook, tone: l.tone, threat: l.threat, length: l.length, from_library: l.id, quality_score: l.quality?.complexity ?? null }; }
    }
    const combined = libOption ? [libOption, ...fresh.slice(0, 2)] : fresh.slice(0, 3);
    const quests = combined.map((q: any, i: number) => ({ id: `q${i + 1}`, ...q }));
    await admin.from('rooms').update({ dnd_options: quests, dnd_phase: 'select', modules_generating: false }).eq('id', roomId);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    await admin.from('rooms').update({ modules_generating: false }).eq('id', roomId);
    await admin.from('error_logs').insert({ room_id: roomId, scope: 'llm', message: 'DnD选项:' + e.message });
    return NextResponse.json({ error: '生成失败：' + e.message }, { status: 500 });
  }
}
