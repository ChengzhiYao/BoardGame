import type { Metadata } from 'next';
import MeClient from './MeClient';
export const metadata: Metadata = { title: { absolute: '我的收藏 · 谜夜 MystNight' }, robots: { index: false, follow: false } };
export default function Me() { return <MeClient />; }
