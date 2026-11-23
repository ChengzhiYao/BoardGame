import type { Metadata } from 'next';
import PlayHub from '@/components/PlayHub';
export const metadata: Metadata = { title: { absolute: '我的大厅 · 谜夜 MystNight' }, robots: { index: false, follow: false } };
export default function Play() { return <PlayHub />; }
