// 生成 3 个剧本杀剧本选项（房主触发）。
import { NextResponse } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';
import { callLLMJson } from '@/lib/llm';
import { buildJbsScriptGenPrompt } from '@/lib/jbs/prompt';
import { langDirective } from '@/lib/i18n';

export const maxDuration = 60;

export async function POST(req: Request) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });

  const { roomId, headcount, customDirection } = await req.json().catch(() => ({} as any));
  if (!roomId) return NextResponse.json({ error: '缺少 roomId' }, { status: 400 });

  const admin = createAdminClient();
  const { data: room } = await admin.from('rooms').select('id, host_user_id, language').eq('id', roomId).maybeSingle();
  if (!room) return NextResponse.json({ error: '房间不存在' }, { status: 404 });
  // 房间内任何玩家都能出本/自定义
  const { data: me } = await admin.from('players').select('id').eq('room_id', roomId).eq('user_id', user.id).maybeSingle();
  if (!me) return NextResponse.json({ error: '你不在这个房间' }, { status: 403 });

  const hc = Math.min(8, Math.max(4, Number(headcount) || 6));
  await admin.from('rooms').update({ modules_generating: true }).eq('id', roomId);
  try {
    const { data, usage } = await callLLMJson<{ scripts: any[] }>({
      system: buildJbsScriptGenPrompt(hc, customDirection) + langDirective(room.language),
      messages: [{ role: 'user', content: '请生成 3 个剧本。' }],
      tier: 'main', temperature: 1.0, maxTokens: 1800,
    });
    const scripts = (data.scripts || []).slice(0, 3).map((s: any, i: number) => ({ id: `s${i + 1}`, ...s, headcount: Number(s.headcount) || hc }));
    await admin.from('rooms').update({ jbs_options: scripts, jbs_phase: 'script', modules_generating: false }).eq('id', roomId);
    await admin.from('api_usage').insert({ room_id: roomId, kind: 'llm_main', model: usage.model, prompt_tokens: usage.promptTokens, completion_tokens: usage.completionTokens, latency_ms: usage.latencyMs });
    return NextResponse.json({ ok: true, scripts });
  } catch (e: any) {
    await admin.from('rooms').update({ modules_generating: false }).eq('id', roomId);
    await admin.from('error_logs').insert({ room_id: roomId, scope: 'llm', message: '剧本生成:' + e.message });
    return NextResponse.json({ error: '剧本生成失败：' + e.message }, { status: 500 });
  }
}
