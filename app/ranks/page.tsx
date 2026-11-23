import type { Metadata } from 'next';
import RanksClient from './RanksClient';
export const metadata: Metadata = { title: { absolute: '排行榜 · 谜夜 MystNight' }, description: '谜夜玩家排行榜：游玩局数、海龟汤猜中数、猜中率、每日一汤和结局数，看看你超过了多少玩家。', alternates: { canonical: '/ranks' } };
export default function Ranks() { return <RanksClient />; }
