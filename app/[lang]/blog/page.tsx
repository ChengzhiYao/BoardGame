import type { Metadata } from 'next';
import Link from 'next/link';
import { POSTS } from '@/lib/blog';

export const dynamicParams = false;
export function generateStaticParams() { return [{ lang: 'zh' }, { lang: 'en' }]; }

export function generateMetadata({ params }: { params: { lang: string } }): Metadata {
  const en = params.lang === 'en';
  const title = en ? 'Blog · MystNight' : '博客 · 谜夜 MystNight';
  const description = en ? 'Guides and ideas on AI tabletop games — murder mystery, lateral thinking puzzles, games for two players, and more.' : '关于 AI 桌游的玩法与点子——剧本杀、海龟汤、两人桌游等。';
  const lang = en ? 'en' : 'zh';
  return { title, description, alternates: { canonical: `/${lang}/blog`, languages: { 'zh-CN': '/zh/blog', en: '/en/blog' } }, openGraph: { title, description, url: `/${lang}/blog`, type: 'website' } };
}

export default function Blog({ params }: { params: { lang: string } }) {
  const en = params.lang === 'en';
  const lang = en ? 'en' : 'zh';
  return (
    <main className="max-w-3xl mx-auto px-5 py-8">
      <h1 className="text-3xl font-serif text-parchment mb-2">{en ? 'Blog' : '博客'}</h1>
      <p className="text-parchment/55 mb-8">{en ? 'Guides and ideas on AI tabletop games.' : '关于 AI 桌游的玩法与点子。'}</p>
      <div className="space-y-4">
        {POSTS.map((p) => {
          const t = en ? p.en : p.zh;
          return (
            <Link key={p.slug} href={`/${lang}/blog/${p.slug}`} className="block rounded-xl border border-eldritch/20 bg-fog/30 hover:bg-fog/60 transition p-5">
              <div className="text-xs font-mono text-parchment/40 mb-1">{p.date}</div>
              <h2 className="text-parchment text-lg font-medium mb-1">{t.title}</h2>
              <p className="text-parchment/60 text-sm leading-relaxed">{t.excerpt}</p>
            </Link>
          );
        })}
      </div>
    </main>
  );
}
