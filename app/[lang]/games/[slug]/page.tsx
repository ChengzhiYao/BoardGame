import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { SEO_GAMES, seoGame } from '@/lib/seo-content';
import GameLanding from '@/components/GameLanding';

const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.mystnight.com';
export const dynamicParams = false;
export function generateStaticParams() {
  const out: { lang: string; slug: string }[] = [];
  for (const lang of ['zh', 'en']) for (const g of SEO_GAMES) out.push({ lang, slug: g.slug });
  return out;
}

export function generateMetadata({ params }: { params: { lang: string; slug: string } }): Metadata {
  const g = seoGame(params.slug);
  if (!g) return {};
  const en = params.lang === 'en';
  const loc = en ? g.en : g.zh;
  const title = loc.name; // 品牌后缀由 layout 模板统一追加
  const description = loc.intro;
  const path = `/${params.lang}/games/${g.slug}`;
  return {
    title,
    description,
    keywords: [g.zh.name, g.en.name, '谜夜', 'MystNight', 'AI', en ? 'online game' : '在线桌游', 'AI game master'],
    alternates: {
      canonical: path,
      languages: { 'zh-CN': `/zh/games/${g.slug}`, en: `/en/games/${g.slug}`, 'x-default': `/en/games/${g.slug}` },
    },
    openGraph: { title, description, url: path, type: 'article', siteName: '谜夜 MystNight', locale: en ? 'en_US' : 'zh_CN' },
    twitter: { card: 'summary_large_image', title, description },
  };
}

export default function Page({ params }: { params: { lang: string; slug: string } }) {
  const g = seoGame(params.slug);
  if (!g) notFound();
  const en = params.lang === 'en';
  const loc = en ? g.en : g.zh;
  const url = `${SITE}/${params.lang}/games/${g.slug}`;
  const jsonld = [
    {
      '@context': 'https://schema.org', '@type': 'VideoGame',
      name: loc.name, alternateName: en ? g.zh.name : g.en.name, description: loc.intro,
      url, applicationCategory: 'GameApplication', operatingSystem: 'Web', gamePlatform: 'Web Browser',
      inLanguage: en ? 'en' : 'zh-CN', numberOfPlayers: loc.players,
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    },
    {
      '@context': 'https://schema.org', '@type': 'FAQPage',
      mainEntity: loc.faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
    },
  ];
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonld) }} />
      <GameLanding slug={g.slug} forcedLang={en ? 'en' : 'zh'} />
    </>
  );
}
