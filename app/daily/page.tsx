import type { Metadata } from 'next';
import DailyClient from './DailyClient';
export const metadata: Metadata = { title: { absolute: '每日一汤 · 谜夜 MystNight' }, description: '每日一汤：全站每天同一道海龟汤，问得越少排名越高，免费、不剧透分享成绩。Daily Soup — one lateral thinking puzzle for everyone each day, with an AI host.', keywords: ['每日一汤', '海龟汤', '每日谜题', 'daily puzzle', 'lateral thinking puzzle'], alternates: { canonical: '/daily' }, openGraph: { title: '每日一汤 · 谜夜 MystNight', description: '全站每天同一道海龟汤，看谁问得最少。', url: '/daily' } };
export default function Daily() { return <DailyClient />; }
