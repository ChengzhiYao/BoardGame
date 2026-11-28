'use client';
// HomeApp — the homepage UI, reusable for / and /zh /en (forcedLang locks the language).
import { useHomeBgSrc } from '@/components/useHomeBg';
import LingerPromo, { LingerToast } from '@/components/LingerPromo';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ensureSession, signInWithGoogle, signOut } from '@/lib/auth';
import { tr, getClientLang, setClientLang, type Lang } from '@/lib/i18n';
import { type GM } from '@/components/GameShowcase';
import GameFeedback from '@/components/GameFeedback';
import EmailLogin from '@/components/EmailLogin';
import { HomeTopBar, GameSheet } from '@/components/HomeHub';
import { DailyCard } from '@/components/Daily';
import SiteFooter from '@/components/SiteFooter';
import { LandingHero, LandingDemo, LandingWhy, LandingGames, LandingProof, LandingFaq, LandingFinal } from '@/components/Landing';

export default function HomeApp({ forcedLang }: { forcedLang?: Lang }) {
  const router = useRouter();
  const [lang, setLang] = useState<Lang>(forcedLang || 'zh');
  const [name, setName] = useState('');
  const [acctName, setAcctName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [mode, setMode] = useState<'idle' | 'join'>('idle');
  const [gameMode, setGameMode] = useState<GM>('coc');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [showPromo, setShowPromo] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [showContact, setShowContact] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [copied, setCopied] = useState(false);
  const [resuming, setResuming] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [account, setAccount] = useState<any>(null);
  const [picked, setPicked] = useState<GM | null>(null);
  const [loginGate, setLoginGate] = useState(false);
  const [gateEmail, setGateEmail] = useState(false);
  const [contactEmail, setContactEmail] = useState(''); const [contactMsg, setContactMsg] = useState('');
  const [contactState, setContactState] = useState<'idle' | 'sending' | 'ok' | 'err'>('idle');
  async function sendContact() {
    if (!contactMsg.trim()) return;
    setContactState('sending');
    try {
      const r = await fetch('/api/contact', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: contactEmail, message: contactMsg }) });
      const d = await r.json().catch(() => ({}));
      setContactState(r.ok && d.ok ? 'ok' : 'err');
      if (r.ok && d.ok) setContactMsg('');
    } catch { setContactState('err'); }
  }
  const inviteLink = (typeof window !== 'undefined' ? window.location.origin : 'https://www.mystnight.com');
  const inviteWho = name.trim() || (lang === 'en' ? 'A friend' : '有人');
  const inviteText = lang === 'en'
    ? `${inviteWho} invited you to play on MystNight!\nAn AI game master runs the whole table \u2014 murder mystery, Call of Cthulhu, lateral-thinking puzzles, D&D and more. Two players is all it takes, and every game is improvised live, so no two are ever the same.\nNo download \u2014 just open the link and play:\n${inviteLink}`
    : `${inviteWho} 邀请你来 MystNight 一起玩！\nAI 全程当主持人 \u2014\u2014 剧本杀、克苏鲁跑团、海龟汤、龙与地下城……两个人就能开一局，全程实时现编，每一局都不一样。\n免下载，点开链接就能玩：\n${inviteLink}`;
  async function copyInvite() {
    try { await navigator.clipboard.writeText(inviteText); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch {}
  }
  async function shareInvite() {
    const data = { title: 'MystNight 谜夜', text: inviteText };
    try { if ((navigator as any).share) { await (navigator as any).share(data); return; } } catch {}
    copyInvite();
  }
  const promoAudio = useRef<HTMLAudioElement | null>(null);
  const quickRef = useRef(false);
  // 老玩家打开首页 → 直接去「我的大厅」（加 ?landing=1 可以看介绍页）
  const [leaving, setLeaving] = useState(false);
  useEffect(() => {
    let ret = false, pend = false;
    try { ret = localStorage.getItem('mn_returning') === '1'; pend = !!localStorage.getItem('pendingGame'); } catch {}
    if (!ret || pend || /landing=1/.test(window.location.search)) return;
    setLeaving(true);
    fetch('/api/billing/status').then((r) => r.json()).then((d) => { if (d?.loggedIn) router.replace('/play'); else setLeaving(false); }).catch(() => setLeaving(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // 3D 背景跟着手机倾斜 / 鼠标移动转动视角。iPhone 要先点一下屏幕并允许“动作与方向”才拿得到倾斜数据。
  const bgRef = useRef<HTMLIFrameElement | null>(null);
  const bgSrc = useHomeBgSrc();
  useEffect(() => {
    let base: { b: number; g: number } | null = null;
    const send = (x: number, y: number) => { try { bgRef.current?.contentWindow?.postMessage({ type: 'tilt', x, y }, '*'); } catch {} };
    const onOri = (e: DeviceOrientationEvent) => {
      if (e.beta == null || e.gamma == null) return;
      if (!base) base = { b: e.beta, g: e.gamma }; // 以拿起手机时的角度为中心
      send((e.gamma - base.g) / 18, -(e.beta - base.b) / 22); // 约 18° 就到最大幅度，灵敏
    };
    const onMove = (e: PointerEvent) => { if (e.pointerType === 'mouse') send((e.clientX / innerWidth - 0.5) * 2, -(e.clientY / innerHeight - 0.5) * 2); };
    let asked = false;
    const ask = () => {
      if (asked) return; asked = true;
      const D: any = (window as any).DeviceOrientationEvent;
      if (D && typeof D.requestPermission === 'function') D.requestPermission().then((r: string) => { if (r === 'granted') window.addEventListener('deviceorientation', onOri); }).catch(() => {});
    };
    window.addEventListener('deviceorientation', onOri);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('touchend', ask, { once: true });
    window.addEventListener('click', ask, { once: true });
    return () => { window.removeEventListener('deviceorientation', onOri); window.removeEventListener('pointermove', onMove); window.removeEventListener('touchend', ask); window.removeEventListener('click', ask); };
  }, []);
  const heroRef = useRef<HTMLElement | null>(null);
  const nameRef = useRef<HTMLInputElement | null>(null);
  function openPromo() { setShowPromo(true); try { const a = new Audio('/audio/veil-of-night/loop1.ogg'); a.loop = true; a.volume = 0.5; a.play().catch(() => {}); promoAudio.current = a; } catch {} }
  function closePromo() { setShowPromo(false); try { promoAudio.current?.pause(); promoAudio.current = null; } catch {} }
  useEffect(() => { if (!forcedLang) setLang(getClientLang()); }, [forcedLang]);
  useEffect(() => {
    // 预填昵称：账号保存的昵称 > 上次填过的 > Google 邮箱前缀；登录用户以后不用再输名字
    fetch('/api/billing/status').then((r) => r.json()).then((d) => {
      setAccount(d || { loggedIn: false });
      if (d && d.whitelisted) setIsOwner(true);
      if (d && d.displayName) { setAcctName(d.displayName); setName((prev) => prev || d.displayName); try { localStorage.setItem('name', d.displayName); } catch {} return; }
      try { const n = localStorage.getItem('name'); if (n && n.trim()) { setName((prev) => prev || n.trim()); return; } } catch {}
      if (d && d.email) setName((prev) => prev || String(d.email).split('@')[0]);
    }).catch(() => { try { const n = localStorage.getItem('name'); if (n && n.trim()) setName((prev) => prev || n.trim()); } catch {} });
  }, []);
  useEffect(() => {
    (async () => {
      let pend: any = null; try { pend = JSON.parse(localStorage.getItem('pendingGame') || 'null'); } catch {}
      if (!pend || !pend.ts || Date.now() - pend.ts > 600000) { try { localStorage.removeItem('pendingGame'); } catch {} return; }
      setResuming(true);
      try { const r = await fetch('/api/billing/status'); const d = await r.json(); if (!d.loggedIn) { setResuming(false); return; } } catch { setResuming(false); return; }
      try { localStorage.removeItem('pendingGame'); } catch {}
      quickRef.current = !!pend.quick;
      createRoom(pend.mode, pend.name);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const t = tr(lang);

  function switchLang(l: Lang) { setClientLang(l); router.push('/' + l); }

  function roomName(m: GM, nm: string) {
    const suffix = lang === 'en'
      ? (m === 'soup' ? '’s Lateral Mystery' : m === 'td' ? '’s Truth or Dare' : m === 'jbs' ? '’s Murder Mystery' : m === 'botc' ? '’s Bloodbound' : m === 'mcc' ? '’s Cat Curse' : m === 'dnd' ? '’s D&D Quest' : m === 'story' ? '’s Story' : '’s Investigation')
      : (m === 'soup' ? ' 的海龟汤' : m === 'td' ? ' 的真心话大冒险' : m === 'jbs' ? ' 的剧本杀' : m === 'botc' ? ' 的血染' : m === 'mcc' ? ' 的午夜猫诅咒' : m === 'dnd' ? ' 的龙与地下城' : m === 'story' ? ' 的故事' : ' 的调查');
    return `${nm}${suffix}`;
  }

  async function createRoom(m: GM = gameMode, nameOverride?: string) {
    let nm = (nameOverride ?? name).trim();
    // 马上开玩：没填名字就先用默认名，之后在账号里能改
    if (!nm && (quickRef.current || m === 'soup')) { nm = lang === 'en' ? 'Player' : '玩家'; setName(nm); }
    if (!nm) {
      setErr(t('err_name'));
      if (!picked) { setPicked(m); }
      return;
    }
    setGameMode(m);
    setBusy(true);
    setErr('');
    try {
      await ensureSession(nm);
      const res = await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: roomName(m, nm), displayName: nm, mode: m, language: lang }),
      });
      const data = await res.json();
      if (res.status === 402) {
        try { localStorage.setItem('pendingGame', JSON.stringify({ mode: m, name: nm, language: lang, quick: quickRef.current, ts: Date.now() })); } catch {}
        if (data.reason === 'login') { setBusy(false); setResuming(false); setPicked(null); setLoginGate(true); return; }
        router.push('/upgrade');
        return;
      }
      if (!res.ok) throw new Error(data.error || '创建失败');
      try { localStorage.setItem('mn_returning', '1'); } catch {}
      router.push(`/room/${data.roomId}${quickRef.current && m === 'soup' ? '?quick=1' : ''}`);
    } catch (e: any) {
      setErr(e.message);
      setBusy(false);
      setResuming(false);
    }
  }

  async function joinRoom() {
    if (!name.trim()) return setErr(t('err_name'));
    if (!joinCode.trim()) return setErr(t('err_code'));
    setBusy(true);
    setErr('');
    try {
      await ensureSession(name.trim());
      router.push(`/join/${joinCode.trim()}`);
    } catch (e: any) {
      setErr(e.message);
      setBusy(false);
    }
  }

  function browseGames() {
    document.getElementById('games')?.scrollIntoView({ behavior: 'smooth' });
  }

  return (
    <main className="min-h-screen flex flex-col items-center text-center pb-16">
      {leaving && <div className="fixed inset-0 z-[90] bg-ink" />}
      <iframe
        ref={bgRef}
        src={bgSrc}
        title=""
        aria-hidden
        tabIndex={-1}
        className="fixed inset-0 w-full h-full border-0 pointer-events-none -z-20"
      />
      <div className="fixed inset-0 pointer-events-none -z-10" style={{ background: 'radial-gradient(125% 85% at 50% 0%, rgba(12,13,16,.30), rgba(12,13,16,.68) 58%, rgba(12,13,16,.93))' }} />
      <HomeTopBar lang={lang} onLang={switchLang} account={account}
        onLogin={() => setLoginGate(true)}
        onLogout={async () => { await signOut(); try { const r = await fetch('/api/billing/status'); setAccount(await r.json()); } catch { setAccount({ loggedIn: false }); } }}
        menu={[
          ...(account?.loggedIn ? [{ label: lang === 'en' ? 'My hall' : '我的大厅', href: '/play', icon: 'hall' as const, group: 1 }] : []),
          { label: lang === 'en' ? 'Invite friends' : '邀请好友', onClick: () => { setShowInvite(true); setCopied(false); }, icon: 'invite' as const, group: 1 },
          { label: lang === 'en' ? 'Join with a code' : '输入邀请码加入', onClick: () => setMode('join'), icon: 'code' as const, group: 1 },
          ...(account?.loggedIn ? [{ label: lang === 'en' ? 'My account' : '我的账号', href: '/account', icon: 'account' as const, group: 2 }] : []),
          ...(account?.loggedIn ? [{ label: lang === 'en' ? 'My collection' : '我的收藏', href: '/me', icon: 'trophy' as const, group: 2 }] : []),
          { label: lang === 'en' ? 'Leaderboard' : '排行榜', href: '/ranks', icon: 'trophy' as const, group: 2 },
          { label: lang === 'en' ? 'Prices & my games' : '价格与局数', href: '/upgrade', icon: 'price' as const, group: 2 },
          { label: lang === 'en' ? 'Partner program (earn 40%)' : '推广赚分成', href: '/partner', icon: 'invite' as const, group: 2 },
          { label: lang === 'en' ? 'Trailer' : '宣传片', onClick: openPromo, icon: 'play' as const, group: 3 },
          { label: lang === 'en' ? 'Music' : '音乐', href: '/music', icon: 'music' as const, group: 3 },
          { label: lang === 'en' ? 'Blog' : '博客', href: lang === 'en' ? '/en/blog' : '/zh/blog', icon: 'blog' as const, group: 3 },
          { label: lang === 'en' ? 'Guestbook' : '留言板', onClick: () => setShowFeedback(true), icon: 'book' as const, group: 3 },
          { label: lang === 'en' ? 'Contact us' : '联系我们', onClick: () => { setShowContact(true); setContactState('idle'); }, icon: 'mail' as const, group: 3 },
          ...(isOwner ? [{ label: lang === 'en' ? 'AI Companion' : 'AI 陪伴', href: '/companion', icon: 'heart' as const, group: 3 }] : []),
        ]} />

      <LandingHero lang={lang} busy={busy && gameMode === 'soup'} name={name} setName={setName} needName={!acctName}
        onPlay={() => { quickRef.current = true; createRoom('soup'); }}
        onMore={() => document.getElementById('demo')?.scrollIntoView({ behavior: 'smooth' })} />
      {err && <p className="-mt-16 mb-10 text-[#e06060] text-sm">{err}</p>}
      <div className="w-full max-w-md px-5 -mt-6 mb-12 space-y-2.5"><DailyCard en={lang === 'en'} /></div>
      <LandingDemo lang={lang} busy={busy && gameMode === 'soup'} onPlay={() => { quickRef.current = true; createRoom('soup'); }} />
      <LandingWhy lang={lang} />
      <LandingGames lang={lang} onPick={(g) => (g === 'market' ? router.push('/market') : setPicked(g))} />
      <LandingProof lang={lang} />
      <LandingFaq lang={lang} />
      <LandingFinal lang={lang} busy={busy && gameMode === 'soup'} onPlay={() => { quickRef.current = true; createRoom('soup'); }} />
      <SiteFooter lang={lang} />

      <GameSheet lang={lang} game={picked} busy={busy} needName={!acctName} name={name} setName={setName}
        onStart={(g) => { createRoom(g); }} onClose={() => setPicked(null)} />

      {mode === 'join' && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center" onClick={() => setMode('idle')}>
          <div className="w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl bg-[#0f1013] border border-[#d8c7a8]/15 px-5 pt-5 space-y-3 text-left" style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }} onClick={(e) => e.stopPropagation()}>
            <div className="font-serif text-lg text-[#efe6d2]">{lang === 'en' ? 'Join a friend’s game' : '加入朋友的房间'}</div>
            {!acctName && <input value={name} onChange={(e) => { setName(e.target.value); try { localStorage.setItem('name', e.target.value); } catch {} }} placeholder={t('home_name_ph')} className="w-full px-4 py-3 rounded-xl bg-ink border border-[#d8c7a8]/15 text-parchment placeholder:text-parchment/35 outline-none focus:border-[#c9a96e]/50" />}
            <input value={joinCode} onChange={(e) => setJoinCode(e.target.value)} placeholder={t('join_code_ph')} className="w-full px-4 py-3 rounded-xl bg-ink border border-[#d8c7a8]/15 text-parchment placeholder:text-parchment/35 outline-none focus:border-[#c9a96e]/50" />
            {err && <p className="text-[#e06060] text-sm">{err}</p>}
            <button onClick={joinRoom} disabled={busy} className="w-full py-3 rounded-xl bg-[#7d1d1d] border border-[#a83232]/60 text-[#f2ead9] font-serif tracking-[.15em] disabled:opacity-50">{busy ? t('joining') : t('join_do')}</button>
          </div>
        </div>
      )}

      <LingerPromo lang={lang} />
      <LingerToast lang={lang} />

      <a href="/upgrade" className="text-parchment/40 hover:text-parchment text-sm underline">{t('home_upgrade_link')}</a>
      <AdminPanel lang={lang} />
      {showFeedback && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-start sm:items-center justify-center p-4 overflow-y-auto" onClick={() => setShowFeedback(false)}>
          <div className="w-full max-w-lg my-auto rounded-2xl bg-fog border border-eldritch/40 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-eldritch/25">
              <span className="font-serif text-parchment">{lang === 'en' ? 'Guestbook · Feedback' : '留言板 · 反馈'}</span>
              <button onClick={() => setShowFeedback(false)} className="text-parchment/60 hover:text-parchment text-sm px-2">✕</button>
            </div>
            <div className="px-4 py-4 max-h-[75vh] overflow-y-auto text-left"><GameFeedback slug="site" en={lang === 'en'} /></div>
          </div>
        </div>
      )}
      {loginGate && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setLoginGate(false)}>
          <div className="w-full max-w-sm rounded-2xl bg-fog border border-eldritch/40 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-eldritch/25">
              <span className="font-serif text-parchment">{lang === 'en' ? 'Log in to play' : '登录即可开玩'}</span>
              <button onClick={() => setLoginGate(false)} className="text-parchment/60 hover:text-parchment text-sm px-2">✕</button>
            </div>
            <div className="px-4 py-4 space-y-3 text-left">
              <p className="text-parchment/55 text-sm">{lang === 'en' ? 'Sign in and your game starts right after — free to play.' : '登录后马上开始这局 — 免费畅玩。'}</p>
              <button onClick={() => signInWithGoogle('/play').catch(() => {})} className="w-full py-2.5 rounded bg-blood/80 hover:bg-blood text-parchment border border-blood text-sm">{t('login_google')}</button>
              <button onClick={() => { setLoginGate(false); setGateEmail(true); }} className="w-full py-2.5 rounded bg-fog hover:bg-eldritch/40 text-parchment border border-eldritch/50 text-sm">{t('login_email')}</button>
            </div>
          </div>
        </div>
      )}
      {gateEmail && <EmailLogin onClose={() => setGateEmail(false)} />}
      {showInvite && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-start sm:items-center justify-center p-4 overflow-y-auto" onClick={() => setShowInvite(false)}>
          <div className="w-full max-w-md my-auto rounded-2xl bg-fog border border-eldritch/40 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-eldritch/25">
              <span className="font-serif text-parchment">{lang === 'en' ? 'Invite friends' : '邀请好友'}</span>
              <button onClick={() => setShowInvite(false)} className="text-parchment/60 hover:text-parchment text-sm px-2">✕</button>
            </div>
            <div className="px-4 py-4 space-y-3 text-left">
              <p className="text-parchment/60 text-sm leading-relaxed">{lang === 'en' ? 'Two players is all it takes. Send this link to a friend — one click and you\u2019re playing together.' : '两个人就能开局。把链接发给朋友，他点开就能和你一起玩。'}</p>
              <button onClick={copyInvite} className="w-full py-3 rounded bg-blood/80 hover:bg-blood text-parchment border border-blood text-sm inline-flex items-center justify-center gap-2"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>{copied ? (lang === 'en' ? 'Copied! Paste it to a friend' : '已复制 · 粘贴给好友即可') : (lang === 'en' ? 'Copy invite message' : '复制邀请语')}</button>
              <button onClick={shareInvite} className="w-full py-2.5 rounded bg-eldritch/40 hover:bg-eldritch/60 text-parchment border border-eldritch/40 text-sm inline-flex items-center justify-center gap-2"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.6" y1="13.5" x2="15.4" y2="17.5"/><line x1="15.4" y1="6.5" x2="8.6" y2="10.5"/></svg>{lang === 'en' ? 'Share…' : '分享给好友…'}</button>
            </div>
          </div>
        </div>
      )}
      {showContact && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-start sm:items-center justify-center p-4 overflow-y-auto" onClick={() => setShowContact(false)}>
          <div className="w-full max-w-md my-auto rounded-2xl bg-fog border border-eldritch/40 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-eldritch/25">
              <span className="font-serif text-parchment">{lang === 'en' ? 'Contact support' : '联系客服'}</span>
              <button onClick={() => setShowContact(false)} className="text-parchment/60 hover:text-parchment text-sm px-2">✕</button>
            </div>
            <div className="px-4 py-4 space-y-3 text-left">
              <p className="text-parchment/55 text-sm">{lang === 'en' ? 'Questions, bugs or ideas? Send us a message — leave your email if you want a reply.' : '有问题、bug 或建议?给我们留个言——想收到回复就留下你的邮箱。'}</p>
              <input value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} placeholder={lang === 'en' ? 'Your email (optional)' : '你的邮箱(选填,便于回复)'} className="w-full px-3 py-2.5 rounded bg-ink border border-eldritch/40 text-parchment placeholder:text-parchment/30 outline-none focus:border-eldritch text-sm" />
              <textarea value={contactMsg} onChange={(e) => setContactMsg(e.target.value)} rows={5} placeholder={lang === 'en' ? 'Tell us what is going on…' : '说说你遇到的问题或想法…'} className="w-full px-3 py-2.5 rounded bg-ink border border-eldritch/40 text-parchment placeholder:text-parchment/30 outline-none focus:border-eldritch text-sm resize-none" />
              <div className="flex items-center gap-3">
                <button onClick={sendContact} disabled={contactState === 'sending' || !contactMsg.trim()} className="px-5 py-2 rounded bg-blood/80 hover:bg-blood text-parchment border border-blood disabled:opacity-40 text-sm">{contactState === 'sending' ? (lang === 'en' ? 'Sending…' : '发送中…') : (lang === 'en' ? 'Send' : '发送')}</button>
                {contactState === 'ok' && <span className="text-green-400 text-sm">{lang === 'en' ? 'Sent, thanks!' : '已发送,谢谢!'}</span>}
                {contactState === 'err' && <span className="text-blood text-sm">{lang === 'en' ? 'Failed, try again' : '发送失败,请重试'}</span>}
              </div>
            </div>
          </div>
        </div>
      )}
      {resuming && (
        <div className="fixed inset-0 z-[60] bg-ink/90 backdrop-blur-sm flex flex-col items-center justify-center gap-4 text-center px-6">
          <div className="w-9 h-9 border-2 border-eldritch/30 border-t-eldritch rounded-full animate-spin" />
          <p className="text-parchment/85 font-serif text-lg">{lang === 'en' ? 'Entering your game…' : '正在进入游戏…'}</p>
          <p className="text-parchment/40 text-sm">{lang === 'en' ? 'Setting up the room, hang tight.' : '正在为你准备房间,请稍候。'}</p>
        </div>
      )}
      {showPromo && (
        <div className="fixed inset-0 z-50 bg-black flex flex-col">
          <div className="flex items-center justify-between px-4 py-2 bg-ink/80 border-b border-eldritch/30">
            <span className="text-parchment/70 text-sm font-serif">MystNight {lang === 'en' ? '· Trailer' : '· 宣传片'}</span>
            <button onClick={closePromo} className="text-parchment/70 hover:text-parchment text-sm px-3 py-1 rounded border border-eldritch/40">{lang === 'en' ? 'Close ✕' : '关闭 ✕'}</button>
          </div>
          <iframe src="/promo.html" title="MystNight Trailer" className="flex-1 w-full border-0" />
        </div>
      )}
    </main>
  );
}

