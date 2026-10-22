'use client';
// HomeApp — the homepage UI, reusable for / and /zh /en (forcedLang locks the language).
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ensureSession, signInWithGoogle, signOut } from '@/lib/auth';
import { tr, getClientLang, setClientLang, type Lang } from '@/lib/i18n';
import GameShowcase, { type GM } from '@/components/GameShowcase';
import GameFeedback from '@/components/GameFeedback';

export default function HomeApp({ forcedLang }: { forcedLang?: Lang }) {
  const router = useRouter();
  const [lang, setLang] = useState<Lang>(forcedLang || 'zh');
  const [name, setName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [mode, setMode] = useState<'idle' | 'join'>('idle');
  const [gameMode, setGameMode] = useState<GM>('coc');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [showPromo, setShowPromo] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [showContact, setShowContact] = useState(false);
  const [resuming, setResuming] = useState(false);
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
  const promoAudio = useRef<HTMLAudioElement | null>(null);
  const heroRef = useRef<HTMLElement | null>(null);
  const nameRef = useRef<HTMLInputElement | null>(null);
  function openPromo() { setShowPromo(true); try { const a = new Audio('/audio/veil-of-night/loop1.ogg'); a.loop = true; a.volume = 0.5; a.play().catch(() => {}); promoAudio.current = a; } catch {} }
  function closePromo() { setShowPromo(false); try { promoAudio.current?.pause(); promoAudio.current = null; } catch {} }
  useEffect(() => { if (!forcedLang) setLang(getClientLang()); }, [forcedLang]);
  useEffect(() => {
    // 预填昵称：账号保存的昵称 > 上次填过的 > Google 邮箱前缀；登录用户以后不用再输名字
    fetch('/api/billing/status').then((r) => r.json()).then((d) => {
      if (d && d.displayName) { setName((prev) => prev || d.displayName); try { localStorage.setItem('name', d.displayName); } catch {} return; }
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
    const nm = (nameOverride ?? name).trim();
    if (!nm) {
      setErr(t('err_name'));
      heroRef.current?.scrollIntoView({ behavior: 'smooth' });
      setTimeout(() => nameRef.current?.focus(), 400);
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
        try { localStorage.setItem('pendingGame', JSON.stringify({ mode: m, name: nm, language: lang, ts: Date.now() })); } catch {}
        if (data.reason === 'login') { await signInWithGoogle('/' + lang).catch(() => {}); return; }
        router.push('/upgrade');
        return;
      }
      if (!res.ok) throw new Error(data.error || '创建失败');
      router.push(`/room/${data.roomId}`);
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
    <main className="min-h-screen flex flex-col items-center px-6 pt-24 pb-16 gap-6 text-center">
      <iframe
        src="/coc3d-demo.html?embed=1&full=1&auto=1"
        title=""
        aria-hidden
        tabIndex={-1}
        className="fixed inset-0 w-full h-full border-0 pointer-events-none -z-20"
      />
      <div className="fixed inset-0 pointer-events-none -z-10" style={{ background: 'radial-gradient(125% 85% at 50% 0%, rgba(12,13,16,.30), rgba(12,13,16,.68) 58%, rgba(12,13,16,.93))' }} />
      <LangToggle lang={lang} onChange={switchLang} />
      <AccountBadge t={t} />

      <header ref={heroRef} className="w-full max-w-2xl flex flex-col items-center gap-5">
        <h1 className="text-4xl md:text-6xl font-serif tracking-wide text-parchment">{t('home_title')}</h1>
        <p className="max-w-xl text-parchment/70 leading-relaxed">{t('home_tagline')}</p>
        <div className="flex items-center gap-3 flex-wrap justify-center">
          <button onClick={openPromo} className="text-sm px-4 py-1.5 rounded-full border border-eldritch/40 text-parchment/80 hover:bg-eldritch/20 transition">▶ {lang === 'en' ? 'Watch the trailer' : '观看宣传片'}</button>
          <a href={lang === 'en' ? '/en/blog' : '/zh/blog'} className="inline-flex items-center gap-1.5 text-sm px-4 py-1.5 rounded-full border border-eldritch/40 text-parchment/80 hover:bg-eldritch/20 transition"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M4 20.5A2.5 2.5 0 0 1 6.5 18H20" /></svg>{lang === 'en' ? 'Blog' : '博客'}</a>
          <button onClick={() => setShowFeedback(true)} className="inline-flex items-center gap-1.5 text-sm px-4 py-1.5 rounded-full border border-blood/50 text-parchment/90 bg-blood/15 hover:bg-blood/30 transition"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>{lang === 'en' ? 'Guestbook' : '留言板'}</button>
          <button onClick={() => { setShowContact(true); setContactState('idle'); }} className="inline-flex items-center gap-1.5 text-sm px-4 py-1.5 rounded-full border border-eldritch/40 text-parchment/80 hover:bg-eldritch/20 transition"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16v12H5.2L4 17.2z"/></svg>{lang === 'en' ? 'Contact' : '联系客服'}</button>
        </div>

        <input
          ref={nameRef}
          value={name}
          onChange={(e) => { setName(e.target.value); try { localStorage.setItem('name', e.target.value); } catch {} }}
          placeholder={t('home_name_ph')}
          className="w-72 px-4 py-3 rounded bg-fog border border-eldritch/40 text-parchment placeholder:text-parchment/30 outline-none focus:border-eldritch"
        />

        {mode === 'idle' ? (
          <div className="flex gap-3 flex-wrap justify-center">
            <button onClick={browseGames}
              className="px-6 py-3 rounded bg-blood/80 hover:bg-blood text-parchment border border-blood transition">
              {lang === 'en' ? 'Browse the games ↓' : '挑一个游戏 ↓'}
            </button>
            <button onClick={() => setMode('join')}
              className="px-6 py-3 rounded bg-fog hover:bg-eldritch/40 text-parchment border border-eldritch/50">
              {t('join_btn')}
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <input value={joinCode} onChange={(e) => setJoinCode(e.target.value)} placeholder={t('join_code_ph')}
              className="w-72 px-4 py-3 rounded bg-fog border border-eldritch/40 text-parchment placeholder:text-parchment/30 outline-none focus:border-eldritch" />
            <div className="flex gap-4">
              <button onClick={joinRoom} disabled={busy}
                className="px-6 py-3 rounded bg-eldritch/70 hover:bg-eldritch text-parchment border border-eldritch disabled:opacity-50">
                {busy ? t('joining') : t('join_do')}
              </button>
              <button onClick={() => setMode('idle')} className="px-6 py-3 rounded bg-fog text-parchment/70 border border-parchment/20">
                {t('back')}
              </button>
            </div>
          </div>
        )}

        {err && <p className="text-blood text-sm">{err}</p>}
      </header>

      <div className="mt-10 flex flex-col items-center gap-2">
        <div className="font-mono text-[11px] tracking-[.25em] uppercase text-eldritch/70">{lang === 'en' ? 'Nine games · one AI host' : '九种玩法 · 一个 AI 主持'}</div>
        <p className="max-w-md text-parchment/45 text-sm leading-relaxed">{lang === 'en' ? 'Every mode is generated live and runs in real time for one player or a full table. Pick one — the AI sets it all up.' : '每个模式都由 AI 现场生成、实时进行，单人或一桌人都能玩。挑一个，剩下的交给 AI。'}</p>
      </div>

      <GameShowcase lang={lang} busy={busy} onPlay={(m) => (m === 'meadow' ? router.push('/meadow') : createRoom(m))} />

      <a href="/upgrade" className="text-parchment/40 hover:text-parchment text-sm underline">{t('home_upgrade_link')}</a>
      <a href={lang === 'en' ? '/en/blog' : '/zh/blog'} className="text-parchment/40 hover:text-parchment text-sm underline">{lang === 'en' ? 'Blog' : '博客'}</a>
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

function LangToggle({ lang, onChange }: { lang: Lang; onChange: (l: Lang) => void }) {
  return (
    <div className="fixed top-3 left-3 z-20 flex rounded-full overflow-hidden border border-eldritch/30 text-xs">
      {(['zh', 'en'] as const).map((l) => (
        <button key={l} onClick={() => onChange(l)}
          className={`px-3 py-1.5 ${lang === l ? 'bg-eldritch/50 text-parchment' : 'bg-fog/70 text-parchment/50 hover:text-parchment'}`}>
          {l === 'zh' ? '中' : 'EN'}
        </button>
      ))}
    </div>
  );
}

function AccountBadge({ t }: { t: (k: string, v?: any) => string }) {
  const [s, setS] = useState<any>(null);
  async function load() {
    try { const r = await fetch('/api/billing/status'); setS(await r.json()); }
    catch { setS({ loggedIn: false }); }
  }
  useEffect(() => { load(); }, []);
  if (!s) return null;
  return (
    <div className="fixed top-3 right-3 z-20 text-xs max-w-[58vw]">
      {s.loggedIn ? (
        <div className="flex items-center gap-1.5 sm:gap-2 rounded-full bg-fog/80 border border-eldritch/30 px-2 py-1 text-parchment/80 backdrop-blur min-w-0">
          <a href="/account" title="账号资料" className="shrink-0">
            {s.avatarUrl
              ? <img src={s.avatarUrl} alt="" className="w-6 h-6 rounded-full object-cover border border-eldritch/40" />
              : <span className="w-6 h-6 rounded-full bg-eldritch/40 flex items-center justify-center text-parchment text-[11px]">{(s.displayName || s.email || '?').slice(0, 1).toUpperCase()}</span>}
          </a>
          <a href="/account" className="truncate max-w-[24vw] sm:max-w-[140px] min-w-0 hover:text-parchment" title={s.email}>{s.displayName || s.email}</a>
          <span className="text-eldritch shrink-0">{s.whitelisted ? t('free_forever') : `${s.credits} ${t('credits_left')}`}</span>
          <button onClick={async () => { await signOut(); load(); }} className="text-parchment/40 hover:text-parchment underline shrink-0">{t('logout')}</button>
        </div>
      ) : (
        <button onClick={() => signInWithGoogle('/').catch(() => {})}
          className="rounded-full bg-fog/80 border border-eldritch/30 px-3 py-1.5 text-parchment/70 hover:text-parchment backdrop-blur">
          {t('login_google')}
        </button>
      )}
    </div>
  );
}
