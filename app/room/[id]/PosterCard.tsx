'use client';
// 克苏鲁故事海报：按类型 / 地点 / 时代挑一套视觉风格，按危险程度加血色和划痕。全部用排版 + 程序花纹，不画图、零成本。
import type { ReactNode, CSSProperties } from 'react';

type Theme = { key: string; tag: string; bg: string; pattern?: string; title: CSSProperties; accent: string; text: string; deco?: ReactNode };

const svg = (s: string) => `url("data:image/svg+xml,${encodeURIComponent(s)}")`;
const GRAIN = svg(`<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 .85  0 0 0 0 .75  0 0 0 0 .55  0 0 0 .16 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>`);
const RINGS = svg(`<svg xmlns='http://www.w3.org/2000/svg' width='300' height='300'><g fill='none' stroke='%236fcfb9' stroke-opacity='.10'>${[30, 60, 90, 120, 150, 180].map((r) => `<path d='M150 ${150 - r} C ${150 + r * 1.3} ${150 - r * 0.6}, ${150 + r * 0.7} ${150 + r * 1.1}, 150 ${150 + r} S ${150 - r * 1.3} ${150 - r * 0.2}, 150 ${150 - r}'/>`).join('')}</g></svg>`);
const SEIGAIHA = svg(`<svg xmlns='http://www.w3.org/2000/svg' width='40' height='20'><g fill='none' stroke='%23a9b8e0' stroke-opacity='.08'><circle cx='20' cy='20' r='18'/><circle cx='20' cy='20' r='12'/><circle cx='20' cy='20' r='6'/><circle cx='0' cy='10' r='18'/><circle cx='40' cy='10' r='18'/></g></svg>`);
const SCAN = 'repeating-linear-gradient(0deg, rgba(255,255,255,.035) 0 1px, transparent 1px 3px)';
const RULED = 'repeating-linear-gradient(0deg, rgba(230,226,200,.05) 0 1px, transparent 1px 28px)';
const GRID = 'linear-gradient(rgba(160,210,215,.05) 1px, transparent 1px), linear-gradient(90deg, rgba(160,210,215,.05) 1px, transparent 1px)';

function pickTheme(m: any): Theme {
  const g = `${m.genre || ''} ${m.title || ''} ${m.tagline || ''}`;
  const place = `${m.place || ''}`;
  const era = `${m.era || ''}`;
  const all = `${g} ${place} ${era} ${m.hook || ''}`;
  const has = (re: RegExp, s = all) => re.test(s);
  // 先看故事类型，再看地点，最后看时代
  if (has(/克苏鲁|深海|邪神|旧日|cthulhu|cosmic|eldritch/i, g)) return COSMIC;
  if (has(/民俗|中式|冥婚|纸人|folk/i, g)) return FOLK;
  if (has(/校园|campus/i, g)) return CAMPUS;
  if (has(/日式|怪谈|和风|kaidan|japan/i, g)) return JAPANESE;
  if (has(/都市传说|urban/i, g)) return URBAN;
  if (has(/医院|疗养|病房|精神病|诊所|hospital|asylum|sanatorium|clinic/i, place)) return HOSPITAL;
  if (has(/学校|宿舍|教室|教学楼|school|dorm/i, place)) return CAMPUS;
  if (has(/神社|鸟居|shrine/i, place)) return JAPANESE;
  if (has(/村|寺|祠|山中|宅|temple|village/i, place)) return FOLK;
  if (has(/民国|旧上海|1920|19[0-4]\d|维多利亚|近代|洋行|early 20th|victorian|1920s/i, `${era} ${place}`) && !has(/海边|渔村|海岛|深海|港口/i, place)) return DECO;
  if (has(/海边|渔村|海岛|深海|港口|灯塔|sea|harbor|island|lighthouse/i, place)) return COSMIC;
  if (has(/古代|王朝|宫|ancient/i, era)) return FOLK;
  if (has(/电台|地铁|直播|网|手机|现代|radio|subway|modern|city/i)) return URBAN;
  return COSMIC;
}