function AdminPanel({ lang }: { lang: Lang }) {
  const en = lang === 'en';
  const [s, setS] = useState<any | null>(null);
  const [min, setMin] = useState(false);
  async function load() {
    try { const r = await fetch('/api/admin/stats'); if (r.ok) setS(await r.json()); else setS(null); }
    catch { setS(null); }
  }
  useEffect(() => { load(); const id = setInterval(load, 15000); return () => clearInterval(id); }, []);
  if (!s) return null;
  if (min) return (
    <button onClick={() => setMin(false)} title="Admin" className="fixed bottom-3 left-3 z-30 w-8 h-8 rounded-full bg-fog/90 border border-white/20 flex items-center justify-center backdrop-blur hover:bg-fog"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="6" y1="20" x2="6" y2="13" /><line x1="12" y1="20" x2="12" y2="8" /><line x1="18" y1="20" x2="18" y2="4" /></svg></button>
  );
  return (
    <div className="fixed bottom-3 left-3 z-30 rounded-lg bg-fog/90 border border-eldritch/30 px-3 py-2 text-xs text-parchment/80 backdrop-blur space-y-0.5 text-left max-w-[78vw]">
      <div className="flex items-center justify-between gap-3"><span className="text-eldritch font-medium">● Admin · live</span><button onClick={() => setMin(true)} className="text-parchment/50 hover:text-parchment text-base leading-none px-1">–</button></div>
      <div>🟢 {en ? 'Online' : '在线'} <span className="text-parchment">{s.activePlayers}</span> · {en ? 'active rooms' : '活跃房间'} <span className="text-parchment">{s.activeRooms}</span></div>
      <div>{en ? 'Users' : '历史玩家'} {s.distinctUsers} · {en ? 'played' : '已玩'} {s.gamesPlayed} · {en ? 'finished' : '完成'} {s.gamesFinished}</div>
      <div>{en ? 'Today' : '今日'}: {en ? 'new games' : '新局'} {s.roomsToday} · {en ? 'new players' : '新玩家'} {s.playersToday}</div>
      <div>{en ? 'Playtime' : '总时长'} {s.totalPlayMinutes}m · {en ? 'avg/game' : '均局'} {s.avgGameMinutes}m · {en ? 'msgs' : '消息'} {s.totalMessages}</div>
      <div className="text-parchment/40">CoC {s.modes?.coc ?? 0} · {en ? 'Soup' : '汤'} {s.modes?.soup ?? 0} · {en ? 'T/D' : '真'} {s.modes?.td ?? 0} · {en ? 'Murder' : '杀'} {s.modes?.jbs ?? 0}</div>
      {s.traffic && <div className="pt-1 mt-1 border-t border-eldritch/15 text-parchment/80">👀 {en ? 'Views today' : '今日访问'} <span className="text-parchment">{s.traffic.pvToday}</span> · {en ? 'visitors' : '访客'} <span className="text-parchment">{s.traffic.uvToday}</span></div>}
      {s.traffic && <div>{en ? '7d visitors' : '近7天访客'} {s.traffic.uv7d} · {en ? 'from search' : '自然搜索'} <span className="text-eldritch">{s.traffic.organic7d}</span></div>}
      {s.traffic && s.traffic.topRefs?.length > 0 && <div className="text-parchment/40 truncate">{en ? 'src' : '来源'}: {s.traffic.topRefs.map((r: any) => `${r.ref}·${r.n}`).join('  ')}</div>}
      {s.traffic && s.traffic.topPages?.length > 0 && <div className="text-parchment/40 truncate">{en ? 'top' : '热门页'}: {s.traffic.topPages.map((r: any) => `${r.path}·${r.n}`).join('  ')}</div>}
    </div>
  );
}
