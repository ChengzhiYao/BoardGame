'use client';
// 选故事时的专属故事卡：每种题材一套配色、纹理和图标，像一本书的封面。
import Icon from '@/components/Icon';

type Theme = { c: string; c2: string; icon: string; zh: string; en: string; tex: string };
const THEMES: { re: RegExp; t: Theme }[] = [
  { re: /怪谈|恐怖|灵异|惊悚|鬼|horror|ghost|eerie|creep/i, t: { c: '#e0574d', c2: '#3a0d0d', icon: 'ghost', zh: '怪谈', en: 'Horror', tex: 'repeating-linear-gradient(180deg, rgba(255,255,255,.025) 0 1px, transparent 1px 4px)' } },
  { re: /悬疑|推理|侦探|犯罪|mystery|detective|crime|thriller/i, t: { c: '#6fb7d9', c2: '#0b2230', icon: 'eye', zh: '悬疑', en: 'Mystery', tex: 'repeating-linear-gradient(135deg, rgba(255,255,255,.03) 0 1px, transparent 1px 9px)' } },
  { re: /科幻|未来|太空|赛博|sci-?fi|space|cyber|future/i, t: { c: '#8c9bff', c2: '#12163a', icon: 'spiral', zh: '科幻', en: 'Sci‑fi', tex: 'radial-gradient(rgba(255,255,255,.18) 1px, transparent 1.2px) 0 0/18px 18px' } },
  { re: /奇幻|魔法|神话|童话|fantasy|myth|magic|fairy/i, t: { c: '#e6c76e', c2: '#2a2108', icon: 'sparkle', zh: '奇幻', en: 'Fantasy', tex: 'radial-gradient(rgba(230,199,110,.22) 1px, transparent 1.4px) 0 0/26px 26px' } },
  { re: /爱情|甜|恋|心动|romance|love/i, t: { c: '#ee9ab8', c2: '#361322', icon: 'heart', zh: '心动', en: 'Romance', tex: 'radial-gradient(circle at 20% 30%, rgba(238,154,184,.12), transparent 40%)' } },
  { re: /治愈|温情|温暖|日常|healing|cozy|warm|slice/i, t: { c: '#8fd3b8', c2: '#0e2a22', icon: 'sun', zh: '治愈', en: 'Healing', tex: 'radial-gradient(circle at 80% 10%, rgba(143,211,184,.14), transparent 45%)' } },
  { re: /武侠|古风|历史|江湖|宫|wuxia|history|historical/i, t: { c: '#d2a679', c2: '#2b1c0e', icon: 'scroll', zh: '古风', en: 'Historical', tex: 'repeating-linear-gradient(90deg, rgba(255,255,255,.02) 0 2px, transparent 2px 7px)' } },
];
const DEF: Theme = { c: '#c9a96e', c2: '#1d1810', icon: 'feather', zh: '故事', en: 'Story', tex: 'none' };
// 题材里最先出现的那个词决定配色(「科幻 悬疑」按科幻)
export const storyTheme = (o: any): Theme => {
  const txt = `${o.genre || ''} ${o.mood || ''} ${o.title || ''}`;
  let best: Theme | null = null, at = Infinity;
  for (const x of THEMES) { const m = txt.search(x.re); if (m >= 0 && m < at) { at = m; best = x.t; } }
  return best || DEF;
};

