import type { Metadata } from 'next';
const title = 'MystNight 推广计划 · Partner Program';
const description = '用你的专属链接推荐谜夜 MystNight,通过链接注册的玩家前 3 个月每一笔付款你都拿 40%。Share MystNight with your own link and earn 40% of every payment from players you refer for their first 3 months.';
export const metadata: Metadata = { title, description, alternates: { canonical: '/partner' }, openGraph: { title, description, siteName: 'MystNight', type: 'website' } };
export default function L({ children }: { children: React.ReactNode }) { return children; }
