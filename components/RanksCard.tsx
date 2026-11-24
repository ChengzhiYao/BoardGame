'use client';
// 大厅里的排行榜入口：本周你排第几、超过了多少玩家
import { useEffect, useState } from 'react';
import Icon from '@/components/Icon';

export default function RanksCard({ en }: { en: boolean }) {
  const [d, setD] = useState<any>(null);
  useEffect(() => { fetch('/api/ranks?win=week').then((r) => r.json()).then(setD).catch(() => {}); }, []);
  const g = d?.cats?.games?.me, s = d?.cats?.solved?.me;
  const best = [g && g.rank ? ['games', g] : null, s && s.rank ? ['solved', s] : null].filter(Boolean).sort((a: any, b: any) => b[1].beat - a[1].beat)[0] as any;
  const top = d?.cats?.games?.top?.[0];
  const topName = top ? d.people?.[top.id]?.name : null;
  return (
    <a href="/ranks" className="group w-full rounded-2xl px-4 py-3 flex items-center gap-3.5 border border-[#e6c76e]/25 hover:border-[#e6c76e]/50 transition-colors" style={{ background: 'linear-gradient(100deg, rgba(230,199,110,.13), rgba(11,12,15,.7) 65%)' }}>
      <span className="shrink-0 w-10 h-10 rounded-xl flex items-center justify-center bg-[#e6c76e]/15 border border-[#e6c76e]/25 text-[#e6c76e]"><Icon n="trophy" size={20} /></span>
      <span className="min-w-0 flex-1">
        <span className="block font-serif text-[15.5px] text-[#f6ecd0]">{en ? 'Leaderboard' : '排行榜'}{best ? <span className="ml-2 text-[12px] text-[#e6c76e]">{en ? `#${best[1].rank} this week` : `本周第 ${best[1].rank} 名`}</span> : null}</span>
        <span className="block text-[12px] text-parchment/55 truncate">
          {!d ? '…' : best ? (en ? `Ahead of ${best[1].beat}% of players in ${best[0] === 'games' ? 'games played' : 'soups cracked'}` : `${best[0] === 'games' ? '游玩局数' : '猜中海龟汤'}超过了 ${best[1].beat}% 的玩家`)
            : topName ? (en ? `${topName} leads this week — can you catch up?` : `本周 ${topName} 领先，你能追上吗？`) : (en ? 'See who plays the most' : '看看谁玩得最多')}
        </span>
      </span>
      <span className="shrink-0 text-[#e6c76e] group-hover:translate-x-0.5 transition-transform">→</span>
    </a>
  );
}