export default function StoryCard({ o, i, en, canEdit, busy, onPick }: { o: any; i: number; en: boolean; canEdit: boolean; busy: boolean; onPick: () => void }) {
  const t = storyTheme(o);
  const score = Number(o.appeal) || 0;
  return (
    <button onClick={canEdit && !busy ? onPick : undefined} disabled={!canEdit || busy}
      className="sc-in group relative w-full text-left overflow-hidden rounded-[22px] border transition-transform duration-300 active:scale-[0.985] disabled:cursor-default"
      style={{ borderColor: t.c + '40', background: `radial-gradient(130% 90% at 100% 0%, ${t.c}30, transparent 55%), linear-gradient(160deg, ${t.c2} 0%, #0b0c0f 70%)`, animationDelay: `${i * 90}ms`, boxShadow: `0 20px 50px -28px ${t.c}66` }}>
      <span aria-hidden className="absolute inset-0 opacity-70 pointer-events-none" style={{ background: t.tex }} />
      <span aria-hidden className="absolute -right-8 -bottom-10 opacity-[0.10] pointer-events-none transition-transform duration-700 group-hover:scale-110" style={{ color: t.c }}><Icon n={t.icon} size={190} stroke={0.9} /></span>
      <span aria-hidden className="absolute left-0 top-0 bottom-0 w-[3px]" style={{ background: `linear-gradient(${t.c}, transparent)` }} />
      <div className="relative px-5 pt-4 pb-5">
        <div className="flex items-center gap-2 text-[10.5px] tracking-[.28em] uppercase" style={{ color: t.c }}>
          <Icon n={t.icon} size={13} />
          <span>{en ? t.en : t.zh}</span>
          <span className="opacity-40">/</span>
          <span className="tracking-[.18em] opacity-75">No.{String(i + 1).padStart(2, '0')}</span>
          <span className="flex-1" />
          {o.real && <span className="tracking-[.12em] normal-case px-2 py-0.5 rounded-full border text-[10.5px]" style={{ borderColor: '#8fd3b8' + '66', color: '#8fd3b8' }}>{en ? 'TRUE STORY' : '真实经历'}</span>}
          {o.fromLibrary && !o.real && <span className="tracking-[.12em] normal-case px-2 py-0.5 rounded-full border border-[#e6c76e]/50 text-[#e6c76e] text-[10.5px]">{en ? 'CURATED' : '精选'}</span>}
        </div>
        <h3 className="mt-3 font-serif font-semibold text-[23px] leading-[1.25] text-[#f7ecd8] [text-shadow:0_2px_24px_rgba(0,0,0,.8)]">{o.title}</h3>
        <p className="mt-2.5 font-serif text-[14.5px] leading-[1.8] text-parchment/75 line-clamp-4">{o.logline}</p>
        <div className="mt-4 flex items-center gap-3 text-[11.5px] text-parchment/50">
          {o.genre && <span className="truncate max-w-[45%]">{o.genre}</span>}
          {o.mood && <><span className="w-[3px] h-[3px] rotate-45 bg-current opacity-60" /><span className="truncate">{o.mood}</span></>}
          <span className="w-[3px] h-[3px] rotate-45 bg-current opacity-60" />
          <span className="inline-flex items-center gap-1"><Icon n="clock" size={12} />{o.est_minutes || 10} min</span>
          <span className="flex-1" />
          {score > 0 && <span className="inline-flex items-baseline gap-1" title={o.fromLibrary ? (en ? 'Precise rating' : '成稿精确评分') : (en ? 'Premise appeal' : '开场卖相分')}><span className="font-serif text-[18px] leading-none" style={{ color: t.c }}>{score}</span><span className="text-[10px] opacity-70">{o.fromLibrary ? (en ? 'score' : '分') : (en ? 'appeal' : '卖相')}</span></span>}
        </div>
        {canEdit && (
          <div className="mt-4 flex items-center justify-between rounded-xl px-3.5 py-2.5 border transition-colors" style={{ borderColor: t.c + '45', background: t.c + '12' }}>
            <span className="text-[13px] text-parchment/85">{busy ? (en ? 'Writing…' : '正在写…') : (en ? 'Tell me this one' : '就讲这个')}</span>
            <span className="text-[13px] transition-transform group-hover:translate-x-1" style={{ color: t.c }}>→</span>
          </div>
        )}
      </div>
    </button>
  );
}
export const STORY_CARD_CSS = `@keyframes scIn{from{opacity:0;transform:translateY(14px) scale(.985)}to{opacity:1;transform:none}}.sc-in{animation:scIn .6s cubic-bezier(.2,.7,.2,1) both}`;
