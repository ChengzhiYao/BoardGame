import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { callLLMJson } from '@/lib/llm';
import { buildBlogWritePrompt, buildBlogRatePrompt, normalizeBlogRating, slugify } from '@/lib/blog/gen';

export const maxDuration = 120;
const ADMIN = (process.env.ADMIN_EMAIL || 'yxhzdm@gmail.com').toLowerCase();

export async function POST(req: Request) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email || user.email.toLowerCase() !== ADMIN) return NextResponse.json({ error: '仅管理员可用' }, { status: 403 });
  const { topic, keywords, lang } = await req.json().catch(() => ({} as any));
  if (!topic || !String(topic).trim()) return NextResponse.json({ error: '请填写主题' }, { status: 400 });
  const L = lang === 'en' ? 'en' : 'zh';
  const wp = buildBlogWritePrompt(String(topic).trim(), String(keywords || '').trim(), L);

  async function gen(temp: number) {
    try {
      const { data } = await callLLMJson<any>({ system: wp.system, messages: [{ role: 'user', content: wp.user }], tier: 'main', temperature: temp, maxTokens: 2600, retry: true });
      const html = String(data.html || '').trim();
      const title = String(data.title || '').trim();
      if (!html || !title) return null;
      const rp = buildBlogRatePrompt(title, html, String(keywords || topic), L);
      let rating: any = {};
      try { const r = await callLLMJson<any>({ system: rp.system, messages: [{ role: 'user', content: rp.user }], tier: 'aux', temperature: 0.2, maxTokens: 1200, retry: true }); rating = normalizeBlogRating(r.data); } catch {}
      return { title, slug: slugify(String(data.slug || title)), excerpt: String(data.excerpt || '').slice(0, 300), html, lang: L, rating };
    } catch { return null; }
  }

  const cands = (await Promise.all([gen(0.8), gen(1.0)])).filter(Boolean) as any[];
  if (!cands.length) return NextResponse.json({ error: '生成失败，请重试' }, { status: 502 });
  cands.sort((a, b) => (b.rating?.overall || 0) - (a.rating?.overall || 0));
  return NextResponse.json({ ok: true, draft: cands[0] });
}
