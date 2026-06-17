// 生成 3 个原创模组选项（支持自定义方向 / 重新生成）。
import { NextResponse } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';
import { callLLMJson } from '@/lib/llm';
import { buildModuleGenPrompt, type CustomDirection } from '@/lib/kp/modules';

export const maxDuration = 60;

export async function POST(req: Request) {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });

  const { roomId, customDirection } = await req.json().catch(() => ({} as any));
  if (!roomId) return NextResponse.json({ error: '缺少 roomId' }, { status: 400 });

  const admin = createAdminClient();
  const { data: me } = await admin
    .from('players')
    .select('id, seat')
    .eq('room_id', roomId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!me) return NextResponse.json({ error: '你不在这个房间' }, { status: 403 });

  // 防并发：标记生成中
  await admin.from('rooms').update({ modules_generating: true }).eq('id', roomId);

  try {
    const { data, usage } = await callLLMJson<{ modules: any[] }>({
      system: buildModuleGenPrompt(customDirection as CustomDirection),
      messages: [{ role: 'user', content: '请生成 3 个模组选项。' }],
      tier: 'main',
      temperature: 1.0,
      maxTokens: 1600,
    });

    let fresh = (data.modules || []).slice(0, 3);

    // 从模组库取一个达标的现成案件混进选项（被选中则跳过生成+审查，省 token）。
    // 自定义方向时不混入库存，尊重玩家的定制。
    let libOption: any = null;
    if (!customDirection || !Object.values(customDirection).some(Boolean)) {
      const { data: libs } = await admin
        .from('module_library')
        .select('id, title, hook, tagline, genre, era, place, difficulty, duration, quality')
        .eq('passed', true)
        .order('created_at', { ascending: false })
        .limit(20);
      const usable = libs || [];
      if (usable.length) {
        const l = usable[Math.floor(Math.random() * usable.length)];
        libOption = {
          title: l.title, tagline: l.tagline, hook: l.hook, genre: l.genre, era: l.era, place: l.place,
          difficulty: l.difficulty, duration: l.duration,
          from_library: l.id, quality_score: l.quality?.complexity ?? null,
        };
      }
    }

    // 有库存就用 1 个库存 + 2 个新生成，凑满 3 个
    const combined = libOption ? [libOption, ...fresh.slice(0, 2)] : fresh.slice(0, 3);
    const modules = combined.map((m: any, i: number) => ({ id: `m${i + 1}`, ...m }));

    await admin
      .from('rooms')
      .update({
        module_options: modules,
        custom_direction: customDirection || null,
        modules_generating: false,
        game_state: 'module_selection',
      })
      .eq('id', roomId);

    await admin.from('api_usage').insert({
      room_id: roomId,
      kind: 'llm_main',
      model: usage.model,
      prompt_tokens: usage.promptTokens,
      completion_tokens: usage.completionTokens,
      latency_ms: usage.latencyMs,
    });

    return NextResponse.json({ ok: true, modules });
  } catch (e: any) {
    await admin.from('rooms').update({ modules_generating: false }).eq('id', roomId);
    await admin.from('error_logs').insert({ room_id: roomId, scope: 'llm', message: e.message });
    return NextResponse.json({ error: '模组生成失败：' + e.message }, { status: 500 });
  }
}
