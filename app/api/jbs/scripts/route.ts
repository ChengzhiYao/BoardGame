// 生成 3 个剧本杀剧本选项（房主触发）。
import { NextResponse } from 'next/server';
import { getEntitlement } from '@/lib/billing/entitlement';
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

  // 定制本（把朋友写进去）：用一张定制券（$9.9），白名单免费
  const people = Array.isArray(customDirection?.people) ? customDirection.people.filter((p: any) => String(p?.name || '').trim()).slice(0, 8) : [];
  if (people.length) {
    const ent = await getEntitlement(admin, user);
    const { data: pf } = await admin.from('profiles').select('custom_credits').eq('user_id', user.id).maybeSingle();
    if (!ent.whitelisted) {
      if (!(pf?.custom_credits > 0)) return NextResponse.json({ error: '定制剧本需要一张定制券', reason: 'custom_pay' }, { status: 402 });
      await admin.from('profiles').update({ custom_credits: pf.custom_credits - 1 }).eq('user_id', user.id);
    }
    await admin.from('rooms').update({ jbs_custom: { people, occasion: String(customDirection?.occasion || '').slice(0, 60) } }).eq('id', roomId);
  }
  const hc = Math.min(8, Math.max(4, Number(headcount) || people.length || 6, people.length));
  await admin.from('rooms').update({ modules_generating: true }).eq('id', roomId);
  try {
    const { data, usage } = await callLLMJson<{ scripts: any[] }>({
      system: buildJbsScriptGenPrompt(hc, customDirection) + langDirective(room.language),
      messages: [{ role: 'user', content: '请生成 3 个剧本。' }],
      tier: 'main', temperature: 1.0, maxTokens: 1800,
    });
    let fresh = (data.scripts || []).map((s: any) => ({ ...s, headcount: Number(s.headcount) || hc }));
    // 题库里人数够、没被定制方向限制的现成剧本：选中就秒开，开场白已配音
    if (room.language !== 'en' && !people.length && !(customDirection && Object.values(customDirection).some(Boolean))) {
      const { count: humans } = await admin.from('players').select('id', { count: 'exact', head: true }).eq('room_id', roomId);
      const { data: libs } = await admin.from('jbs_case_library').select('id, headcount, script, blurb_audio').eq('lang', 'zh').eq('passed', true).gte('headcount', Math.max(humans || 1, 4)).lte('headcount', Math.max(hc, 4) + 1).limit(60);
      const pickN = (libs || []).length >= 6 ? 2 : (libs || []).length ? 1 : 0;
      const picks = [...(libs || [])].sort(() => Math.random() - 0.5).slice(0, pickN).map((l: any) => ({ ...l.script, headcount: l.headcount, from_library: l.id, blurb_audio: l.blurb_audio || undefined }));
      fresh = [...picks, ...fresh];
    }
    const scripts = fresh.slice(0, 3).map((s: any, i: number) => ({ ...s, id: `s${i + 1}` }));
    await admin.from('rooms').update({ jbs_options: scripts, jbs_phase: 'script', modules_generating: false }).eq('id', roomId);
    await admin.from('api_usage').insert({ room_id: roomId, kind: 'llm_main', model: usage.model, prompt_tokens: usage.promptTokens, completion_tokens: usage.completionTokens, latency_ms: usage.latencyMs });
    return NextResponse.json({ ok: true, scripts });
  } catch (e: any) {
    await admin.from('rooms').update({ modules_generating: false }).eq('id', roomId);
    await admin.from('error_logs').insert({ room_id: roomId, scope: 'llm', message: '剧本生成:' + e.message });
    return NextResponse.json({ error: '剧本生成失败：' + e.message }, { status: 500 });
  }
}
