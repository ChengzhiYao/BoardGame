import { NextResponse } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';
import { slugify } from '@/lib/blog/gen';

const ADMIN = (process.env.ADMIN_EMAIL || 'yxhzdm@gmail.com').toLowerCase();

export async function POST(req: Request) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email || user.email.toLowerCase() !== ADMIN) return NextResponse.json({ error: '仅管理员可用' }, { status: 403 });
  const b = await req.json().catch(() => ({} as any));
  const title = String(b.title || '').trim();
  const html = String(b.html || '').trim();
  const lang = b.lang === 'en' ? 'en' : 'zh';
  if (!title || !html) return NextResponse.json({ error: '缺少内容' }, { status: 400 });
  const admin = createAdminClient();
  let slug = slugify(String(b.slug || title));
  const { data: ex } = await admin.from('blog_posts').select('slug').eq('slug', slug).maybeSingle();
  if (ex) slug = slug + '-' + Date.now().toString(36).slice(-4);
  const { error } = await admin.from('blog_posts').insert({ slug, lang, title, excerpt: String(b.excerpt || '').slice(0, 300), body_html: html, score: typeof b.score === 'number' ? b.score : null, published: true });
  if (error) return NextResponse.json({ error: '保存失败' }, { status: 500 });
  return NextResponse.json({ ok: true, slug, url: `/${lang}/blog/${slug}` });
}
