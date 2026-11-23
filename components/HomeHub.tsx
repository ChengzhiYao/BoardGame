'use client';
// 首页第一屏：卖点 + 全部玩法（九宫格）+ 收费方式，手机一屏看全。点玩法弹出底部卡片看详情、开局。
import { useEffect, useState } from 'react';
import { type Lang } from '@/lib/i18n';
import { GAMES, type GM } from '@/components/GameShowcase';
import { FREE_MODES, FREE_PLAYS_ON_SIGNUP, MEMBERSHIP, MEMBER_PREMIUM_PLAYS } from '@/lib/pricing';

type Bi = { zh: string; en: string };
const L = (lang: Lang, b: Bi) => (lang === 'en' ? b.en : b.zh);

// 九宫格顺序 = 最常玩的在前
const ORDER: GM[] = ['soup', 'jbs', 'coc', 'botc', 'dnd', 'story', 'td', 'mcc', 'market'];
const TILE: Record<GM, { short: Bi; line: Bi; color: string; icon: JSX.Element }> = {
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
  story: { short: { zh: '讲故事', en: 'Storyteller' }, line: { zh: '读给你听', en: 'Read aloud' }, color: '#5aa0c4',
    icon: <><path d="M2 5.5c3-1 7-1 10 1 3-2 7-2 10-1v13c-3-1-7-1-10 1-3-2-7-2-10-1z" /><path d="M12 6.5v13" /></> },
  td: { short: { zh: '真心话', en: 'Truth or Dare' }, line: { zh: '派对现场出题', en: 'Party prompts' }, color: '#d9668f',
    icon: <><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z" /><path d="M12 8v4.5M12 15.5v.2" /></> },
  mcc: { short: { zh: '午夜猫诅咒', en: 'Cat Curse' }, line: { zh: '抽到就出局', en: 'Don’t draw it' }, color: '#8f7bd6',
    icon: <><path d="M4 20V9l3-5.5 3.5 4h3L17 3.5 20 9v11z" /><path d="M9 13.5h.01M15 13.5h.01M10.5 17h3" /></> },
  market: { short: { zh: '身价场', en: 'The Market' }, line: { zh: '买卖玩家冲榜', en: 'Trade players' }, color: '#c9a54a',
    icon: <><path d="M3 17l6-6 4 4 8-8" /><path d="M15 7h6v6" /></> },
};

export function HomeTopBar({ lang, onLang, account, onLogin, onLogout, menu }: {
  lang: Lang; onLang: (l: Lang) => void; account: any; onLogin: () => void; onLogout: () => void;
  menu: { label: string; onClick?: () => void; href?: string }[];
}) {
  const en = lang === 'en';
  const [open, setOpen] = useState(false);
  useEffect(() => { if (!open) return; const f = () => setOpen(false); window.addEventListener('scroll', f, { once: true }); return () => window.removeEventListener('scroll', f); }, [open]);
  return (
    <div className="fixed top-0 inset-x-0 z-40" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      <div className="mx-auto max-w-5xl h-12 px-3 flex items-center gap-2 bg-ink/55 backdrop-blur-md border-b border-white/5 sm:border-none sm:bg-transparent sm:backdrop-blur-0">
        <a href={en ? '/en' : '/zh'} className="font-serif font-bold text-[17px] text-[#f2ead9] tracking-wide">{en ? 'MystNight' : '谜夜'}</a>
        <div className="flex-1" />
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
          <div className="absolute right-3 top-[calc(env(safe-area-inset-top)+52px)] w-52 rounded-2xl bg-[#16181e]/95 backdrop-blur border border-white/10 shadow-2xl py-1.5 text-sm">
            {account?.loggedIn && <div className="px-4 py-2 text-xs text-parchment/45 truncate">{account.displayName || account.email}</div>}
            {menu.map((m, i) => m.href
              ? <a key={i} href={m.href} className="block px-4 py-2.5 text-parchment/85 hover:bg-white/5">{m.label}</a>
              : <button key={i} onClick={() => { setOpen(false); m.onClick?.(); }} className="block w-full text-left px-4 py-2.5 text-parchment/85 hover:bg-white/5">{m.label}</button>)}
            {account?.loggedIn && <button onClick={() => { setOpen(false); onLogout(); }} className="block w-full text-left px-4 py-2.5 text-parchment/50 hover:bg-white/5 border-t border-white/5 mt-1">{en ? 'Sign out' : '退出登录'}</button>}
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
    <div className="flex flex-wrap justify-center gap-1.5">
      {pts.map((p, i) => (
        <span key={i} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12.5px] text-parchment/85 bg-white/[0.06] border border-white/10 backdrop-blur">
          <span className="w-1 h-1 rounded-full bg-[#d9a441]" />{L(lang, p)}
        </span>
      ))}
    </div>
  );
}

