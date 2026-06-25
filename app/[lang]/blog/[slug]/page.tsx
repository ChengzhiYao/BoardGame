import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { POSTS, post } from '@/lib/blog';

const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.mystnight.com';
export const dynamicParams = false;
export function generateStaticParams() {
  const out: { lang: string; slug: string }[] = [];
  for (const l of ['zh', 'en']) for (const p of POSTS) out.push({ lang: l, slug: p.slug });
  return out;
}

export function generateMetadata({ params }: { params: { lang: string; slug: string } }): Metadata {
  const p = post(params.slug); if (!p) return {};
  const en = params.lang === 'en';
  const t = en ? p.en : p.zh;
  const lang = en ? 'en' : 'zh';
  return { title: `${t.title} · 谜夜 MystNight`, description: t.excerpt, alternates: { canonical: `/${lang}/blog/${p.slug}`, languages: { 'zh-CN': `/zh/blog/${p.slug}`, en: `/en/blog/${p.slug}` } }, openGraph: { title: t.title, description: t.excerpt, url: `/${lang}/blog/${p.slug}`, type: 'article' } };
}

export default function PostPage({ params }: { params: { lang: string; slug: string } }) {
  const p = post(params.slug); if (!p) notFound();
  const en = params.lang === 'en';
  const lang = en ? 'en' : 'zh';
  const t = en ? p.en : p.zh;
  const jsonld = { '@context': 'https://schema.org', '@type': 'Article', headline: t.title, description: t.excerpt, datePublished: p.date, inLanguage: en ? 'en' : 'zh-CN', mainEntityOfPage: `${SITE}/${lang}/blog/${p.slug}`, author: { '@type': 'Organization', name: 'MystNight' } };
  return (
    <main className="max-w-3xl mx-auto px-5 py-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonld) }} />
      <nav className="text-xs text-parchment/40 mb-5"><Link href={`/${lang}/blog`} className="hover:text-parchment">{en ? 'Blog' : '博客'}</Link> / <span className="text-parchment/60">{t.title}</span></nav>
      <div className="text-xs font-mono text-parchment/40 mb-2">{p.date}</div>
      <h1 className="text-3xl font-serif text-parchment leading-tight mb-6">{t.title}</h1>
      <div className="blog-body text-parchment/80 leading-relaxed space-y-4" dangerouslySetInnerHTML={{ __html: t.html }} />
      <div className="mt-10 pt-6 border-t border-eldritch/15">
        <Link href="/#games" className="inline-block px-6 py-3 rounded bg-blood/80 hover:bg-blood text-parchment border border-blood">{en ? '▶ Play now' : '▶ 开始玩'}</Link>
      </div>
    </main>
  );
}
