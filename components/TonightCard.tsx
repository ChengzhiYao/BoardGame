// 大厅入口：今夜怪谈（每天一个免费恐怖故事）
import Icon from '@/components/Icon';
export default function TonightCard({ en }: { en: boolean }) {
  return (
    <a href="/tonight" className="group w-full rounded-2xl px-4 py-3 flex items-center gap-3.5 border border-[#e8a87c]/25 hover:border-[#e8a87c]/50 transition-colors" style={{ background: 'linear-gradient(100deg, rgba(160,60,40,.22), rgba(11,12,15,.7) 65%)' }}>
      <span className="shrink-0 w-10 h-10 rounded-xl flex items-center justify-center bg-[#e8a87c]/15 border border-[#e8a87c]/25 text-[#f2c09a]"><Icon n="candle" size={20} /></span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2"><span className="font-serif text-[15.5px] text-[#f7ecd8]">{en ? 'Tonight’s Ghost Story' : '今夜怪谈'}</span><span className="text-[10px] tracking-[.14em] text-[#9fbf9f]/85">{en ? 'FREE' : '免费'}</span></span>
        <span className="block text-[12px] text-parchment/55 truncate">{en ? 'A new voiced horror story every night — headphones on' : '每天一个新的恐怖故事，真人口吻、男女不同声音'}</span>
      </span>
      <span className="shrink-0 text-[#f2c09a] group-hover:translate-x-0.5 transition-transform"><Icon n="headphones" size={18} /></span>
    </a>
  );
}
