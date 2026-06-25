import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { SEO_GAMES, seoGame } from '@/lib/seo-content';
import GameLanding from '@/components/GameLanding';

const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.mystnight.com';
export const dynamicParams = false;
export function generateStaticParams() { return SEO_GAMES.map((g) => ({ slug: g.slug })); }

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const g = seoGame(params.slug);
  if (!g) return {};
  const title = `${g.zh.name} · 谜夜 MystNight`;
  const description = g.zh.intro;
  const url = `/games/${g.slug}`;
  return {
    title,
    description,
    keywords: [g.zh.name, g.en.name, '谜夜', 'MystNight', 'AI', '在线', '桌游', 'AI 游戏主持'],
    alternates: { canonical: url },
    openGraph: { title, description, url, type: 'article', siteName: '谜夜 MystNight' },
    twitter: { card: 'summary_large_image', title, description },
  };
}

export default function Page({ params }: { params: { slug: string } }) {
  const g = seoGame(params.slug);
  if (!g) notFound();
  const jsonld = {
    '@context': 'https://schema.org', '@type': 'VideoGame',
    name: g.zh.name, alternateName: g.en.name, description: g.zh.intro,
    url: `${SITE}/games/${g.slug}`, applicationCategory: 'GameApplication', operatingSystem: 'Web',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  };
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonld) }} />
      <GameLanding slug={g.slug} />
    </>
  );
}
