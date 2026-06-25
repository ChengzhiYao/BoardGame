import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { post } from '@/lib/blog';
import { createAdminClient } from '@/lib/supabase/server';
import { unstable_noStore as noStore } from 'next/cache';

const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.mystnight.com';
export const dynamic = 'force-dynamic';

async function resolve(lang: 'zh' | 'en', slug: string) {
  noStore();
  const sp = post(slug);
  if (sp) { const t = lang === 'en' ? sp.en : sp.zh; return { title: t.title, excerpt: t.excerpt, date: sp.date, html: t.html }; }
  try {
    const admin = createAdminClient();
    const { data } = await admin.from('blog_posts').select('title,excerpt,body_html,created_at').eq('slug', slug).eq('lang', lang).eq('published', true).maybeSingle();
    if (data) return { title: data.title, excerpt: data.excerpt || '', date: String(data.created_at || '').slice(0, 10), html: data.body_html };
  } catch {}
  return null;
}

export async function generateMetadata({ params }: { params: { lang: string; slug: string } }): Promise<Metadata> {
  const lang = params.lang === 'en' ? 'en' : 'zh';
  const r = await resolve(lang, params.slug);
  if (!r) return {};
  return { title: `${r.title} · 谜夜 MystNight`, description: r.excerpt, alternates: { canonical: `/${lang}/blog/${params.slug}`, languages: { 'zh-CN': `/zh/blog/${params.slug}`, en: `/en/blog/${params.slug}` } }, openGraph: { title: r.title, description: r.excerpt, type: 'article', url: `/${lang}/blog/${params.slug}` } };
}

export default async function PostPage({ params }: { params: { lang: string; slug: string } }) {
  if (params.lang !== 'zh' && params.lang !== 'en') notFound();
  const lang = params.lang === 'en' ? 'en' : 'zh';
  const en = lang === 'en';
  const r = await resolve(lang, params.slug);
  if (!r) notFound();
  const jsonld = { '@context': 'https://schema.org', '@type': 'Article', headline: r.title, description: r.excerpt, datePublished: r.date, inLanguage: en ? 'en' : 'zh-CN', mainEntityOfPage: `${SITE}/${lang}/blog/${params.slug}`, author: { '@type': 'Organization', name: 'MystNight' } };
  return (
    <main className="max-w-3xl mx-auto px-5 py-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonld) }} />
      <nav className="text-xs text-parchment/40 mb-5"><Link href={`/${lang}/blog`} className="hover:text-parchment">{en ? 'Blog' : '博客'}</Link> / <span className="text-parchment/60">{r.title}</span></nav>
      <div className="text-xs font-mono text-parchment/40 mb-2">{r.date}</div>
      <h1 className="text-3xl font-serif text-parchment leading-tight mb-6">{r.title}</h1>
      <div className="blog-body text-parchment/80 leading-relaxed space-y-4" dangerouslySetInnerHTML={{ __html: r.html }} />
      <div className="mt-10 pt-6 border-t border-eldritch/15">
        <Link href="/#games" className="inline-block px-6 py-3 rounded bg-blood/80 hover:bg-blood text-parchment border border-blood">{en ? '▶ Play now' : '▶ 开始玩'}</Link>
      </div>
    </main>
  );
}
