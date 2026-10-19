// 旧地址 /games/[slug] → 跳到带语言的 /zh|/en/games/[slug]（保留老链接可用）。
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { SEO_GAMES } from '@/lib/seo-content';

export const dynamicParams = false;
export function generateStaticParams() { return SEO_GAMES.map((g) => ({ slug: g.slug })); }

export default function Page({ params }: { params: { slug: string } }) {
  let lang: 'zh' | 'en' = 'zh';
  const c = cookies().get('lang')?.value;
  if (c === 'en' || c === 'zh') lang = c;
  else { const first = (headers().get('accept-language') || '').toLowerCase().split(',')[0] || ''; lang = first.startsWith('en') ? 'en' : 'zh'; }
  redirect(`/${lang}/games/${params.slug}`);
}
