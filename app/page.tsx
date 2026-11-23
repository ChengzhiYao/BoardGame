// Root "/" — redirect to the localized homepage (/zh or /en).
// The real homepage lives in app/[lang]/page.tsx (renders <HomeApp/>), so
// / and /zh /en never diverge again.
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { createServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function Page() {
  // 老玩家（有登录态）直接进「我的大厅」
  try { const { data: { user } } = await createServerClient().auth.getUser(); if (user) redirect('/play'); } catch (e: any) { if (e?.digest?.startsWith?.('NEXT_REDIRECT')) throw e; }
  let lang: 'zh' | 'en' = 'zh';
  const c = cookies().get('lang')?.value;
  if (c === 'en' || c === 'zh') {
    lang = c;
  } else {
    const first = (headers().get('accept-language') || '').toLowerCase().split(',')[0] || '';
    lang = first.startsWith('en') ? 'en' : 'zh';
  }
  redirect('/' + lang);
}
