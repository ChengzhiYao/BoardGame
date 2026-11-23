// 海龟汤题库补货（Linger 每 10 分钟叫一次）：先给没配音的题补配音，再按「哪类最少就补哪类」新出几道题并配音。
// Fish 免费期内尽量多攒；免费结束（遇到 quota）就只补题不配音。
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { callLLMJson } from '@/lib/llm';
import { buildSoupGenPrompt } from '@/lib/soup/prompt';
import { langDirective } from '@/lib/i18n';
import { voicePuzzle } from '@/lib/soup/voice';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const DIFF = ['普通', '普通', '困难', '困难', '地狱'];
const SUPER = ['any', 'allow', 'real'];
const TONE = ['any', '悬疑', '惊悚', '温情', '黑色幽默', '搞笑'];
const LV = [0, 25, 50, 75];
const MAX_LIBRARY = 3000;

export async function POST(req: Request) {
  const key = process.env.LINGER_BRIDGE_KEY || '';
  if (!key || req.headers.get('x-linger-key') !== key) return NextResponse.json({ ok: false }, { status: 401 });
  const admin = createAdminClient();
  const t0 = Date.now();
  const out: any = { voiced: 0, made: 0 };
  let voiceDead = false;
  const { data: qv } = await admin.from('app_kv').select('value').eq('key', 'soup_voice_quota').maybeSingle();
  if (qv?.value?.until && Date.now() < qv.value.until) voiceDead = true;

  // 1) 补配音（最多 3 道）
  if (!voiceDead) {
    const { data: rows } = await admin.from('soup_library').select('id, lang, surface, bottom, surface_audio, bottom_audio').or('surface_audio.is.null,bottom_audio.is.null').order('solved', { ascending: false }).limit(3);
    for (const r of rows || []) {
      if (Date.now() - t0 > 25000) break;
      try { await voicePuzzle(admin, r as any); out.voiced++; } catch (e: any) { if (e?.message === 'quota') { voiceDead = true; await admin.from('app_kv').upsert({ key: 'soup_voice_quota', value: { until: Date.now() + 3600000 } }); break; } }
    }
  }

  // 2) 新出题：挑题库里最少的组合，2 道并行
  const { count } = await admin.from('soup_library').select('id', { count: 'exact', head: true });
  if ((count || 0) < MAX_LIBRARY && Date.now() - t0 < 30000) {
    const { data: all } = await admin.from('soup_library').select('lang, difficulty, supernatural, tone').limit(5000);
    const tally: Record<string, number> = {};
    (all || []).forEach((r: any) => { const k = `${r.lang}|${r.difficulty}|${r.supernatural || 'any'}|${r.tone || 'any'}`; tally[k] = (tally[k] || 0) + 1; });
    const combos: any[] = [];
    for (const lang of ['zh', 'zh', 'zh', 'zh', 'en']) for (const d of DIFF) for (const sp of SUPER) for (const tn of TONE) combos.push({ lang, d, sp, tn, n: tally[`${lang}|${d}|${sp}|${tn}`] || 0, r: Math.random() });
    combos.sort((a, b) => a.n - b.n || a.r - b.r);
    const picks = combos.slice(0, 2);
    await Promise.all(picks.map(async (c) => {
      const gore = LV[Math.floor(Math.random() * LV.length)], horror = c.tn === '惊悚' ? 75 : LV[Math.floor(Math.random() * LV.length)], edge = [25, 50, 50, 75][Math.floor(Math.random() * 4)];
      try {
        const { data } = await callLLMJson<any>({
          system: buildSoupGenPrompt({ difficulty: c.d, supernatural: c.sp, tone: c.tn, gore, horror, edge }) + (c.lang === 'en' ? '\n' + langDirective('en') : ''),
          messages: [{ role: 'user', content: c.lang === 'en' ? 'Write one original lateral-thinking puzzle in English.' : '请出一道原创海龟汤。' }],
          tier: 'main', temperature: 0.9, maxTokens: 1200,
        });
        if (!data?.surface || !data?.bottom) return;
        const { data: dup } = await admin.from('soup_library').select('id').eq('surface', data.surface).maybeSingle();
        if (dup) return;
        const { data: row } = await admin.from('soup_library').insert({ lang: c.lang, title: data.title, surface: data.surface, bottom: data.bottom, difficulty: data.difficulty || c.d, supernatural: c.sp, tone: c.tn, gore, horror, edge, plays: 0, source: 'stock' }).select('id, lang, surface, bottom').single();
        out.made++;
        if (row && !voiceDead) { try { await voicePuzzle(admin, row as any); out.voiced++; } catch (e: any) { if (e?.message === 'quota') { voiceDead = true; await admin.from('app_kv').upsert({ key: 'soup_voice_quota', value: { until: Date.now() + 3600000 } }); } } }
      } catch {}
    }));
  }
  out.library = (count || 0) + out.made; out.ms = Date.now() - t0; out.voiceDead = voiceDead;
  return NextResponse.json({ ok: true, ...out });
}
