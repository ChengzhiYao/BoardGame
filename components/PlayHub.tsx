'use client';
// 「我的大厅」：老玩家每次打开谜夜看到的地方——进行中的局、再开一局、玩过的局、我的额度。
import PartyPass from '@/components/PartyPass';
import { DailyCard } from '@/components/Daily';
import { LevelChip, CheckinButton } from '@/components/Progress';
import OpenRooms from '@/components/OpenRooms';
import RanksCard from '@/components/RanksCard';
import TonightCard from '@/components/TonightCard';
import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getClientLang, setClientLang, type Lang } from '@/lib/i18n';
import { signOut, signInWithGoogle } from '@/lib/auth';
import { startRoom } from '@/lib/startRoom';
import EmailLogin from '@/components/EmailLogin';
import { HomeTopBar, GameGrid, GameSheet, ResumeRooms, SectionLabel, TILE } from '@/components/HomeHub';
import { type GM } from '@/components/GameShowcase';

type Hist = { id: string; name: string; mode: GM; at: string; mins: number; people: number; ending: string };

export default function PlayHub() {
  const router = useRouter();
  const [lang, setLang] = useState<Lang>('zh');
  const en = lang === 'en';
  const [acct, setAcct] = useState<any>(null);
  const [name, setName] = useState('');
  const [hist, setHist] = useState<Hist[] | null>(null);
  const [picked, setPicked] = useState<GM | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState('');
  const [loginGate, setLoginGate] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const bgRef = useRef<HTMLIFrameElement | null>(null);

  useEffect(() => {
    setLang(getClientLang());
    try { localStorage.setItem('mn_returning', '1'); } catch {}
    fetch('/api/billing/status').then((r) => r.json()).then((d) => {
      setAcct(d || { loggedIn: false });
      const n = d?.displayName || (() => { try { return localStorage.getItem('name') || ''; } catch { return ''; } })() || (d?.email ? String(d.email).split('@')[0] : '');
      setName(n);
      // 登录前点了要登录的游戏：登录回来直接开
      let pend: any = null; try { pend = JSON.parse(localStorage.getItem('pendingGame') || 'null'); } catch {}
      if (d?.loggedIn && pend?.ts && Date.now() - pend.ts < 600000) { try { localStorage.removeItem('pendingGame'); } catch {} go(pend.mode, pend.name || n, !!pend.quick); }
    }).catch(() => setAcct({ loggedIn: false }));
    fetch('/api/rooms/history').then((r) => r.json()).then((d) => setHist(Array.isArray(d?.rooms) ? d.rooms : [])).catch(() => setHist([]));
    // 3D 背景跟着倾斜/鼠标
    const send = (x: number, y: number) => { try { bgRef.current?.contentWindow?.postMessage({ type: 'tilt', x, y }, '*'); } catch {} };
    let base: any = null;
    const onOri = (e: DeviceOrientationEvent) => { if (e.beta == null || e.gamma == null) return; if (!base) base = { b: e.beta, g: e.gamma }; send((e.gamma - base.g) / 18, -(e.beta - base.b) / 22); };
    const onMove = (e: PointerEvent) => { if (e.pointerType === 'mouse') send((e.clientX / innerWidth - 0.5) * 2, -(e.clientY / innerHeight - 0.5) * 2); };
    window.addEventListener('deviceorientation', onOri); window.addEventListener('pointermove', onMove);
    return () => { window.removeEventListener('deviceorientation', onOri); window.removeEventListener('pointermove', onMove); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function go(mode: GM | string, nm?: string, quick = false) {
    if (mode === 'market') { router.push('/market'); return; }
    const n = (nm ?? name).trim() || (en ? 'Player' : '玩家');
    setBusy(String(mode)); setErr('');
    const r = await startRoom(String(mode), n, en ? 'en' : 'zh', { quick });
    if (r.url) { window.location.href = r.url; return; }
    setBusy(null);
    if (r.login) { setPicked(null); setLoginGate(true); return; }
    if (r.upgrade) { router.push('/upgrade'); return; }
    setErr(r.error || '');
  }

  const hour = new Date().getHours();
  const hello = en ? (hour < 5 ? 'Still up' : hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening') : (hour < 5 ? '夜深了' : hour < 12 ? '早上好' : hour < 18 ? '下午好' : '晚上好');
  const dateLine = new Date().toLocaleDateString(en ? 'en-US' : 'zh-CN', { month: 'long', day: 'numeric', weekday: 'short' });
  const hm = (s: number) => { const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60); return en ? `${h}h ${m}m` : `${h} 小时 ${m} 分`; };
  const when = (iso: string) => { const d = new Date(iso); const days = Math.floor((Date.now() - d.getTime()) / 86400000); return days < 1 ? (en ? 'Today' : '今天') : days < 2 ? (en ? 'Yesterday' : '昨天') : d.toLocaleDateString(en ? 'en-US' : 'zh-CN', { month: 'short', day: 'numeric' }); };
  const shownHist = (hist || []).slice(0, showAll ? 20 : 5);

  return (
    <main className="min-h-screen flex flex-col items-center">
      <iframe ref={bgRef} src="/coc3d-demo.html?embed=1&full=1&auto=1" title="" aria-hidden tabIndex={-1} className="fixed inset-0 w-full h-full border-0 pointer-events-none -z-20" />
      <div className="fixed inset-0 pointer-events-none -z-10" style={{ background: 'linear-gradient(to bottom, rgba(12,13,16,.55), rgba(12,13,16,.86) 40%, rgba(12,13,16,.95))' }} />
      <HomeTopBar lang={lang} home="/play" onLang={(l) => { setClientLang(l); setLang(l); }} account={acct}
        onLogin={() => setLoginGate(true)}
        onLogout={async () => { await signOut(); window.location.href = en ? '/en' : '/zh'; }}
        menu={[
          ...(acct?.loggedIn ? [{ label: en ? 'My account' : '我的账号', href: '/account', icon: 'account' as const, group: 1 }] : []),
          ...(acct?.loggedIn ? [{ label: en ? 'My collection' : '我的收藏', href: '/me', icon: 'trophy' as const, group: 1 }] : []),
          { label: en ? 'Daily Soup' : '每日一汤', href: '/daily', icon: 'play' as const, group: 1 },
          { label: en ? 'Leaderboard' : '排行榜', href: '/ranks', icon: 'trophy' as const, group: 1 },
          { label: en ? 'Tonight’s Ghost Story' : '今夜怪谈', href: '/tonight', icon: 'music' as const, group: 1 },
          { label: en ? 'Prices & my games' : '价格与局数', href: '/upgrade', icon: 'price' as const, group: 1 },
          { label: en ? 'About MystNight' : '关于谜夜', href: en ? '/en?landing=1' : '/zh?landing=1', icon: 'about' as const, group: 2 },
          { label: en ? 'Music' : '音乐', href: '/music', icon: 'music' as const, group: 3 },
          { label: en ? 'Blog' : '博客', href: en ? '/en/blog' : '/zh/blog', icon: 'blog' as const, group: 3 },
        ]} />

      <div className="w-full max-w-3xl px-4 sm:px-6 flex flex-col gap-6 sm:gap-8 pb-20" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 72px)' }}>
        {/* 问候 + 我的额度 */}
        <section className="relative">
          {acct?.loggedIn && <div className="absolute right-0 top-0"><CheckinButton en={en} /></div>}
          <div className="text-[11px] tracking-[.25em] text-[#c9a96e]/70">{dateLine}</div>
          <h1 className={`mt-1.5 ${acct?.loggedIn ? 'pr-20' : ''} font-serif font-semibold text-[28px] sm:text-4xl tracking-wide text-[#efe6d2] truncate`}>{hello}{name ? (en ? `, ${name}` : `，${name}`) : ''}</h1>
          {acct?.loggedIn && <div><LevelChip en={en} /></div>}
          {acct?.loggedIn && (
            <a href="/upgrade" className="mt-3 flex items-center gap-x-4 gap-y-1 flex-wrap text-[12.5px] text-parchment/60">
              {acct.whitelisted || acct.member
                ? <span><span className="text-[#c9a96e]">✦ {en ? 'Member' : '会员'}</span>{acct.memberPremiumLimit ? (en ? ` · ${Math.max(0, acct.memberPremiumLimit - (acct.memberPremiumUsed || 0))} premium left this month` : ` · 本月豪华还剩 ${Math.max(0, acct.memberPremiumLimit - (acct.memberPremiumUsed || 0))} 局`) : ''}</span>
                : <>
                    <span>{en ? 'Premium games ' : '豪华局数 '}<b className="text-[#ece3cf] font-serif">{acct.credits ?? 0}</b></span>
                    <span className="text-[#c9a96e]">{en ? 'Get more →' : '获取更多 →'}</span>
                  </>}
            </a>
          )}
          {acct && !acct.loggedIn && (
            <button onClick={() => setLoginGate(true)} className="mt-3 text-[13px] text-[#c9a96e] border-b border-[#c9a96e]/40">{en ? 'Sign in to keep your games and history →' : '登录后，你的局和记录会一直保存 →'}</button>
          )}
        </section>

        <ResumeRooms lang={lang} heading={en ? 'In progress' : '进行中'} />

        <OpenRooms en={en} onLogin={() => setLoginGate(true)} />

        <section>
          <SectionLabel>{en ? 'Start a game' : '开一局'}</SectionLabel>
          <div className="mb-3 space-y-2.5"><DailyCard en={en} /><TonightCard en={en} /><RanksCard en={en} /></div>
          {!acct?.whitelisted && <div className="mb-3"><PartyPass en={en} until={acct?.partyUntil} /></div>}
          <GameGrid lang={lang} onPick={(g) => (g === 'market' ? router.push('/market') : setPicked(g))} />
          {err && <p className="mt-2 text-sm text-[#e06060]">{err}</p>}
        </section>

        <section>
          <SectionLabel right={(hist?.length || 0) > 5 ? <button onClick={() => setShowAll((v) => !v)} className="text-[12px] text-parchment/50 hover:text-parchment shrink-0">{showAll ? (en ? 'Less' : '收起') : (en ? `All ${hist!.length}` : `全部 ${hist!.length} 局`)}</button> : null}>
            {en ? 'Played' : '玩过的局'}
          </SectionLabel>
          {hist === null && <div className="space-y-2">{[0, 1, 2].map((i) => <div key={i} className="h-[74px] rounded-xl bg-white/[0.03] animate-pulse" />)}</div>}
          {hist && hist.length === 0 && (
            <div className="rounded-xl border border-dashed border-[#d8c7a8]/15 px-5 py-7 text-center">
              <div className="font-serif text-[15px] text-parchment/70">{en ? 'No finished games yet.' : '还没有玩完的局。'}</div>
              <button onClick={() => go('soup')} disabled={!!busy} className="mt-2 text-[13px] text-[#c9a96e] border-b border-[#c9a96e]/40">{busy === 'soup' ? (en ? 'Opening…' : '正在开房…') : (en ? 'Start with a 15-minute lateral puzzle →' : '先来一碗 15 分钟的海龟汤 →')}</button>
            </div>
          )}
          <div className="flex flex-col gap-2">
            {shownHist.map((h) => {
              const t = TILE[h.mode];
              return (
                <div key={h.id} className="flex items-stretch rounded-xl bg-[#0b0c0f]/60 backdrop-blur-md border border-[#d8c7a8]/[0.12] overflow-hidden">
                  <a href={`/room/${h.id}`} className="flex-1 min-w-0 flex gap-3 px-4 py-3 hover:bg-white/[0.02]">
                    <span className="mt-0.5 w-8 h-8 rounded-lg border border-[#d8c7a8]/15 flex items-center justify-center shrink-0">
                      {t && <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" className="text-[#d8c7a8]/60">{t.icon}</svg>}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block truncate font-serif text-[15px] text-[#ece3cf]">{t ? (en ? t.short.en : t.short.zh) : h.name}</span>
                      <span className="block text-[11.5px] text-parchment/45 mt-0.5">{when(h.at)} · {h.people} {en ? (h.people > 1 ? 'players' : 'player') : '人'} · {h.mins} {en ? 'min' : '分钟'}</span>
                      {h.ending && <span className="block mt-1 font-serif italic text-[12.5px] text-parchment/55 line-clamp-1">“{h.ending}”</span>}
                    </span>
                  </a>
                  <button onClick={() => go(h.mode)} disabled={!!busy} title={en ? 'Play this again' : '同样的玩法再来一局'}
                    className="shrink-0 px-3.5 flex flex-col items-center justify-center gap-0.5 border-l border-[#d8c7a8]/[0.08] text-[#c9a96e] hover:bg-[#c9a96e]/[0.06] disabled:opacity-50">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" /></svg>
                    <span className="text-[10.5px] tracking-wider">{busy === h.mode ? '…' : (en ? 'Again' : '再来')}</span>
                  </button>
                </div>
              );
            })}
          </div>
        </section>

        <footer className="flex items-center justify-center gap-5 text-[12px] text-parchment/35 pt-2">
          <a href={en ? '/en?landing=1' : '/zh?landing=1'} className="hover:text-parchment/70">{en ? 'About MystNight' : '关于谜夜'}</a>
          <a href="/upgrade" className="hover:text-parchment/70">{en ? 'Prices' : '价格'}</a>
          <a href={en ? '/en/blog' : '/zh/blog'} className="hover:text-parchment/70">{en ? 'Blog' : '博客'}</a>
        </footer>
      </div>

      <GameSheet lang={lang} game={picked} busy={!!busy} needName={!acct?.displayName} name={name} setName={setName} onStart={(g) => go(g)} onClose={() => setPicked(null)} />

      {loginGate && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center" onClick={() => setLoginGate(false)}>
          <div className="w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl bg-[#0f1013] border border-[#d8c7a8]/15 px-5 pt-5 space-y-3" style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }} onClick={(e) => e.stopPropagation()}>
            <div className="font-serif text-lg text-[#efe6d2]">{en ? 'Sign in to play' : '登录后开始'}</div>
            <p className="text-parchment/55 text-sm">{en ? 'Your game starts right after you sign in.' : '登录后马上开始这局，你的记录也会一直保存。'}</p>
            <button onClick={() => signInWithGoogle('/play').catch(() => {})} className="w-full py-3 rounded-xl bg-[#7d1d1d] border border-[#a83232]/60 text-[#f2ead9] text-sm">{en ? 'Continue with Google' : '用 Google 登录'}</button>
            <button onClick={() => { setLoginGate(false); setEmailOpen(true); }} className="w-full py-3 rounded-xl border border-[#d8c7a8]/20 text-parchment/80 text-sm">{en ? 'Use email' : '用邮箱登录'}</button>
          </div>
        </div>
      )}
      {emailOpen && <EmailLogin onClose={() => setEmailOpen(false)} />}
    </main>
  );
}
