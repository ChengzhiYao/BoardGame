'use client';
// 剧本杀的美术：按剧本的时代 / 题材挑一整套视觉（人物卡、剧本纸、幕标题），不用千篇一律的系统界面。
// 全部是排版 + CSS/SVG 纹样，零成本。
import type { CSSProperties, ReactNode } from 'react';

export type Look = {
  key: 'deco' | 'ancient' | 'manor' | 'dossier' | 'wa' | 'dread';
  accent: string;           // 主色
  ink: string;              // 卡片正文颜色
  card: CSSProperties;      // 人物卡底
  paper: CSSProperties;     // 剧本纸
  paperInk: string;         // 剧本纸上的字色
  nameCls: string;          // 名字字体/排布
  label: (en: boolean) => string; // 卡片上方的小字
  corner?: ReactNode;       // 角花
};

const svg = (s: string) => `url("data:image/svg+xml,${encodeURIComponent(s)}")`;
const FAN = (c: string) => <svg viewBox="0 0 40 40" className="w-7 h-7"><g fill="none" stroke={c} strokeWidth="1"><path d="M2 2h14M2 2v14" /><path d="M2 2l12 12" /><path d="M6 2a10 10 0 0 0 -4 4" /><path d="M10 2a14 14 0 0 0 -8 8" /></g></svg>;
const PAPER_GRAIN = svg(`<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.8' numOctaves='3' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 .35  0 0 0 0 .27  0 0 0 0 .18  0 0 0 .22 0'/></filter><rect width='100%' height='100%' filter='url(#n)'/></svg>`);
const DECO_LINES = 'repeating-linear-gradient(135deg, rgba(212,175,95,.05) 0 1px, transparent 1px 14px)';
const SEIGAIHA = svg(`<svg xmlns='http://www.w3.org/2000/svg' width='40' height='20'><g fill='none' stroke='#a9b8e0' stroke-opacity='.10'><circle cx='20' cy='20' r='18'/><circle cx='20' cy='20' r='12'/><circle cx='0' cy='10' r='18'/><circle cx='40' cy='10' r='18'/></g></svg>`);

const LOOKS: Record<Look['key'], Look> = {
  deco: {
    key: 'deco', accent: '#d4af5f', ink: '#efe2c4',
    card: { background: `${DECO_LINES}, linear-gradient(180deg,#17130c,#0c0b09)`, border: '1px solid rgba(212,175,95,.45)', boxShadow: 'inset 0 0 0 4px #0c0b09, inset 0 0 0 5px rgba(212,175,95,.35)' },
    paper: { background: `${DECO_LINES}, linear-gradient(180deg,#16120b,#0d0c0a)`, border: '1px solid rgba(212,175,95,.35)' }, paperInk: '#eadbb8',
    nameCls: 'font-serif tracking-[.18em]', label: (en) => (en ? 'DRAMATIS PERSONAE' : '登 场 人 物'), corner: FAN('rgba(212,175,95,.7)'),
  },
  ancient: {
    key: 'ancient', accent: '#b8322a', ink: '#2a2118',
    card: { background: `${PAPER_GRAIN}, linear-gradient(180deg,#efe5cf,#ddd0b2)`, border: '1px solid rgba(60,40,20,.35)', boxShadow: 'inset 0 0 30px rgba(120,90,50,.25)' },
    paper: { background: `${PAPER_GRAIN}, linear-gradient(180deg,#eee3cb,#dccfae)`, border: '1px solid rgba(60,40,20,.3)' }, paperInk: '#2e241a',
    nameCls: 'font-serif tracking-[.3em]', label: (en) => (en ? 'PORTRAIT' : '人 物 志'),
  },
  manor: {
    key: 'manor', accent: '#a8423a', ink: '#ecdcc0',
    card: { background: `${PAPER_GRAIN}, radial-gradient(120% 90% at 50% 0%, #3a2a1d, #1a120c)`, border: '1px solid rgba(201,160,100,.35)' },
    paper: { background: `${PAPER_GRAIN}, linear-gradient(180deg,#2e2117,#1a120c)`, border: '1px solid rgba(201,160,100,.3)' }, paperInk: '#ead8b8',
    nameCls: 'font-serif italic tracking-[.06em]', label: (en) => (en ? 'THE HOUSEHOLD' : '庄 园 名 册'),
  },
  dossier: {
    key: 'dossier', accent: '#d9d4c7', ink: '#e7e4dc',
    card: { background: 'linear-gradient(180deg,#22252a,#16181c)', border: '1px solid rgba(255,255,255,.12)' },
    paper: { background: 'repeating-linear-gradient(0deg, rgba(255,255,255,.03) 0 1px, transparent 1px 28px), linear-gradient(180deg,#1d2024,#15171a)', border: '1px solid rgba(255,255,255,.1)' }, paperInk: '#e3e0d8',
    nameCls: 'font-sans font-semibold tracking-[.04em]', label: (en) => (en ? 'CASE FILE' : '人 员 档 案'),
  },
  wa: {
    key: 'wa', accent: '#c94a4a', ink: '#e6e3f0',
    card: { background: `${SEIGAIHA}, linear-gradient(180deg,#151a2c,#0c0f1a)`, border: '1px solid rgba(169,184,224,.25)' },
    paper: { background: `${SEIGAIHA}, linear-gradient(180deg,#141829,#0c0f1a)`, border: '1px solid rgba(169,184,224,.2)' }, paperInk: '#e2e0ee',
    nameCls: 'font-serif tracking-[.25em]', label: (en) => (en ? 'CHARACTERS' : '登 場 人 物'),
  },
  dread: {
    key: 'dread', accent: '#c0302a', ink: '#e8dcd6',
    card: { background: 'radial-gradient(90% 60% at 80% 100%, rgba(140,20,20,.35), transparent 70%), linear-gradient(180deg,#160d0d,#0b0808)', border: '1px solid rgba(192,48,42,.35)' },
    paper: { background: 'radial-gradient(80% 50% at 100% 100%, rgba(140,20,20,.22), transparent 70%), linear-gradient(180deg,#140c0c,#0b0808)', border: '1px solid rgba(192,48,42,.25)' }, paperInk: '#eadcd6',
    nameCls: 'font-serif tracking-[.12em]', label: (en) => (en ? 'THE DAMNED' : '在 劫 之 人'),
  },
};

