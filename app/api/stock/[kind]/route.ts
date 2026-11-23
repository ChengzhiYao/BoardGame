// 题库补货（Linger 每 10 分钟并行叫 coc / jbs 各一次；海龟汤走 /api/soup/stock）。
// Fish 免费期内：新做一套完整案件 + 把开场旁白/简介配好音存起来；没配音的旧条目顺手补上。
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { callLLMJson } from '@/lib/llm';
import { buildModuleGenPrompt, buildCaseLockPrompt } from '@/lib/kp/modules';
import { composeQuality, QUALITY_PASS } from '@/lib/kp/review';
import { buildModuleReviewSystem, normalizeModuleQuality } from '@/lib/review/quality';
import { buildJbsScriptGenPrompt, buildJbsCasePrompt } from '@/lib/jbs/prompt';
import { voiceLine } from '@/lib/soup/voice';
import { stripMarks } from '@/lib/narrate';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

async function voiceDead(admin: any) { const { data } = await admin.from('app_kv').select('value').eq('key', 'soup_voice_quota').maybeSingle(); return !!(data?.value?.until && Date.now() < data.value.until); }
async function markDead(admin: any) { await admin.from('app_kv').upsert({ key: 'soup_voice_quota', value: { until: Date.now() + 3600000 } }); }
async function say(admin: any, text: string, lang: 'zh' | 'en') { try { return await voiceLine(admin, stripMarks(text || ''), lang); } catch (e: any) { if (e?.message === 'quota') await markDead(admin); return null; } }

