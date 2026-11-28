// 怪谈种子收集接口(给每天的定时收集任务用):GET 看库里已有的(查重)和统计;POST 存新种子。
// 需要请求头 x-seed-key = 环境变量 SEED_INGEST_KEY。只往 ghost_seeds 里加,不改不删。
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
export const dynamic = 'force-dynamic';

const ok = (req: Request) => { const k = process.env.SEED_INGEST_KEY; return !!k && req.headers.get('x-seed-key') === k; };
const SITES = ['zhihu', 'douban', 'tieba', 'weibo', 'xhs', 'bilibili', 'reddit', 'other'];

export async function GET(req: Request) {
  if (!ok(req)) return NextResponse.json({ ok: false }, { status: 401 });
  const admin = createAdminClient();
  const { data: seeds } = await admin.from('ghost_seeds').select('lang, title_hint, source_url, flavor, status').order('created_at', { ascending: false }).limit(400);
  const { data: stories } = await admin.from('ghost_stories').select('title, lang, status').order('created_at', { ascending: false }).limit(300);
  const count = (rows: any[], k: string) => rows.reduce((m: any, r: any) => { m[r[k]] = (m[r[k]] || 0) + 1; return m; }, {});
  return NextResponse.json({
    ok: true,
    seedStatus: count(seeds || [], 'status'), storyStatus: count(stories || [], 'status'), storiesTotal: (stories || []).length,
    recentSeeds: (seeds || []).map((s: any) => ({ lang: s.lang, title: s.title_hint, url: s.source_url, flavor: s.flavor })),
    recentStoryTitles: (stories || []).slice(0, 60).map((s: any) => s.title),
  });
}

export async function POST(req: Request) {
  if (!ok(req)) return NextResponse.json({ ok: false }, { status: 401 });
  const b = await req.json().catch(() => ({} as any));
  const rows = (Array.isArray(b?.seeds) ? b.seeds : []).slice(0, 60).map((s: any) => ({
    lang: s.lang === 'en' ? 'en' : 'zh',
    title_hint: String(s.title_hint || '').slice(0, 60),
    premise: String(s.premise || '').slice(0, 800),
    beats: String(s.beats || '').slice(0, 1200),
    setting: String(s.setting || '').slice(0, 200),
    source_site: SITES.includes(s.source_site) ? s.source_site : 'other',
    source_url: /^https?:\/\//.test(String(s.source_url || '')) ? String(s.source_url).slice(0, 500) : null,
    score: Math.max(1, Math.min(10, Math.round(Number(s.score) || 0))),
    flavor: s.flavor === 'cosmic' ? 'cosmic' : null,
    status: 'new',
  })).filter((r: any) => r.premise.length >= 20 && r.score >= 6 && r.source_url);
  if (!rows.length) return NextResponse.json({ ok: true, inserted: 0, skipped: 0 });
  const admin = createAdminClient();
  const { data: have } = await admin.from('ghost_seeds').select('source_url').in('source_url', rows.map((r: any) => r.source_url));
  const seen = new Set((have || []).map((h: any) => h.source_url));
  const fresh = rows.filter((r: any) => !seen.has(r.source_url) && (seen.add(r.source_url), true));
  if (fresh.length) { const { error } = await admin.from('ghost_seeds').insert(fresh); if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 }); }
  return NextResponse.json({ ok: true, inserted: fresh.length, skipped: rows.length - fresh.length });
}