export function pickLook(meta: any): Look {
  const t = `${meta?.era || ''} ${meta?.genre || ''} ${meta?.place || ''} ${meta?.title || ''}`;
  const type = meta?.type || '';
  if (/古代|古风|宫|朝|江湖|武侠|王府|侯府|唐|宋|明|清|仙|侠|府邸/.test(t)) return LOOKS.ancient;
  if (/日式|昭和|大正|和风|日本|东京|京都|神社/.test(t)) return LOOKS.wa;
  if (/民国|上海|旧时|舞厅|1920|1930|1940|二三十年代|洋行|百乐门/.test(t)) return LOOKS.deco;
  if (/欧洲|英国|伦敦|维多利亚|庄园|古堡|城堡|伯爵|公爵|贵族|19世纪|十九世纪|法国|巴黎/.test(t)) return LOOKS.manor;
  if (type === '恐怖' || /恐怖|民俗|诡|鬼|凶宅|冥|尸/.test(t)) return LOOKS.dread;
  if (/现代|都市|公司|直播|网红|校园|大学|酒店|游轮|别墅|医院|科技|未来/.test(t)) return LOOKS.dossier;
  return LOOKS.deco;
}

const Seal = ({ ch, c }: { ch: string; c: string }) => (
  <span className="inline-flex items-center justify-center w-8 h-8 rounded-[4px] font-serif text-[15px] font-bold rotate-[-6deg]" style={{ color: c, border: `1.5px solid ${c}`, boxShadow: `inset 0 0 0 2px transparent`, opacity: 0.85 }}>{ch}</span>
);