const COSMIC: Theme = {
  key: 'cosmic', tag: 'COSMIC HORROR',
  bg: 'radial-gradient(120% 70% at 50% 0%, rgba(40,120,110,.35), rgba(6,16,15,.96) 65%), #050c0c', pattern: `${RINGS} center/300px`,
  title: { color: '#a9e3d6', textShadow: '0 0 18px rgba(111,207,185,.45)', letterSpacing: '.06em' }, accent: '#6fcfb9', text: 'rgba(205,230,225,.72)',
};
const FOLK: Theme = {
  key: 'folk', tag: '民俗 · 志异',
  bg: 'linear-gradient(180deg, #23150f, #120a07)', pattern: `${GRAIN}`,
  title: { color: '#ead5a6', fontFamily: 'var(--f-kai)', letterSpacing: '.12em' }, accent: '#c0453f', text: 'rgba(234,213,166,.72)',
  deco: <>
    <div className="absolute right-4 top-0 bottom-0 w-7 bg-[#c9a14a]/[0.16] border-x border-[#c9a14a]/20 flex flex-col items-center justify-center gap-1 text-[#b3352f]/70 font-['Kaiti_SC','STKaiti','KaiTi',serif] text-[15px] leading-none select-none" aria-hidden>{'敕令镇邪'.split('').map((c, i) => <span key={i}>{c}</span>)}</div>
  </>,
};
const JAPANESE: Theme = {
  key: 'japanese', tag: '怪談 · KAIDAN',
  bg: 'linear-gradient(180deg, #10172a, #090b13)', pattern: `${SEIGAIHA}`,
  title: { color: '#eef0f6', letterSpacing: '.1em' }, accent: '#d14b4b', text: 'rgba(220,226,240,.7)',
  deco: <svg className="absolute right-5 top-5 opacity-80" width="54" height="40" viewBox="0 0 54 40" aria-hidden><g stroke="#d14b4b" strokeWidth="3" fill="none" strokeLinecap="round"><path d="M2 6 Q27 0 52 6" /><path d="M8 13 H46" /><path d="M14 6 V40 M40 6 V40" /></g></svg>,
};
const URBAN: Theme = {
  key: 'urban', tag: 'URBAN LEGEND',
  bg: 'linear-gradient(180deg, #0a0d18, #06070b)', pattern: SCAN,
  title: { color: '#f1f4ff', fontFamily: 'var(--f-heavy)', fontWeight: 900, letterSpacing: '.02em', textShadow: '2px 0 rgba(255,40,90,.55), -2px 0 rgba(60,200,255,.55)' }, accent: '#5fd1ff', text: 'rgba(210,220,240,.68)',
};
const CAMPUS: Theme = {
  key: 'campus', tag: '校园怪谈',
  bg: 'linear-gradient(180deg, #17251d, #0d1611)', pattern: RULED,
  title: { color: '#eeeadb', fontFamily: 'var(--f-kai)', letterSpacing: '.08em', textShadow: '0 0 1px rgba(238,234,219,.9), 0 0 6px rgba(238,234,219,.25)' }, accent: '#e6d88a', text: 'rgba(225,225,205,.7)',
};
const DECO: Theme = {
  key: 'deco', tag: '旧时代',
  bg: 'linear-gradient(180deg, #17120b, #0c0906)', pattern: GRAIN,
  title: { color: '#d9b46a', letterSpacing: '.14em' }, accent: '#d9b46a', text: 'rgba(225,205,165,.72)',
  deco: <>
    <div className="absolute inset-2.5 rounded-xl border border-[#d9b46a]/25 pointer-events-none" aria-hidden />
    <div className="absolute inset-[14px] rounded-lg border border-[#d9b46a]/12 pointer-events-none" aria-hidden />
    {['left-3 top-3', 'right-3 top-3 rotate-90', 'right-3 bottom-3 rotate-180', 'left-3 bottom-3 -rotate-90'].map((p, i) => (
      <svg key={i} className={`absolute ${p}`} width="26" height="26" viewBox="0 0 26 26" aria-hidden><g stroke="#d9b46a" strokeOpacity=".5" fill="none"><path d="M1 25 A24 24 0 0 1 25 1" /><path d="M1 25 A16 16 0 0 1 17 9" /><path d="M1 25 A8 8 0 0 1 9 17" /><path d="M1 25 L13 13" /></g></svg>
    ))}
  </>,
};
const HOSPITAL: Theme = {
  key: 'hospital', tag: 'WARD · 病房',
  bg: 'linear-gradient(180deg, #0f1a1c, #080d0e)', pattern: GRID,
  title: { color: '#d6eaec', letterSpacing: '.08em' }, accent: '#c0453f', text: 'rgba(205,225,228,.7)',
  deco: <>
    <svg className="absolute right-5 top-5" width="22" height="22" viewBox="0 0 22 22" aria-hidden><path d="M8 2h6v6h6v6h-6v6H8v-6H2V8h6z" fill="#c0453f" fillOpacity=".75" /></svg>
    <svg className="absolute left-0 right-0 top-[78px] w-full mn-ecg" height="30" viewBox="0 0 320 30" preserveAspectRatio="none" aria-hidden><path d="M0 15 H110 L120 15 L126 4 L134 27 L141 9 L147 15 H320" stroke="#7fd6c6" strokeOpacity=".45" strokeWidth="1.4" fill="none" /></svg>
  </>,
};

