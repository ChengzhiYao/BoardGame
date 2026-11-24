import type { Metadata } from 'next';
import TonightClient from './TonightClient';
import { createAdminClient } from '@/lib/supabase/server';
import { tonight, publicStory } from '@/lib/ghost';
export const revalidate = 600;
export const metadata: Metadata = {
  title: { absolute: '今夜怪谈 · 每天一个免费恐怖故事 · 谜夜 MystNight' },
  description: '每天一个新的真人口吻恐怖故事，男女角色不同声音，像朋友深夜给你发语音讲他遇到的怪事。免费收听，不用下载。Tonight’s Ghost Story — a free voiced horror story every night.',
  keywords: ['恐怖故事', '鬼故事', '睡前恐怖故事', '有声鬼故事', '真实灵异故事', '怪谈', 'scary stories', 'ghost stories audio'],
  alternates: { canonical: '/tonight' },
  openGraph: { title: '今夜怪谈 · 每天一个免费恐怖故事', description: '像朋友深夜给你发语音讲他遇到的怪事。', url: '/tonight' },
};
export default async function Tonight() {
  let initial: any = null;
  try { const t = await tonight(createAdminClient(), 'zh'); if (t) initial = publicStory(t, true); } catch {}
  return <TonightClient initial={initial} />;
}
