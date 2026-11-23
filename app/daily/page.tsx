import type { Metadata } from 'next';
import DailyClient from './DailyClient';
export const metadata: Metadata = { title: { absolute: '每日一汤 · 谜夜 MystNight' }, description: '全站每天同一道海龟汤，看谁问得最少。Same lateral-thinking puzzle for everyone, every day.' };
export default function Daily() { return <DailyClient />; }
