import type { MetadataRoute } from 'next';
import { SLUGS } from '@/lib/seo-content';
import { POSTS } from '@/lib/blog';
const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.mystnight.com';
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const out: MetadataRoute.Sitemap = [
    // 注意：裸根 "/" 会 302 跳到 /zh 或 /en，不放进 sitemap（避免被判为「重定向网页」）。
    { url: `${SITE}/upgrade`, lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
  ];
  for (const lang of ['zh', 'en']) {
    out.push({ url: `${SITE}/${lang}`, lastModified: now, changeFrequency: 'weekly', priority: 1 });
    out.push({ url: `${SITE}/${lang}/blog`, lastModified: now, changeFrequency: 'weekly', priority: 0.6 });
    for (const p of POSTS) out.push({ url: `${SITE}/${lang}/blog/${p.slug}`, lastModified: new Date(p.date), changeFrequency: 'monthly', priority: 0.5 });
    for (const s of SLUGS) out.push({ url: `${SITE}/${lang}/games/${s}`, lastModified: now, changeFrequency: 'monthly', priority: 0.8 });
  }
  return out;
}
