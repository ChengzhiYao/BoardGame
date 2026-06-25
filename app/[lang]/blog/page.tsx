import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { POSTS } from '@/lib/blog';
import { createAdminClient } from '@/lib/supabase/server';
import BlogGenerator from '@/components/BlogGenerator';

export const dynamic = 'force-dynamic';

export function generateMetadata({ params }: { params: { lang: string } }): Metadata {
  const en = params.lang === 'en';
  const title = en ? 'Blog · MystNight' : '博客 · 谜夜 MystNight';
  const description = en ? 'Guides and ideas on AI tabletop games — murder mystery, lateral thinking puzzles, games for two players, and more.' : '关于 AI 桌游的玩法与点子——剧本杀、海龟汤、两人桌游等。';
  const lang = en ? 'en' : 'zh';
  return { title, description, alternates: { canonical: `/${lang}/blog`, languages: { 'zh-CN': '/zh/blog', en: '/en/blog' } }, openGraph: { title, description, url: `/${lang}/blog`, type: 'website' } };
}

export default async function Blog({ params }: { params: { lang: string } }) {
  if (params.lang !== 'zh' && params.lang !== 'en') notFound();
  const en = params.lang === 'en';
  const lang = en ? 'en' : 'zh';
  let dbItems: { slug: string; title: string; excerpt: string; date: string }[] = [];
  try {
    const admin = createAdminClient();
    const { data } = await admin.from('blog_posts').select('slug,title,excerpt,created_at').eq('lang', lang).eq('published', true).order('created_at', { ascending: false });
    dbItems = (data || []).map((p: any) => ({ slug: p.slug, title: p.title, excerpt: p.excerpt || '', date: String(p.created_at || '').slice(0, 10) }));
  } catch {}
  const staticItems = POSTS.map((p) => { const t = en ? p.en : p.zh; return { slug: p.slug, title: t.title, excerpt: t.excerpt, date: p.date }; });
  const items = [...dbItems, ...staticItems];
  return (
    <main className="max-w-3xl mx-auto px-5 py-8">
      <h1 className="text-3xl font-serif text-parchment mb-2">{en ? 'Blog' : '博客'}</h1>
      <p className="text-parchment/55 mb-6">{en ? 'Guides and ideas on AI tabletop games.' : '关于 AI 桌游的玩法与点子。'}</p>
      <BlogGenerator lang={lang} />
      <div className="space-y-4">
        {items.map((p, i) => (
          <Link key={i} href={`/${lang}/blog/${p.slug}`} className="block rounded-xl border border-eldritch/20 bg-fog/30 hover:bg-fog/60 transition p-5">
            <div className="text-xs font-mono text-parchment/40 mb-1">{p.date}</div>
            <h2 className="text-parchment text-lg font-medium mb-1">{p.title}</h2>
            <p className="text-parchment/60 text-sm leading-relaxed">{p.excerpt}</p>
          </Link>
        ))}
      </div>
    </main>
  );
}