function danger(m: any): 1 | 2 | 3 {
  const d = `${m.difficulty || ''}`;
  if (/地狱|高死亡|致命|lethal|deadly/i.test(d)) return 3;
  if (/困难|hard/i.test(d)) return 2;
  return 1;
}

export default function PosterCard({ m, index, total, en, footer }: { m: any; index: number; total: number; en: boolean; footer: ReactNode }) {
  const t = pickTheme(m);
  const lv = danger(m);
  const blood = [0, 0.18, 0.32, 0.5][lv];
  return (
    <div className="relative snap-center shrink-0 w-[82vw] max-w-[320px] sm:w-[300px] rounded-2xl overflow-hidden border border-white/[0.08] shadow-[0_30px_60px_-30px_rgba(0,0,0,.95)] text-left flex flex-col"
      style={{ background: t.bg }}>
      {t.pattern && <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: t.pattern.split(' center')[0], backgroundSize: t.pattern.includes('center/') ? '300px' : (t.key === 'hospital' ? '22px 22px' : undefined), backgroundPosition: 'center' }} aria-hidden />}
      <div className="absolute inset-x-0 bottom-0 h-1/2 pointer-events-none" style={{ background: `linear-gradient(to top, rgba(110,14,14,${blood}), transparent)` }} aria-hidden />
      {lv === 3 && <div className="absolute inset-0 pointer-events-none mn-scratch" aria-hidden />}
      {t.deco}
      {m.poster_url && (
        <div className="relative h-40 shrink-0 overflow-hidden" aria-hidden>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={m.poster_url} alt="" className="w-full h-full object-cover opacity-80" loading="lazy" />
          <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,.05), rgba(0,0,0,.25) 55%, rgba(8,9,12,1))' }} />
        </div>
      )}

      <div className="relative flex-1 flex flex-col p-5 pr-6">
        <div className="text-[10px] tracking-[.32em]" style={{ color: t.accent, opacity: 0.85 }}>{t.tag}</div>
        <div className="mt-1 text-[11px] tracking-[.18em] text-white/40">{[m.era, m.place].filter(Boolean).join(' · ')}</div>
        <div className={`${m.poster_url ? 'mt-2' : 'mt-6'} text-[10px] text-white/25 font-serif`}>{String(index + 1).padStart(2, '0')} / {String(total).padStart(2, '0')}</div>
        <h2 className={`mt-1 font-serif font-semibold leading-tight ${t.key === 'folk' ? 'text-[30px] pr-8' : 'text-[27px]'}`} style={t.title}>{m.title}</h2>
        {m.tagline && <p className="mt-2.5 font-serif italic text-[14px]" style={{ color: t.accent, opacity: 0.9 }}>{m.tagline}</p>}
        <p className={`mt-4 text-[14px] leading-[1.85] line-clamp-6 ${t.key === 'folk' ? 'pr-8' : ''}`} style={{ color: t.text }}>{m.hook}</p>
        <div className="mt-4 flex items-center gap-3 text-[11.5px] text-white/45">
          <span className="flex items-center gap-1" title={en ? 'Danger' : '危险'}>
            {[1, 2, 3].map((k) => <svg key={k} width="11" height="13" viewBox="0 0 11 13" aria-hidden><path d="M5.5 0 C7 3.5 11 6 11 8.8 A5.5 4.2 0 0 1 0 8.8 C0 6 4 3.5 5.5 0Z" fill={k <= lv ? '#c0453f' : 'rgba(255,255,255,.14)'} /></svg>)}
          </span>
          {m.duration && <span>{m.duration}</span>}
          {m.from_library && <span style={{ color: '#9fbf9f' }}>{en ? 'Ready · instant' : '现成 · 秒开'}</span>}
        </div>
        {t.key === 'folk' && <span className="absolute right-12 top-16 w-10 h-10 rounded-[4px] border-2 border-[#b3352f]/70 text-[#b3352f]/85 font-['Kaiti_SC','STKaiti','KaiTi',serif] text-[20px] flex items-center justify-center rotate-[-8deg]" aria-hidden>{String(m.title || '').slice(0, 1)}</span>}
        <div className="mt-5 pt-4 border-t border-white/[0.08]">{footer}</div>
      </div>
    </div>
  );
}
