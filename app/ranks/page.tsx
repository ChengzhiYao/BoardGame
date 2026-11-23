import type { Metadata } from 'next';
import RanksClient from './RanksClient';
export const metadata: Metadata = { title: { absolute: '排行榜 · 谜夜 MystNight' } };
export default function Ranks() { return <RanksClient />; }
