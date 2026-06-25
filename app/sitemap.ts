import type { MetadataRoute } from 'next';
import { SLUGS } from '@/lib/seo-content';
import { POSTS } from '@/lib/blog';
const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.mystnight.com';
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const out: MetadataRoute.Sitemap = [
    { url: SITE, lastModified: now, changeFrequency: 'weekly', priority: 1 },
    { url: `${SITE}/upgrade`, lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
  ];
  for (const lang of ['zh', 'en']) {
    out.push({ url: `${SITE}/${lang}`, lastModified: now, changeFrequency: 'weekly', priority: 0.9 });
    out.push({ url: `${SITE}/${lang}/blog`, lastModified: now, changeFrequency: 'weekly', priority: 0.6 });
    for (const p of POSTS) out.push({ url: `${SITE}/${lang}/blog/${p.slug}`, lastModified: new Date(p.date), changeFrequency: 'monthly', priority: 0.5 });
  }
  for (const s of SLUGS) out.push({ url: `${SITE}/games/${s}`, lastModified: now, changeFrequency: 'monthly', priority: 0.8 });
  return out;
}
