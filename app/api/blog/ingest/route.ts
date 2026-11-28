// 每天的 SEO 文章任务用:GET 看已有文章(查重);POST 发一篇(自动再翻成另一种语言,同 slug 存两行)。
// 需要请求头 x-seed-key = 环境变量 SEED_INGEST_KEY。只新增,不改不删。
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { callLLMJson } from '@/lib/llm';
import { slugify, buildBlogTranslatePrompt } from '@/lib/blog/gen';
import { POSTS } from '@/lib/blog';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const ok = (req: Request) => { const k = process.env.SEED_INGEST_KEY; return !!k && req.headers.get('x-seed-key') === k; };
// 只留排版用的标签,去掉脚本、事件属性、iframe 等
function clean(html: string): string {
  return String(html || '')
    .replace(/<\s*(script|style|iframe|object|embed|form|input|button)[\s\S]*?(<\/\s*\1\s*>|\/>|$)/gi, '')
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/(href|src)\s*=\s*("|')\s*javascript:[^"']*\2/gi, '$1="#"')
    .slice(0, 40000);
}

export async function GET(req: Request) {
  if (!ok(req)) return NextResponse.json({ ok: false }, { status: 401 });
  const { data } = await createAdminClient().from('blog_posts').select('slug, lang, title, created_at').order('created_at', { ascending: false }).limit(300);
  return NextResponse.json({ ok: true, posts: data || [], builtIn: POSTS.map((p: any) => ({ slug: p.slug, title: p.title })) });
}

export async function POST(req: Request) {
  if (!ok(req)) return NextResponse.json({ ok: false }, { status: 401 });
  const b = await req.json().catch(() => ({} as any));
  const title = String(b.title || '').trim().slice(0, 120); const html = clean(b.html); const excerpt = String(b.excerpt || '').slice(0, 300);
  const lang: 'zh' | 'en' = b.lang === 'en' ? 'en' : 'zh';
  if (!title || html.length < 600) return NextResponse.json({ ok: false, error: 'need title and html (>=600 chars)' }, { status: 400 });
  const admin = createAdminClient();
  const slug = slugify(String(b.slug || title));
  const { data: ex } = await admin.from('blog_posts').select('id').eq('slug', slug).maybeSingle();
  if (ex || POSTS.some((p: any) => p.slug === slug)) return NextResponse.json({ ok: false, error: 'slug exists' }, { status: 409 });
  const { error } = await admin.from('blog_posts').insert({ slug, lang, title, excerpt, body_html: html, score: null, published: true });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  let translated = false;
  try {
    const other: 'zh' | 'en' = lang === 'en' ? 'zh' : 'en';
    const tp = buildBlogTranslatePrompt(title, html, excerpt, other);
    const { data } = await callLLMJson<any>({ system: tp.system, messages: [{ role: 'user', content: tp.user }], tier: 'main', temperature: 0.3, maxTokens: 2800, retry: true });
    if (data?.title && data?.html) { const r = await admin.from('blog_posts').insert({ slug, lang: other, title: String(data.title).slice(0, 120), excerpt: String(data.excerpt || '').slice(0, 300), body_html: clean(data.html), score: null, published: true }); translated = !r.error; }
  } catch {}
  return NextResponse.json({ ok: true, slug, url: `https://www.mystnight.com/${lang}/blog/${slug}`, translated });
}