export function GameGrid({ lang, onPick }: { lang: Lang; onPick: (g: GM) => void }) {
  return (
    <div className="grid grid-cols-3 gap-2 sm:gap-3 w-full">
      {ORDER.map((k) => {
        const t = TILE[k]; const free = FREE_MODES.includes(k);
        return (
          <button key={k} onClick={() => onPick(k)}
            className="relative text-left rounded-2xl px-2.5 pt-2.5 pb-2 sm:px-4 sm:pt-4 sm:pb-3.5 min-h-[84px] sm:min-h-[112px] bg-[#111318]/80 backdrop-blur border border-white/[0.08] hover:border-white/20 overflow-hidden"
            style={{ boxShadow: `inset 0 1px 0 rgba(255,255,255,.04), inset 0 -40px 40px -30px ${t.color}33` }}>
            <span className="absolute top-2 right-2 text-[10px] leading-none px-1.5 py-[3px] rounded-full font-medium"
              style={free ? { background: 'rgba(76,163,106,.2)', color: '#8fdca8' } : { background: 'rgba(217,164,65,.16)', color: '#e7c27a' }}>
              {free ? (lang === 'en' ? 'Free' : '免费') : '✦'}
            </span>
            <svg viewBox="0 0 24 24" fill="none" stroke={t.color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-[22px] h-[22px] sm:w-7 sm:h-7">{t.icon}</svg>
            <div className="mt-1.5 sm:mt-2.5 text-[14px] sm:text-[17px] font-semibold text-[#f2ead9] leading-tight truncate">{L(lang, t.short)}</div>
            <div className="text-[11px] sm:text-[13px] text-parchment/55 leading-tight truncate mt-0.5 sm:mt-1">{L(lang, t.line)}</div>
          </button>
        );
      })}
    </div>
  );
}

export function PricingStrip({ lang }: { lang: Lang }) {
  const en = lang === 'en';
  const m = MEMBERSHIP.monthly.price / 100, y = MEMBERSHIP.yearly.price / 100;
  const rows: { tag: string; color: string; text: string }[] = [
    { tag: en ? 'Free' : '免费', color: '#8fdca8', text: en ? 'Soup, Truth or Dare, Cat Curse, Market — 2 hrs every week' : '海龟汤 · 真心话 · 猫诅咒 · 身价场，每周 2 小时' },
    { tag: en ? 'New' : '新人', color: '#e7c27a', text: en ? `${FREE_PLAYS_ON_SIGNUP} free ✦ premium games when you sign up` : `注册送 ${FREE_PLAYS_ON_SIGNUP} 局 ✦ 豪华大作` },
    { tag: en ? 'Member' : '会员', color: '#f2ead9', text: en ? `$${m}/mo · unlimited free modes + ${MEMBER_PREMIUM_PLAYS} premium/mo ($${y}/yr)` : `$${m}/月 · 免费玩法无限 + 每月 ${MEMBER_PREMIUM_PLAYS} 局豪华（年付 $${y}）` },
  ];
  return (
    <a href="/upgrade" className="block w-full rounded-2xl bg-[#111318]/80 backdrop-blur border border-white/[0.08] px-3.5 py-2.5 sm:px-5 sm:py-4 text-left hover:border-white/20">
      <div className="sm:grid sm:grid-cols-3 sm:gap-5">
      {rows.map((r, i) => (
        <div key={i} className="flex items-baseline gap-2.5 py-[3px] sm:flex-col sm:gap-1">
          <span className={`shrink-0 ${en ? 'w-14' : 'w-9'} sm:w-auto text-[11.5px] sm:text-xs font-semibold`} style={{ color: r.color }}>{r.tag}</span>
          <span className="text-[12.5px] sm:text-[13.5px] text-parchment/80 leading-snug">{r.text}</span>
        </div>
      ))}
      </div>
      <div className="mt-1 sm:mt-2 text-[11.5px] text-parchment/45 text-right">{en ? 'Prices & packs →' : '价格与局数包 →'}</div>
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
      <div className="w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl bg-[#14161b] border border-white/10 shadow-2xl px-5 pt-3 text-left nf-in"
        style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }} onClick={(e) => e.stopPropagation()}>
        <div className="mx-auto w-10 h-1 rounded-full bg-white/15 mb-4 sm:hidden" />
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: `${t.color}22`, border: `1px solid ${t.color}55` }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={t.color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{t.icon}</svg>
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-serif text-xl font-bold text-[#f2ead9] leading-tight">{L(lang, g.name)}</div>
            <div className="text-xs text-parchment/50 mt-0.5">{L(lang, g.meta)}</div>
          </div>
          <span className="text-[11px] px-2 py-1 rounded-full font-medium shrink-0" style={free ? { background: 'rgba(76,163,106,.2)', color: '#8fdca8' } : { background: 'rgba(217,164,65,.16)', color: '#e7c27a' }}>
            {free ? (en ? 'Free' : '免费') : (en ? '✦ Premium' : '✦ 豪华')}
          </span>
        </div>
        <p className="mt-4 text-[15px] text-parchment/85 leading-relaxed">{L(lang, g.blurb)}</p>
        <ol className="mt-3 space-y-1.5">
          {g.rules.map((r, i) => (
            <li key={i} className="flex gap-2.5 text-sm text-parchment/70"><span className="font-mono text-xs mt-0.5 shrink-0" style={{ color: t.color }}>{String(i + 1).padStart(2, '0')}</span>{L(lang, r)}</li>
          ))}
        </ol>
        {!free && <div className="mt-3 text-xs text-parchment/45">{en ? `Uses 1 game (new accounts get ${FREE_PLAYS_ON_SIGNUP} free; members get ${MEMBER_PREMIUM_PLAYS}/month).` : `每局消耗 1 局（新号送 ${FREE_PLAYS_ON_SIGNUP} 局，会员每月送 ${MEMBER_PREMIUM_PLAYS} 局）。`}</div>}
        {needName && (
          <input value={name} onChange={(e) => { setName(e.target.value); try { localStorage.setItem('name', e.target.value); } catch {} }}
            placeholder={en ? 'Your nickname' : '你的昵称'} className="mt-4 w-full px-4 py-3 rounded-xl bg-ink border border-white/10 text-parchment placeholder:text-parchment/35 outline-none focus:border-eldritch" />
        )}
        <button onClick={() => onStart(game)} disabled={busy || (needName && !name.trim())}
          className="mt-4 w-full py-3.5 rounded-2xl text-white font-semibold text-base disabled:opacity-60" style={{ background: t.color }}>
          {busy ? (en ? 'Opening…' : '正在开房…') : (en ? `Start ${L(lang, t.short)}` : `开始${L(lang, t.short)}`)}
        </button>
      </div>
    </div>
  );
}