// 人物卡：竖版，像一张印出来的角色卡
export function RoleCard({ c, look, en, tag, footer, big }: { c: any; look: Look; en: boolean; tag?: string; footer?: ReactNode; big?: boolean }) {
  const name = String(c?.name || '?');
  const light = look.key === 'ancient';
  const sub = [c?.age ? (en ? `${c.age}` : `${c.age} 岁`) : '', c?.occupation || c?.role || ''].filter(Boolean).join(' · ');
  return (
    <div className={`relative rounded-[14px] overflow-hidden flex flex-col ${big ? '' : 'h-full'}`} style={look.card}>
      {look.corner && <><span className="absolute top-1.5 left-1.5 z-10">{look.corner}</span><span className="absolute top-1.5 right-1.5 z-10 scale-x-[-1]">{look.corner}</span></>}
      <div className={`relative ${big ? 'h-56' : 'aspect-[4/5]'} m-2.5 mb-0 rounded-[10px] overflow-hidden`} style={{ background: light ? 'rgba(80,60,40,.12)' : 'rgba(0,0,0,.35)' }}>
        {c?.avatar_url || c?.image
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={c.avatar_url || c.image} alt="" className={`w-full h-full object-cover ${look.key === 'dossier' ? 'grayscale-[35%] contrast-110' : look.key === 'ancient' ? 'sepia-[.35]' : ''}`} />
          : <div className="w-full h-full flex items-center justify-center font-serif" style={{ color: look.accent, fontSize: big ? 72 : 46, opacity: 0.55 }}>{name.slice(0, 1)}</div>}
        {look.key === 'dossier' && <span className="absolute top-2 left-2 px-1.5 py-0.5 text-[9.5px] tracking-[.18em] bg-black/60 text-white/80 font-mono">{en ? 'NO.' : '编号 '}{(name.charCodeAt(0) % 900) + 100}</span>}
        {!light && <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/70 to-transparent" />}
        {tag && <span className="absolute top-2 right-2 px-1.5 py-[1px] rounded text-[10px] tracking-wider" style={{ color: look.accent, border: `1px solid ${look.accent}99`, background: light ? 'rgba(240,230,210,.85)' : 'rgba(0,0,0,.55)' }}>{tag}</span>}
      </div>
      <div className="px-3.5 pt-2.5 pb-3 flex-1 flex flex-col">
        <div className="flex items-center justify-between gap-2">
          <span className={`${look.nameCls} ${big ? 'text-[22px]' : 'text-[16.5px]'} truncate`} style={{ color: light ? '#1f1710' : look.ink }}>{name}</span>
          {look.key === 'ancient' && <Seal ch={name.slice(-1)} c={look.accent} />}
          {look.key === 'manor' && <span className="w-6 h-6 rounded-full shrink-0" style={{ background: `radial-gradient(circle at 35% 35%, #d0645a, ${look.accent} 60%, #5a1c18)` }} />}
        </div>
        {sub && <div className="text-[11.5px] mt-0.5" style={{ color: light ? 'rgba(40,30,20,.6)' : `${look.ink}99` }}>{sub}</div>}
        <div className="my-2 h-px" style={{ background: light ? 'rgba(60,40,20,.25)' : `${look.accent}40` }} />
        {(c?.public_info || c?.look) && <p className={`text-[12.5px] leading-[1.7] ${big ? '' : 'line-clamp-4'}`} style={{ color: light ? 'rgba(35,26,18,.85)' : `${look.ink}cc` }}>{c.public_info || c.look}</p>}
        {footer && <div className="mt-auto pt-2.5">{footer}</div>}
      </div>
    </div>
  );
}

// 剧本纸：读自己剧本时的纸张
export function ScriptPaper({ look, children }: { look: Look; children: ReactNode }) {
  return <div className="rounded-[14px] px-4 py-4 font-serif text-[15px] leading-[1.95] whitespace-pre-line" style={{ ...look.paper, color: look.paperInk }}>{children}</div>;
}

// 幕标题
export function ActTitle({ look, en, text }: { look: Look; en: boolean; text: string }) {
  const light = look.key === 'ancient';
  return (
    <div className="pt-4 pb-1 text-center nf-in">
      <div className="mx-auto inline-flex flex-col items-center px-8 py-3 rounded-[12px]" style={light ? { ...look.card, padding: '12px 32px' } : {}}>
        <div className="flex items-center gap-3 w-full"><span className="flex-1 h-px min-w-[30px]" style={{ background: `linear-gradient(to right, transparent, ${look.accent}80)` }} /><span className="text-[10.5px] tracking-[.4em]" style={{ color: look.accent }}>{en ? 'NEW ACT' : '新 的 一 幕'}</span><span className="flex-1 h-px min-w-[30px]" style={{ background: `linear-gradient(to left, transparent, ${look.accent}80)` }} /></div>
        <div className={`mt-2 ${look.nameCls} text-[21px]`} style={{ color: light ? '#1f1710' : '#efe6d2' }}>{text}</div>
      </div>
    </div>
  );
}
