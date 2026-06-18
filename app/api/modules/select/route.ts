// 玩家选定模组 → 建 campaign（锁定）→ 后台生成并锁定隐藏案件档案 → 进入建卡。
import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';
import { callLLMJson } from '@/lib/llm';
import { buildCaseLockPrompt } from '@/lib/kp/modules';
import { buildReviewSystem, composeQuality, QUALITY_PASS } from '@/lib/kp/review';
import { langDirective } from '@/lib/i18n';

export const maxDuration = 60;

export async function POST(req: Request) {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });

  const { roomId, moduleId } = await req.json().catch(() => ({} as any));
  if (!roomId || !moduleId) return NextResponse.json({ error: '缺少参数' }, { status: 400 });

  const admin = createAdminClient();
  const { data: me } = await admin
    .from('players')
    .select('id')
    .eq('room_id', roomId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!me) return NextResponse.json({ error: '你不在这个房间' }, { status: 403 });

  const { data: room } = await admin.from('rooms').select('*').eq('id', roomId).maybeSingle();
  if (!room) return NextResponse.json({ error: '房间不存在' }, { status: 404 });
  if (room.game_state === 'case_locking' || room.game_state === 'character_creation') {
    return NextResponse.json({ ok: true }); // 已在处理/已完成，幂等
  }

  const chosen = (room.module_options || []).find((m: any) => m.id === moduleId);
  if (!chosen) return NextResponse.json({ error: '模组不存在' }, { status: 400 });

  // 恐怖题材：选定模组的 genre > 自定义方向 > 默认克苏鲁
  const theme = chosen.genre || room.custom_direction?.horror_type || '克苏鲁';

  // 进入锁定中
  await admin.from('rooms').update({ game_state: 'case_locking' }).eq('id', roomId);

  try {
    let caseData: any = null;
    let quality: any = null;

    // A. 复用模组库里的现成案件（跳过生成+审查，省 token）
    if (chosen.from_library) {
      const { data: lib } = await admin.from('module_library').select('*').eq('id', chosen.from_library).maybeSingle();
      if (lib?.case_file) {
        caseData = lib.case_file;
        quality = lib.quality;
        await admin.from('module_library').update({ times_used: (lib.times_used || 0) + 1 }).eq('id', lib.id);
      }
    }

    // B. 否则现场生成 → 审查 →（不合格重生成，最多 2 次）→ 取最佳 → 归档进模组库
    if (!caseData) {
      // 只生成一次（关掉"不达标重生成"以省 token）；审查照常打分并归档
      for (let attempt = 0; attempt < 1; attempt++) {
        const { data: cd, usage } = await callLLMJson<any>({
          system: buildCaseLockPrompt(chosen, room.custom_direction, theme) + langDirective(room.language),
          messages: [{ role: 'user', content: '请生成隐藏案件档案。' }],
          tier: 'main', temperature: 0.7, maxTokens: 4800,
        });
        await admin.from('api_usage').insert({ room_id: roomId, kind: 'llm_main', model: usage.model, prompt_tokens: usage.promptTokens, completion_tokens: usage.completionTokens, latency_ms: usage.latencyMs });

        let review: any = { complexity: 75, pass: true };
        try {
          const r = await callLLMJson<any>({
            system: buildReviewSystem(),
            messages: [{ role: 'user', content: '案件档案：\n' + JSON.stringify(cd).slice(0, 6000) }],
            tier: 'aux', temperature: 0.2, maxTokens: 600,
          });
          review = r.data;
          await admin.from('api_usage').insert({ room_id: roomId, kind: 'llm_aux', model: r.usage.model, prompt_tokens: r.usage.promptTokens, completion_tokens: r.usage.completionTokens, latency_ms: r.usage.latencyMs });
        } catch {}

        const q = composeQuality(review, cd, chosen);
        if (!quality || q.complexity > quality.complexity) { caseData = cd; quality = q; }
        if (q.pass && q.complexity >= QUALITY_PASS) break;
      }

      // 归档进模组库：所有锁定的案子都记录（含不合格的，供后台分析）；
      // 只有达标的标记 passed=true，将来才会被当作可复用模板提供给玩家。
      await admin.from('module_library').insert({
        title: chosen.title, hook: chosen.hook, tagline: chosen.tagline, genre: theme,
        era: chosen.era, place: chosen.place, difficulty: chosen.difficulty, duration: chosen.duration,
        case_file: caseData, quality, passed: !!(quality && quality.complexity >= QUALITY_PASS),
      });
    }

    // 建 campaign（玩家可见层）；开场场景 + 质量评分存档
    const { data: campaign } = await admin
      .from('campaigns')
      .insert({
        room_id: roomId,
        title: chosen.title,
        premise: chosen.hook,
        tone: chosen.tagline,
        difficulty: chosen.difficulty,
        est_duration: chosen.duration,
        setting: {
          era: chosen.era,
          place: chosen.place,
          theme,
          opening_scene: caseData.opening_scene || '',
          opening_guidance: caseData.opening_guidance || null,
          quality,
        },
        status: 'locked',
      })
      .select()
      .single();

    const hash = crypto
      .createHash('sha256')
      .update(JSON.stringify(caseData))
      .digest('hex');

    await admin.from('hidden_case_files').insert({
      campaign_id: campaign.id,
      truth: (caseData.core_theme ? `【核心母题】${caseData.core_theme}\n` : '') + (caseData.truth || ''),
      mastermind: caseData.mastermind,
      supernatural: caseData.supernatural,
      npc_secrets: caseData.npcs,
      npc_lies: caseData.npcs,
      timeline_true: caseData.timeline_true,
      key_clues: caseData.key_clues,
      red_herrings: caseData.red_herrings,
      ending_conditions: caseData.ending_conditions,
      hidden_endings: caseData.hidden_endings,
      locked_hash: hash,
      locked_at: new Date().toISOString(),
    });

    // 世界时钟：把案件的定时事件落到房间（随回合自动推进）
    const clock = Array.isArray(caseData.world_clock)
      ? caseData.world_clock
          .filter((e: any) => e && e.label && Number(e.due_round) > 0)
          .map((e: any) => ({
            id: String(e.id || e.label).slice(0, 40),
            label: String(e.label),
            due_round: Math.max(2, Number(e.due_round) || 6),
            hidden: e.hidden !== false,
            on_fire: String(e.on_fire || ''),
            fired: false,
          }))
      : [];

    // 绑定 campaign，进入建卡
    await admin
      .from('rooms')
      .update({ campaign_id: campaign.id, game_state: 'character_creation', world_clock: clock })
      .eq('id', roomId);

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    // 失败回退到模组选择
    await admin.from('rooms').update({ game_state: 'module_selection' }).eq('id', roomId);
    await admin.from('error_logs').insert({ room_id: roomId, scope: 'llm', message: e.message });
    return NextResponse.json({ error: '真相生成失败：' + e.message }, { status: 500 });
  }
}
