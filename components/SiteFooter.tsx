// 全站页脚：给搜索引擎和人都留好内部链接
import Link from 'next/link';
import { SEO_GAMES } from '@/lib/seo-content';

export default function SiteFooter({ lang }: { lang: 'zh' | 'en' }) {
  const en = lang === 'en';
  return (
    <footer className="w-full border-t border-white/[0.07] mt-10">
      <div className="max-w-4xl mx-auto px-5 py-10 grid grid-cols-2 sm:grid-cols-4 gap-6 text-[13px] text-left">
        <div>
          <div className="text-parchment/40 text-[11px] tracking-[.2em] mb-2">{en ? 'GAMES' : '玩法'}</div>
          <ul className="space-y-1.5">{SEO_GAMES.map((g) => <li key={g.slug}><Link href={`/${lang}/games/${g.slug}`} className="text-parchment/65 hover:text-parchment">{en ? g.en.name : g.zh.name}</Link></li>)}</ul>
        </div>
        <div>
          <div className="text-parchment/40 text-[11px] tracking-[.2em] mb-2">{en ? 'PLAY' : '每天玩'}</div>
          <ul className="space-y-1.5">
            <li><Link href="/daily" className="text-parchment/65 hover:text-parchment">{en ? 'Daily Soup' : '每日一汤'}</Link></li>
            <li><Link href={`/${lang}/soup`} className="text-parchment/65 hover:text-parchment">{en ? 'Lateral thinking puzzles' : '海龟汤题库'}</Link></li>
            <li><Link href="/ranks" className="text-parchment/65 hover:text-parchment">{en ? 'Leaderboard' : '排行榜'}</Link></li>
            <li><Link href="/market" className="text-parchment/65 hover:text-parchment">{en ? 'The Market' : '身价场'}</Link></li>
          </ul>
        </div>
        <div>
          <div className="text-parchment/40 text-[11px] tracking-[.2em] mb-2">{en ? 'READ' : '读一读'}</div>
          <ul className="space-y-1.5">
            <li><Link href={`/${lang}/blog`} className="text-parchment/65 hover:text-parchment">{en ? 'Blog' : '博客'}</Link></li>
            <li><Link href="/upgrade" className="text-parchment/65 hover:text-parchment">{en ? 'Pricing' : '价格'}</Link></li>
          </ul>
        </div>
        <div>
          <div className="font-serif text-[17px] text-[#efe6d2]">{en ? 'MystNight' : '谜夜'}</div>
          <p className="mt-1 text-[12px] leading-[1.7] text-parchment/45">{en ? 'AI-hosted murder mysteries, Call of Cthulhu, lateral thinking puzzles and party games — in your browser.' : 'AI 主持的剧本杀、克苏鲁跑团、海龟汤和派对游戏，打开浏览器就能玩。'}</p>
          <Link href={en ? '/zh' : '/en'} className="mt-2 inline-block text-[12px] text-[#c9a96e]">{en ? '中文' : 'English'}</Link>
        </div>
      </div>
      <div className="text-center text-[11px] text-parchment/30 pb-8">© {new Date().getFullYear()} MystNight 谜夜</div>
    </footer>
  );
}
