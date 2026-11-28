import type { Metadata } from 'next';
// 合作伙伴后台:只对站长手动加进来的合作方开放,不公开、不让搜索引擎收录
export const metadata: Metadata = { title: 'Partner', robots: { index: false, follow: false } };
export default function L({ children }: { children: React.ReactNode }) { return children; }
