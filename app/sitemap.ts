import type { MetadataRoute } from 'next';
import { SLUGS } from '@/lib/seo-content';
import { POSTS } from '@/lib/blog';
import { createAdminClient } from '@/lib/supabase/server';
const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.mystnight.com';
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const out: MetadataRoute.Sitemap = [
    // 注意：裸根 "/" 会 302 跳到 /zh 或 /en，不放进 sitemap（避免被判为「重定向网页」）。
    { url: `${SITE}/daily`, lastModified: now, changeFrequency: 'daily', priority: 0.9 },
    { url: `${SITE}/tonight`, lastModified: now, changeFrequency: 'daily', priority: 0.9 },
    { url: `${SITE}/ranks`, lastModified: now, changeFrequency: 'daily', priority: 0.5 },
    { url: `${SITE}/market`, lastModified: now, changeFrequency: 'weekly', priority: 0.4 },
    { url: `${SITE}/upgrade`, lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
  ];
  for (const lang of ['zh', 'en']) {
    out.push({ url: `${SITE}/${lang}`, lastModified: now, changeFrequency: 'weekly', priority: 1 });
    out.push({ url: `${SITE}/${lang}/soup`, lastModified: now, changeFrequency: 'daily', priority: 0.9 });
    out.push({ url: `${SITE}/${lang}/blog`, lastModified: now, changeFrequency: 'weekly', priority: 0.6 });
    for (const p of POSTS) out.push({ url: `${SITE}/${lang}/blog/${p.slug}`, lastModified: new Date(p.date), changeFrequency: 'monthly', priority: 0.5 });
    for (const s of SLUGS) out.push({ url: `${SITE}/${lang}/games/${s}`, lastModified: now, changeFrequency: 'monthly', priority: 0.8 });
  }
  try {
    const admin = createAdminClient();
    const { data: posts } = await admin.from('blog_posts').select('slug, lang, created_at').eq('published', true).limit(500);
    const seen = new Set(POSTS.map((p) => p.slug));
    for (const p of posts || []) if (!seen.has(p.slug)) out.push({ url: `${SITE}/${p.lang}/blog/${p.slug}`, lastModified: new Date(p.created_at), changeFrequency: 'monthly', priority: 0.5 });
    const { data: soups } = await admin.from('soup_library').select('id, lang, created_at, title').not('title', 'is', null).limit(5000);
    for (const s of soups || []) out.push({ url: `${SITE}/${s.lang === 'en' ? 'en' : 'zh'}/soup/${s.id}`, lastModified: new Date(s.created_at), changeFrequency: 'monthly', priority: 0.6 });
  } catch {}
  return out;
}
