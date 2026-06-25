import type { MetadataRoute } from 'next';
import { SLUGS } from '@/lib/seo-content';
const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.mystnight.com';
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: SITE, lastModified: now, changeFrequency: 'weekly', priority: 1 },
    { url: `${SITE}/upgrade`, lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    ...SLUGS.map((s) => ({ url: `${SITE}/games/${s}`, lastModified: now, changeFrequency: 'monthly' as const, priority: 0.8 })),
  ];
}