export async function POST(req: Request, { params }: { params: { kind: string } }) {
  const key = process.env.LINGER_BRIDGE_KEY || '';
  if (!key || req.headers.get('x-linger-key') !== key) return NextResponse.json({ ok: false }, { status: 401 });
  const admin = createAdminClient();
  const t0 = Date.now(); const out: any = { kind: params.kind, voiced: 0, made: 0 };
  const dead = await voiceDead(admin);

  if (params.kind === 'coc') {
    // 1) 补配音：达标但没配音的模组
    if (!dead) {
      const { data: rows } = await admin.from('module_library').select('id, hook, case_file, hook_audio, opening_audio, lang').eq('passed', true).or('hook_audio.is.null,opening_audio.is.null').limit(2);
      for (const r of rows || []) {
        const lang = r.lang === 'en' ? 'en' : 'zh';
        const h = r.hook_audio || await say(admin, r.hook, lang);
        const o = r.opening_audio || await say(admin, r.case_file?.opening_scene || '', lang);
        if (h || o) { await admin.from('module_library').update({ hook_audio: h, opening_audio: o }).eq('id', r.id); out.voiced++; }
      }
    }
    // 2) 新做一套完整案件（模组 → 锁定案件 → 审查 → 入库 → 配音）
    // 预算：克苏鲁最多存 260 套，约每 40 分钟写 1 套（到 11/30 大约花 3.5 美元）
    const { count } = await admin.from('module_library').select('id', { count: 'exact', head: true }).eq('source', 'stock');
    const { data: lastC } = await admin.from('module_library').select('created_at').eq('source', 'stock').order('created_at', { ascending: false }).limit(1).maybeSingle();
    const recentC = lastC?.created_at && Date.now() - new Date(lastC.created_at).getTime() < 34 * 60000;
    if ((count || 0) < 260 && !recentC && Date.now() - t0 < 60000) {
      try {
        const { data: g } = await callLLMJson<{ modules: any[] }>({ system: buildModuleGenPrompt(), messages: [{ role: 'user', content: '请生成 3 个候选模组。' }], tier: 'main', temperature: 1.0, maxTokens: 2000 });
        const chosen = (g.modules || [])[Math.floor(Math.random() * Math.max(1, (g.modules || []).length))];
        if (chosen?.title) {
          const theme = chosen.genre || '';
          const { data: cd } = await callLLMJson<any>({ system: buildCaseLockPrompt(chosen, undefined, theme), messages: [{ role: 'user', content: '请生成隐藏案件档案。' }], tier: 'main', temperature: 0.7, maxTokens: 4800 });
          let review: any = { complexity: 75, pass: true };
          try { const r = await callLLMJson<any>({ system: buildModuleReviewSystem('coc', 'zh'), messages: [{ role: 'user', content: '案件档案：\n' + JSON.stringify(cd).slice(0, 6000) }], tier: 'aux', temperature: 0.2, maxTokens: 1100 }); review = normalizeModuleQuality(r.data, 'coc'); } catch {}
          const quality = { ...composeQuality(review, cd, chosen), dimensions: review.dimensions, verdict: review.verdict };
          const passed = !!(quality && quality.complexity >= QUALITY_PASS);
          const hook_audio = passed && !dead && Date.now() - t0 < 240000 ? await say(admin, chosen.hook, 'zh') : null;
          const opening_audio = passed && !dead && Date.now() - t0 < 250000 ? await say(admin, cd?.opening_scene || '', 'zh') : null;
          await admin.from('module_library').insert({ title: chosen.title, hook: chosen.hook, tagline: chosen.tagline, genre: theme, era: chosen.era, place: chosen.place, difficulty: chosen.difficulty, duration: chosen.duration, case_file: cd, quality, passed, lang: 'zh', hook_audio, opening_audio, source: 'stock' });
          out.made++; out.passed = passed;
        }
      } catch (e: any) { out.error = String(e?.message || e).slice(0, 120); }
    }
  } else if (params.kind === 'jbs') {
    if (!dead) {
      const { data: rows } = await admin.from('jbs_case_library').select('id, lang, case_file, script, opening_audio, blurb_audio').or('opening_audio.is.null,blurb_audio.is.null').limit(2);
      for (const r of rows || []) {
        const lang = r.lang === 'en' ? 'en' : 'zh';
        const o = r.opening_audio || await say(admin, r.case_file?.opening || '', lang);
        const b = r.blurb_audio || await say(admin, r.script?.blurb || r.script?.hook || r.script?.summary || '', lang);
        if (o || b) { await admin.from('jbs_case_library').update({ opening_audio: o, blurb_audio: b }).eq('id', r.id); out.voiced++; }
      }
    }
    // 预算：剧本杀最多存 260 套，约每 40 分钟写 1 套（到 11/30 大约花 3.5 美元）
    const { count } = await admin.from('jbs_case_library').select('id', { count: 'exact', head: true });
    const { data: lastJ } = await admin.from('jbs_case_library').select('created_at').order('created_at', { ascending: false }).limit(1).maybeSingle();
    const recentJ = lastJ?.created_at && Date.now() - new Date(lastJ.created_at).getTime() < 34 * 60000;
    if ((count || 0) < 260 && !recentJ && Date.now() - t0 < 60000) {
      const headcount = [4, 5, 5, 6, 6, 6][Math.floor(Math.random() * 6)];
      try {
        const { data: sd } = await callLLMJson<{ scripts: any[] }>({ system: buildJbsScriptGenPrompt(headcount, null), messages: [{ role: 'user', content: '请生成 3 个剧本。' }], tier: 'main', temperature: 1.0, maxTokens: 1800 });
        const script = (sd.scripts || [])[Math.floor(Math.random() * Math.max(1, (sd.scripts || []).length))];
        if (script?.title) {
          const { data: cf } = await callLLMJson<any>({ system: buildJbsCasePrompt(script, headcount, ['A', 'B']), messages: [{ role: 'user', content: '请生成隐藏案件与全部角色。' }], tier: 'main', temperature: 0.8, maxTokens: 5200 });
          if (Array.isArray(cf?.characters) && cf.characters.length >= headcount) {
            let quality: any = null;
            try { const r = await callLLMJson<any>({ system: buildModuleReviewSystem('jbs', 'zh'), messages: [{ role: 'user', content: '剧本案件：\n' + JSON.stringify(cf).slice(0, 6000) }], tier: 'aux', temperature: 0.2, maxTokens: 1100 }); quality = normalizeModuleQuality(r.data, 'jbs'); cf.quality = quality; } catch {}
            const passed = !quality || (quality.complexity ?? 70) >= 60;
            const opening_audio = passed && !dead && Date.now() - t0 < 250000 ? await say(admin, cf.opening || '', 'zh') : null;
            await admin.from('jbs_case_library').insert({ lang: 'zh', headcount, type: cf.type || script.type, title: cf.title || script.title, script: { ...script, headcount }, case_file: cf, quality, passed, opening_audio });
            out.made++; out.passed = passed;
          }
        }
      } catch (e: any) { out.error = String(e?.message || e).slice(0, 120); }
    }
  } else return NextResponse.json({ ok: false, error: 'kind' }, { status: 400 });

  out.ms = Date.now() - t0;
  return NextResponse.json({ ok: true, ...out });
}
