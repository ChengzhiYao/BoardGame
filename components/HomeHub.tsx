'use client';
import { CheckinButton } from '@/components/Progress';
// 首页第一屏：卖点 + 全部玩法（九宫格）+ 收费方式，手机一屏看全。点玩法弹出底部卡片看详情、开局。
import React, { useEffect, useState } from 'react';
import { type Lang } from '@/lib/i18n';
import { GAMES, type GM } from '@/components/GameShowcase';
import { FREE_MODES, FREE_PLAYS_ON_SIGNUP, MEMBERSHIP, MEMBER_PREMIUM_PLAYS } from '@/lib/pricing';
import { useIntroVoice } from '@/lib/useIntroVoice';

type Bi = { zh: string; en: string };
const L = (lang: Lang, b: Bi) => (lang === 'en' ? b.en : b.zh);

// 九宫格顺序 = 最常玩的在前
// 龙与地下城还没做完，先不在任何入口出现
export const ORDER: GM[] = ['soup', 'coc', 'jbs', 'mcc', 'botc', 'td', 'story', 'market'];
// 视觉层级：主推 → 次推 → 更多
export const TIER1: GM[] = ['soup', 'coc'];
export const TIER2: GM[] = ['jbs', 'mcc'];
export const TIER3: GM[] = ['botc', 'td', 'story'];
const PITCH: Partial<Record<GM, { hook: Bi; meta: Bi }>> = {
  soup: { hook: { zh: '一句怪事，只能问「是不是」，问出背后的真相。', en: 'One strange line. Ask yes-or-no until the truth comes out.' }, meta: { zh: '1 人可玩 · 10 分钟', en: 'Solo OK · 10 min' } },
  coc: { hook: { zh: 'AI 守秘人陪你查一桩怪案，理智会一点点流失。', en: 'An AI Keeper runs your investigation. Sanity drains.' }, meta: { zh: '1–6 人 · 约 1 小时', en: '1–6 · ~1 hr' } },
};
export const TILE: Record<GM, { short: Bi; line: Bi; color: string; icon: JSX.Element }> = {
  soup: { short: { zh: '海龟汤', en: 'Lateral Soup' }, line: { zh: '问是非猜真相', en: 'Yes/no riddles' }, color: '#3f9d8e',
    icon: <><path d="M3 11h18a9 9 0 0 1-18 0z" /><path d="M8 7.5c0-1.5 1-1.5 1-3M12 7.5c0-1.5 1-1.5 1-3M16 7.5c0-1.5 1-1.5 1-3" /></> },
  jbs: { short: { zh: '剧本杀', en: 'Whodunit' }, line: { zh: '找出谁是凶手', en: 'Find the killer' }, color: '#c0453f',
    icon: <><path d="M14.5 3.5l6 6-8.5 8.5-3-3z" /><path d="M9 15l-5.5 5.5M5.5 13.5l5 5" /></> },
  coc: { short: { zh: '克苏鲁跑团', en: 'Cthulhu' }, line: { zh: '理智会流失', en: 'Cosmic horror' }, color: '#4f9a6a',
    icon: <><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></> },
  botc: { short: { zh: '血染钟楼', en: 'Bloodbound' }, line: { zh: '找出恶魔', en: 'Find the demon' }, color: '#9a5bc4',
    icon: <><circle cx="12" cy="13.5" r="7.5" /><path d="M12 10v3.5l2.5 2M9 2.5h6M12 2.5v3.5" /></> },
  dnd: { short: { zh: '龙与地下城', en: 'D&D' }, line: { zh: '打怪升级', en: 'Dice & loot' }, color: '#d9a441',
    icon: <><path d="M12 2l9 5v10l-9 5-9-5V7z" /><path d="M12 2L7 11h10zM7 11l5 11 5-11M3 7l4 4M21 7l-4 4" /></> },
  story: { short: { zh: '讲故事', en: 'Storyteller' }, line: { zh: '真实经历·一起听', en: 'True stories, together' }, color: '#5aa0c4',
    icon: <><path d="M2 5.5c3-1 7-1 10 1 3-2 7-2 10-1v13c-3-1-7-1-10 1-3-2-7-2-10-1z" /><path d="M12 6.5v13" /></> },
  td: { short: { zh: '真心话', en: 'Truth or Dare' }, line: { zh: '派对现场出题', en: 'Party prompts' }, color: '#d9668f',
    icon: <><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z" /><path d="M12 8v4.5M12 15.5v.2" /></> },
  mcc: { short: { zh: '午夜猫诅咒', en: 'Cat Curse' }, line: { zh: '抽到就出局', en: 'Don’t draw it' }, color: '#8f7bd6',
    icon: <><path d="M4 20V9l3-5.5 3.5 4h3L17 3.5 20 9v11z" /><path d="M9 13.5h.01M15 13.5h.01M10.5 17h3" /></> },
  market: { short: { zh: '身价场', en: 'The Market' }, line: { zh: '买卖玩家冲榜', en: 'Trade players' }, color: '#c9a54a',
    icon: <><path d="M3 17l6-6 4 4 8-8" /><path d="M15 7h6v6" /></> },
};

export type MenuItem = { label: string; onClick?: () => void; href?: string; icon?: keyof typeof MI; group?: number };
const MI = {
  hall: 'M3 10.5L12 4l9 6.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z',
  invite: 'M15 19v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 3 17.5V19M9 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19 8v6M22 11h-6',
  code: 'M4 7h16M4 12h16M4 17h10',
  account: 'M20 21v-1.5a4.5 4.5 0 0 0-4.5-4.5h-7A4.5 4.5 0 0 0 4 19.5V21M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  price: 'M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8zM7.5 7.5h.01',
  play: 'M7 5l12 7-12 7z',
  music: 'M9 18V5l12-2v13M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM21 16a3 3 0 1 1-6 0 3 3 0 0 1 6 0z',
  blog: 'M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5zM4 20.5A2.5 2.5 0 0 1 6.5 18H20',
  book: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z',
  mail: 'M4 5h16v14H4zM4 6l8 7 8-7',
  heart: 'M20.8 5.6a5.5 5.5 0 0 0-7.8 0L12 6.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 22l8.8-8.6a5.5 5.5 0 0 0 0-7.8z',
  about: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 16v-4M12 8h.01',
  trophy: 'M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0zM7 6H4v1a3 3 0 0 0 3 3M17 6h3v1a3 3 0 0 1-3 3',
  out: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9',
};
function MIcon({ k }: { k?: keyof typeof MI }) {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-[#c9a96e]/75">{k ? <path d={MI[k]} /> : null}</svg>;
}

export function HomeTopBar({ lang, onLang, account, onLogin, onLogout, menu, home }: {
  home?: string; lang: Lang; onLang: (l: Lang) => void; account: any; onLogin: () => void; onLogout: () => void;
  menu: MenuItem[];
}) {
  const en = lang === 'en';
  const [open, setOpen] = useState(false);
  useEffect(() => { if (!open) return; const f = () => setOpen(false); window.addEventListener('scroll', f, { once: true }); return () => window.removeEventListener('scroll', f); }, [open]);
  return (
    <div className="fixed top-0 inset-x-0 z-40" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      <div className="mx-auto max-w-5xl h-12 px-3 flex items-center gap-2 bg-ink/55 backdrop-blur-md border-b border-white/5 sm:border-none sm:bg-transparent sm:backdrop-blur-0">
        <a href={home || (en ? '/en' : '/zh')} className="font-serif font-bold text-[17px] text-[#f2ead9] tracking-wide">{en ? 'MystNight' : '谜夜'}</a>
        <div className="flex-1" />
        {account?.loggedIn && <CheckinButton en={en} />}
        <button onClick={() => onLang(en ? 'zh' : 'en')} className="h-8 px-2.5 rounded-full text-xs text-parchment/75 border border-white/10 bg-white/5">{en ? '中文' : 'EN'}</button>
        {account?.loggedIn ? (
          <a href="/upgrade" className="h-8 px-2.5 rounded-full text-xs flex items-center border border-eldritch/40 bg-eldritch/15 text-parchment/85">
            {account.whitelisted || account.member ? (en ? 'Member' : '会员') : `${account.credits ?? 0} ${en ? 'games' : '局'}`}
          </a>
        ) : (
          <button onClick={onLogin} className="h-8 px-3 rounded-full text-xs bg-parchment text-ink font-medium">{en ? 'Sign in' : '登录'}</button>
        )}
        <button onClick={() => setOpen((v) => !v)} aria-label="menu" className="h-8 w-8 rounded-full flex items-center justify-center border border-white/10 bg-white/5 overflow-hidden">
          {account?.loggedIn && account.avatarUrl
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={account.avatarUrl} alt="" className="w-full h-full object-cover" />
            : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-parchment/80"><path d="M4 7h16M4 12h16M4 17h16" /></svg>}
        </button>
      </div>
      {open && (
        <>
          <div className="fixed inset-0 z-[-1]" onClick={() => setOpen(false)} />
          <div className="absolute right-3 top-[calc(env(safe-area-inset-top)+54px)] w-[232px] max-h-[calc(100svh-80px)] overflow-y-auto rounded-xl bg-[#0f1013]/[0.97] backdrop-blur-xl border border-[#d8c7a8]/[0.14] shadow-[0_24px_60px_-12px_rgba(0,0,0,.9)] text-left nf-in">
            {account?.loggedIn && (
              <a href="/account" className="flex items-center gap-3 px-4 py-3.5 border-b border-[#d8c7a8]/[0.08] hover:bg-white/[0.03]">
                <span className="w-9 h-9 rounded-full overflow-hidden border border-[#c9a96e]/30 bg-[#c9a96e]/10 flex items-center justify-center shrink-0 font-serif text-[#efe6d2]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {account.avatarUrl ? <img src={account.avatarUrl} alt="" className="w-full h-full object-cover" /> : String(account.displayName || account.email || '?').slice(0, 1).toUpperCase()}
                </span>
                <span className="min-w-0">
                  <span className="block truncate font-serif text-[15px] text-[#efe6d2]">{account.displayName || String(account.email || '').split('@')[0]}</span>
                  <span className="block text-[11.5px] text-[#c9a96e]/80">{account.whitelisted || account.member ? (en ? '✦ Member' : '✦ 会员') : (en ? `${account.credits ?? 0} premium games` : `豪华局数 ${account.credits ?? 0}`)}</span>
                </span>
              </a>
            )}
            {[1, 2, 3].map((g) => {
              const items = menu.filter((m) => (m.group || 1) === g);
              if (!items.length) return null;
              return (
                <div key={g} className={`py-1.5 ${g > 1 ? 'border-t border-[#d8c7a8]/[0.08]' : ''}`}>
                  {items.map((m, i) => {
                    const cls = `flex w-full items-center gap-3 px-4 py-2.5 text-left ${g === 3 ? 'text-[13.5px] text-parchment/60' : 'text-[14.5px] text-parchment/90'} hover:bg-white/[0.04] hover:text-[#efe6d2]`;
                    return m.href
                      ? <a key={i} href={m.href} className={cls}><MIcon k={m.icon} />{m.label}</a>
                      : <button key={i} onClick={() => { setOpen(false); m.onClick?.(); }} className={cls}><MIcon k={m.icon} />{m.label}</button>;
                  })}
                </div>
              );
            })}
            {account?.loggedIn && (
              <div className="border-t border-[#d8c7a8]/[0.08] py-1.5">
                <button onClick={() => { setOpen(false); onLogout(); }} className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-[13.5px] text-parchment/45 hover:text-parchment/80 hover:bg-white/[0.03]"><MIcon k="out" />{en ? 'Sign out' : '退出登录'}</button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export function SellingPoints({ lang }: { lang: Lang }) {
  const pts: Bi[] = [
    { zh: 'AI 全程主持', en: 'AI host' },
    { zh: '2 人就能开', en: '2+ players' },
    { zh: '每局都不一样', en: 'Never the same' },
    { zh: '免下载', en: 'No download' },
  ];
  return (
    <div className="flex flex-wrap justify-center items-center gap-x-3 gap-y-1 text-[12px] sm:text-[13px] tracking-[.08em] text-parchment/60">
      {pts.map((p, i) => (
        <span key={i} className="inline-flex items-center gap-3">{i > 0 && <span className="w-[3px] h-[3px] rotate-45 bg-[#c9a96e]/60" />}{L(lang, p)}</span>
      ))}
    </div>
  );
}

export function GameGrid({ lang, onPick }: { lang: Lang; onPick: (g: GM) => void }) {
  const en = lang === 'en';
  const Tag = ({ k }: { k: GM }) => {
    const free = FREE_MODES.includes(k);
    return <span className={`text-[10px] tracking-[.14em] ${free ? 'text-[#9fbf9f]/85' : 'text-[#c9a96e]/85'}`}>{free ? (en ? 'FREE' : '免费') : (en ? '✦ PREMIUM' : '✦ 豪华')}</span>;
  };
  const Ico = ({ k, cls }: { k: GM; cls: string }) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" className={cls}>{TILE[k].icon}</svg>
  );
  return (
    <div className="w-full space-y-3">
      {/* 第一层：主推，大卡 */}
      <div className="grid grid-cols-2 gap-2.5 sm:gap-3.5">
        {TIER1.map((k) => {
          const t = { ...TILE[k], color: k === 'coc' ? '#b8503f' : TILE[k].color }; const p = PITCH[k]!;
          return (
            <button key={k} onClick={() => onPick(k)}
              className="group relative overflow-hidden text-left rounded-2xl p-3.5 sm:p-5 min-h-[208px] sm:min-h-[232px] flex flex-col border backdrop-blur-md transition-all hover:-translate-y-0.5"
              style={{ borderColor: t.color + '55', background: `radial-gradient(120% 90% at 0% 0%, ${t.color}38, transparent 60%), linear-gradient(180deg, rgba(21,22,27,.88), rgba(11,12,15,.92))`, boxShadow: `0 18px 50px -24px ${t.color}aa` }}>
              <span aria-hidden className="absolute -right-6 -bottom-8 opacity-[0.10] group-hover:opacity-[0.16] transition-opacity" style={{ color: t.color }}><Ico k={k} cls="w-36 h-36" /></span>
              <div className="relative flex items-center justify-between">
                <span className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: t.color + '26', color: t.color }}><Ico k={k} cls="w-[22px] h-[22px]" /></span>
                <Tag k={k} />
              </div>
              <div className="relative mt-auto">
                <div className="font-serif font-semibold text-[20px] sm:text-[25px] text-[#efe6d2] leading-tight">{L(lang, t.short)}</div>
                <p className="mt-1.5 text-[12.5px] sm:text-[13.5px] leading-[1.6] text-parchment/65 line-clamp-3">{L(lang, p.hook)}</p>
                <div className="mt-2.5 flex items-center justify-between gap-2">
                  <span className="text-[11px] text-parchment/40 truncate">{L(lang, p.meta)}</span>
                  <span className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-[14px] group-hover:translate-x-0.5 transition-transform" style={{ color: t.color, background: t.color + '22' }}>→</span>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* 第二层：次推，横条卡 */}
      <div className="grid grid-cols-2 gap-2.5 sm:gap-3.5">
        {TIER2.map((k) => {
          const t = TILE[k];
          return (
            <button key={k} onClick={() => onPick(k)}
              className="group text-left rounded-xl px-3 py-3 sm:px-4 sm:py-3.5 flex items-center gap-3 bg-[#0b0c0f]/65 backdrop-blur-md border border-[#d8c7a8]/[0.12] hover:border-[#c9a96e]/40 transition-colors">
              <span className="shrink-0 w-9 h-9 rounded-lg flex items-center justify-center bg-white/[0.04] text-[#d8c7a8]/70 group-hover:text-[#c9a96e]"><Ico k={k} cls="w-5 h-5" /></span>
              <span className="min-w-0 flex-1">
                <span className="block font-serif text-[15px] sm:text-[17px] font-semibold text-[#ece3cf] truncate">{L(lang, t.short)}</span>
                <span className="flex items-center gap-1.5 text-[11.5px] text-parchment/45 min-w-0"><span className="truncate">{L(lang, t.line)}</span><span className="shrink-0"><Tag k={k} /></span></span>
              </span>
            </button>
          );
        })}
      </div>

      {/* 身价场：全站玩家都在一个场子里，单独一条横幅 */}
      <button onClick={() => onPick('market')}
        className="group relative w-full overflow-hidden text-left rounded-2xl px-4 py-3.5 sm:px-5 sm:py-4 flex items-center gap-3.5 border border-[#c9a54a]/35 backdrop-blur-md transition-colors hover:border-[#c9a54a]/60"
        style={{ background: 'linear-gradient(100deg, rgba(201,165,74,.16), rgba(201,165,74,.04) 55%, rgba(11,12,15,.7))' }}>
        <span className="relative shrink-0 w-11 h-11 rounded-xl flex items-center justify-center bg-[#c9a54a]/20 text-[#e6c76e]"><Ico k="market" cls="w-[22px] h-[22px]" /></span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="font-serif text-[16px] sm:text-[18px] font-semibold text-[#f1e3b8]">{L(lang, TILE.market.short)}</span>
            <span className="flex items-center gap-1 text-[10.5px] text-[#e6c76e]/90"><span className="w-1.5 h-1.5 rounded-full bg-[#e6c76e] animate-pulse" />{en ? 'EVERYONE IS IN' : '全站都在'}</span>
            <span className="ml-auto"><Tag k="market" /></span>
          </span>
          <span className="block mt-0.5 text-[12px] text-parchment/55 truncate">{en ? 'Every player has a price. Buy, sell, climb the board.' : '每个玩家都有身价——买进、卖出、冲上排行榜。'}</span>
        </span>
        <span className="shrink-0 text-[#e6c76e] text-[16px] group-hover:translate-x-0.5 transition-transform">→</span>
      </button>

      {/* 第三层：更多玩法，小标签 */}
      <div className="pt-1">
        <div className="text-[10.5px] tracking-[.24em] text-parchment/35 mb-2 px-0.5">{en ? 'MORE' : '更多玩法'}</div>
        <div className="flex flex-wrap gap-2">
          {TIER3.map((k) => (
            <button key={k} onClick={() => onPick(k)}
              className="h-9 pl-2.5 pr-3.5 rounded-full flex items-center gap-1.5 text-[13px] text-parchment/65 bg-white/[0.03] border border-white/[0.08] hover:text-[#ece3cf] hover:border-[#c9a96e]/35 transition-colors">
              <Ico k={k} cls="w-4 h-4 text-parchment/45" />{L(lang, TILE[k].short)}
              <span className={`ml-0.5 text-[10px] ${FREE_MODES.includes(k) ? 'text-[#9fbf9f]/80' : 'text-[#c9a96e]/85'}`}>{FREE_MODES.includes(k) ? (en ? 'FREE' : '免费') : (en ? '✦ PREMIUM' : '✦ 豪华')}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function PricingStrip({ lang }: { lang: Lang }) {
  const en = lang === 'en';
  const m = MEMBERSHIP.monthly.price / 100, y = MEMBERSHIP.yearly.price / 100;
  const rows: { tag: string; color: string; text: string }[] = [
    { tag: en ? 'Free' : '免费', color: '#9fbf9f', text: en ? 'Daily Soup always free · Soup 2 a day · Cat Curse 1 a day · Truth or Dare and the Market always free' : '每日一汤永久免费 · 海龟汤每天 2 碗 · 猫诅咒每天 1 局 · 真心话、身价场永久免费' },
    { tag: en ? 'More' : '加玩', color: '#d9a441', text: en ? '$1 per extra game, or $10 for 2 hours of unlimited light games' : '多玩一局 $1，或 $10 买 2 小时轻玩法随便玩' },
    { tag: en ? 'Party' : '派对', color: '#f2a65a', text: en ? '$6.99 · 3 hours of every game, friends free' : '$6.99 · 3 小时所有玩法，朋友免费' },
    { tag: en ? 'New' : '新人', color: '#c9a96e', text: en ? `${FREE_PLAYS_ON_SIGNUP} free ✦ premium games when you sign up` : `注册送 ${FREE_PLAYS_ON_SIGNUP} 局 ✦ 豪华大作` },
    { tag: en ? 'Member' : '会员', color: '#ece3cf', text: en ? `$${m}/mo · premium voice + streak protection + 2 hrs/week light games + ${MEMBER_PREMIUM_PLAYS} premium/mo ($${y}/yr)` : `$${m}/月 · 真人级配音 + 断签保护 + 轻玩法每周多 2 小时 + 每月 ${MEMBER_PREMIUM_PLAYS} 局豪华（年付 $${y}）` },
  ];
  return (
    <a href="/upgrade" className="block w-full rounded-xl bg-[#0b0c0f]/60 backdrop-blur-md border border-[#d8c7a8]/[0.13] px-4 py-3 sm:px-6 sm:py-4 text-left hover:border-[#c9a96e]/40 transition-colors">
      <div className="sm:grid sm:grid-cols-3 sm:gap-5">
      {rows.map((r, i) => (
        <div key={i} className="flex items-baseline gap-2.5 py-[3px] sm:flex-col sm:gap-1">
          <span className={`shrink-0 ${en ? 'w-14' : 'w-9'} sm:w-auto font-serif text-[12px] sm:text-[13px] font-semibold tracking-wider`} style={{ color: r.color }}>{r.tag}</span>
          <span className="text-[12.5px] sm:text-[13.5px] text-parchment/70 leading-snug">{r.text}</span>
        </div>
      ))}
      </div>
      <div className="mt-1.5 sm:mt-2 text-[11px] tracking-[.1em] text-[#c9a96e]/70 text-right">{en ? 'Prices & packs →' : '价格与局数包 →'}</div>
    </a>
  );
}

export function GameSheet({ lang, game, busy, needName, name, setName, onStart, onClose }: {
  lang: Lang; game: GM | null; busy: boolean; needName: boolean; name: string; setName: (v: string) => void; onStart: (g: GM) => void; onClose: () => void;
}) {
  const en = lang === 'en';
  if (!game) return null;
  const g = GAMES.find((x) => x.key === game); const t = TILE[game]; const free = FREE_MODES.includes(game);
  if (!g) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full sm:max-w-md max-h-[92svh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-[#0f1013] border border-[#d8c7a8]/15 shadow-2xl px-5 pt-3 text-left nf-in"
        style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }} onClick={(e) => e.stopPropagation()}>
        <div className="mx-auto w-10 h-1 rounded-full bg-white/15 mb-4 sm:hidden" />
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center border border-[#c9a96e]/35 bg-[#c9a96e]/[0.06]">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#c9a96e" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">{t.icon}</svg>
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-serif text-xl font-bold text-[#f2ead9] leading-tight">{L(lang, g.name)}</div>
            <div className="text-xs text-parchment/50 mt-0.5">{L(lang, g.meta)}</div>
          </div>
          <span className={`text-[11px] tracking-[.1em] shrink-0 ${free ? 'text-[#9fbf9f]' : 'text-[#c9a96e]'}`}>
            {free ? (en ? 'Free' : '免费') : (en ? '✦ Premium' : '✦ 豪华')}
          </span>
        </div>
        <Preview game={game} en={en} />
        <p className="mt-4 text-[15px] text-parchment/85 leading-relaxed">{L(lang, g.blurb)}</p>
        <ol className="mt-3 space-y-1.5">
          {g.rules.map((r, i) => (
            <li key={i} className="flex gap-2.5 text-sm text-parchment/70"><span className="font-serif text-xs mt-0.5 shrink-0 text-[#c9a96e]/80">{String(i + 1).padStart(2, '0')}</span>{L(lang, r)}</li>
          ))}
        </ol>
        {!free && <div className="mt-3 text-xs text-parchment/45">{en ? `Uses 1 game (new accounts get ${FREE_PLAYS_ON_SIGNUP} free; members get ${MEMBER_PREMIUM_PLAYS}/month).` : `每局消耗 1 局（新号送 ${FREE_PLAYS_ON_SIGNUP} 局，会员每月送 ${MEMBER_PREMIUM_PLAYS} 局）。`}</div>}
        {needName && (
          <input value={name} onChange={(e) => { setName(e.target.value); try { localStorage.setItem('name', e.target.value); } catch {} }}
            placeholder={en ? 'Your nickname' : '你的昵称'} className="mt-4 w-full px-4 py-3 rounded-xl bg-ink border border-white/10 text-parchment placeholder:text-parchment/35 outline-none focus:border-eldritch" />
        )}
        <button onClick={() => onStart(game)} disabled={busy || (needName && !name.trim())}
          className="mt-4 w-full py-3.5 rounded-xl bg-[#7d1d1d] hover:bg-[#8e2323] border border-[#a83232]/60 text-[#f2ead9] font-serif font-semibold tracking-[.15em] text-base disabled:opacity-50">
          {busy ? (en ? 'Opening…' : '正在开房…') : (en ? `Start ${L(lang, t.short)}` : `开始${L(lang, t.short)}`)}
        </button>
      </div>
    </div>
  );
}

// 首页「回到房间」：离开后 3 小时内的未结束房间
export function ResumeRooms({ lang, heading }: { lang: Lang; heading?: string }) {
  const en = lang === 'en';
  const [rooms, setRooms] = useState<{ id: string; name: string; mode: GM; at: string; state: string; host: boolean }[]>([]);
  const [ask, setAsk] = useState<string | null>(null);
  useEffect(() => { fetch('/api/rooms/mine').then((r) => r.json()).then((d) => setRooms(Array.isArray(d?.rooms) ? d.rooms : [])).catch(() => {}); }, []);
  if (!rooms.length) return null;
  const ago = (iso: string) => { const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000)); return m < 1 ? (en ? 'just now' : '刚刚') : m < 60 ? (en ? `${m} min ago` : `${m} 分钟前`) : (en ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 60)} 小时前`); };
  const stLabel = (s: string) => (s === 'playing' ? (en ? 'In progress' : '进行中') : (en ? 'Not started' : '还没开始'));
  async function leave(id: string) {
    setRooms((rs) => rs.filter((r) => r.id !== id)); setAsk(null);
    try { await fetch('/api/rooms/leave', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ roomId: id }) }); } catch {}
  }
  return (
    <div className="w-full flex flex-col gap-1.5">
      {heading && <SectionLabel>{heading}</SectionLabel>}
      {rooms.map((r) => (
        <div key={r.id} className="flex items-stretch w-full rounded-xl bg-[#c9a96e]/[0.08] border border-[#c9a96e]/35 backdrop-blur-md overflow-hidden">
          {ask === r.id ? (
            <div className="flex-1 flex items-center gap-3 px-4 py-2.5 text-left">
              <span className="flex-1 text-[13px] text-parchment/80">{r.host ? (en ? 'End this game for everyone?' : '结束这一局？其他人也会一起结束') : (en ? 'Leave this game?' : '退出这一局？其他人可以继续玩')}</span>
              <button onClick={() => leave(r.id)} className="text-[13px] text-[#e08080] shrink-0">{r.host ? (en ? 'End' : '结束') : (en ? 'Leave' : '退出')}</button>
              <button onClick={() => setAsk(null)} className="text-[13px] text-parchment/50 shrink-0">{en ? 'Cancel' : '取消'}</button>
            </div>
          ) : (<>
            <a href={`/room/${r.id}`} className="flex-1 min-w-0 flex items-center gap-3 pl-4 pr-2 py-2.5 text-left hover:bg-[#c9a96e]/[0.06]">
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${r.state === 'playing' ? 'bg-[#c9a96e] animate-pulse' : 'bg-parchment/30'}`} />
              <span className="flex-1 min-w-0">
                <span className="block truncate font-serif text-[14px] text-[#ece3cf]">{r.name || (TILE[r.mode] ? L(lang, TILE[r.mode].short) : '')}</span>
                <span className="block text-[11px] text-parchment/45 mt-0.5">{stLabel(r.state)} · {ago(r.at)}</span>
              </span>
              <span className="text-[12px] tracking-[.1em] text-[#c9a96e] shrink-0">{en ? 'Rejoin →' : '回到房间 →'}</span>
            </a>
            <button onClick={() => setAsk(r.id)} aria-label={en ? 'Remove' : '移除'} title={r.host ? (en ? 'End this game' : '结束这局') : (en ? 'Leave this game' : '退出这局')}
              className="shrink-0 w-11 flex items-center justify-center border-l border-[#c9a96e]/20 text-parchment/45 hover:text-parchment">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
            </button>
          </>)}
        </div>
      ))}
    </div>
  );
}

export function SectionLabel({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 mb-1.5 mt-1">
      <span className="text-[11px] tracking-[.35em] uppercase text-[#c9a96e]/75 shrink-0">{children}</span>
      <span className="flex-1 h-px bg-gradient-to-r from-[#c9a96e]/25 to-transparent" />
      {right}
    </div>
  );
}

// 游戏详情里的玩法演示：先是真实界面的静帧，点 ▶ 播放一段对局回放
function Preview({ game, en }: { game: GM; en: boolean }) {
  const [play, setPlay] = useState(false);
  const v = useIntroVoice();
  useEffect(() => { setPlay(false); v.stop(); }, [game]); // eslint-disable-line react-hooks/exhaustive-deps
  if (game === 'market') return null;
  const start = () => { setPlay(true); v.play(game, en ? 'en' : 'zh'); };
  const end = () => { setPlay(false); v.stop(); };
  return (
    <div className="mt-4 relative w-full rounded-xl overflow-hidden border border-[#d8c7a8]/[0.12] bg-[#0b0c0f]" style={{ aspectRatio: '1180 / 720' }}>
      <iframe key={`${game}-${play}`} src={`/screens.html${play ? '?play=1' : ''}#${game}`} title="" loading="lazy" scrolling="no" className="absolute inset-0 w-full h-full border-0 pointer-events-none" />
      {!play && (
        <button onClick={start} className="absolute inset-0 flex items-center justify-center bg-black/35 hover:bg-black/25 transition-colors group">
          <span className="flex items-center gap-2.5 pl-3 pr-4 py-2 rounded-full bg-[#0b0c0f]/80 backdrop-blur border border-[#c9a96e]/45 text-[13px] text-[#efe6d2] group-hover:border-[#c9a96e]/80">
            <span className="w-7 h-7 rounded-full bg-[#c9a96e] flex items-center justify-center"><svg width="11" height="11" viewBox="0 0 24 24" fill="#0b0c0f"><path d="M7 4l14 8-14 8z" /></svg></span>
            {en ? 'Watch & listen' : '看看怎么玩 · 有讲解'}
          </span>
        </button>
      )}
      {play && (
        <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 px-2.5 py-2 bg-gradient-to-t from-black/80 to-transparent">
          <span className="flex items-center gap-2 text-[11px] text-parchment/75">
            {v.state === 'loading' ? <span className="w-3 h-3 rounded-full border-2 border-parchment/25 border-t-parchment/80 animate-spin" />
              : v.state === 'playing' ? <span className="flex items-end gap-[2px] h-3">{[0, 1, 2].map((k) => <span key={k} className="w-[2px] rounded-full bg-[#c9a96e] mn-eq" style={{ animationDelay: `${k * 0.15}s`, animationDuration: '.6s' }} />)}</span> : null}
            {v.state === 'loading' ? (en ? 'Loading narration…' : '讲解加载中…') : v.state === 'playing' ? (en ? 'Narrating' : '讲解中') : ''}
          </span>
          <button onClick={end} className="px-2.5 py-1 rounded-full bg-black/60 text-[11px] text-parchment/75">{en ? 'Stop' : '停止'}</button>
        </div>
      )}
    </div>
  );
}
