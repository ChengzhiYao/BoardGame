import { NextResponse } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';
import { callLLMJson } from '@/lib/llm';
import { slugify, buildBlogTranslatePrompt } from '@/lib/blog/gen';

export const maxDuration = 120;
const ADMIN = (process.env.ADMIN_EMAIL || 'yxhzdm@gmail.com').toLowerCase();

export async function POST(req: Request) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email || user.email.toLowerCase() !== ADMIN) return NextResponse.json({ error: '仅管理员可用' }, { status: 403 });
  const b = await req.json().catch(() => ({} as any));
  const title = String(b.title || '').trim();
  const html = String(b.html || '').trim();
  const excerpt = String(b.excerpt || '').slice(0, 300);
  const lang: 'zh' | 'en' = b.lang === 'en' ? 'en' : 'zh';
  const score = typeof b.score === 'number' ? b.score : null;
  if (!title || !html) return NextResponse.json({ error: '缺少内容' }, { status: 400 });

  const admin = createAdminClient();
  let slug = slugify(String(b.slug || title));
  const { data: ex } = await admin.from('blog_posts').select('id').eq('slug', slug).eq('lang', lang).maybeSingle();
  if (ex) slug = slug + '-' + Date.now().toString(36).slice(-4);

  const { error } = await admin.from('blog_posts').insert({ slug, lang, title, excerpt, body_html: html, score, published: true });
  if (error) return NextResponse.json({ error: '保存失败' }, { status: 500 });

  // 自动翻译/本地化成另一种语言，同一个 slug 存另一行（双语 + hreflang）
  const other: 'zh' | 'en' = lang === 'en' ? 'zh' : 'en';
  let translated = false;
  try {
    const tp = buildBlogTranslatePrompt(title, html, excerpt, other);
    const { data } = await callLLMJson<any>({ system: tp.system, messages: [{ role: 'user', content: tp.user }], tier: 'main', temperature: 0.3, maxTokens: 2800, retry: true });
    if (data?.title && data?.html) {
      const { data: ex2 } = await admin.from('blog_posts').select('id').eq('slug', slug).eq('lang', other).maybeSingle();
      if (!ex2) { const r = await admin.from('blog_posts').insert({ slug, lang: other, title: String(data.title), excerpt: String(data.excerpt || '').slice(0, 300), body_html: String(data.html), score, published: true }); translated = !r.error; }
    }
  } catch {}

  return NextResponse.json({ ok: true, slug, url: `/${lang}/blog/${slug}`, translated });
}
