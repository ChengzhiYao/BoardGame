'use client';
// Home — scrolling landing page: brand hero + per-game showcase
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ensureSession, signInWithGoogle, signOut } from '@/lib/auth';
import { tr, getClientLang, setClientLang, type Lang } from '@/lib/i18n';
import GameShowcase, { type GM } from '@/components/GameShowcase';

export default function Home() {
  const router = useRouter();
  const [lang, setLang] = useState<Lang>('zh');
  const [name, setName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [mode, setMode] = useState<'idle' | 'join'>('idle');
  const [gameMode, setGameMode] = useState<GM>('coc');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [showPromo, setShowPromo] = useState(false);
  const promoAudio = useRef<HTMLAudioElement | null>(null);
  const heroRef = useRef<HTMLElement | null>(null);
  const nameRef = useRef<HTMLInputElement | null>(null);
  function openPromo() { setShowPromo(true); try { const a = new Audio('/audio/veil-of-night/loop1.ogg'); a.loop = true; a.volume = 0.5; a.play().catch(() => {}); promoAudio.current = a; } catch {} }
  function closePromo() { setShowPromo(false); try { promoAudio.current?.pause(); promoAudio.current = null; } catch {} }
  useEffect(() => { setLang(getClientLang()); }, []);
  const t = tr(lang);

  function switchLang(l: Lang) { setLang(l); setClientLang(l); }

  function roomName(m: GM) {
    const suffix = lang === 'en'
      ? (m === 'soup' ? '’s Lateral Mystery' : m === 'td' ? '’s Truth or Dare' : m === 'jbs' ? '’s Murder Mystery' : m === 'botc' ? '’s Bloodbound' : m === 'mcc' ? '’s Cat Curse' : m === 'dnd' ? '’s D&D Quest' : m === 'story' ? '’s Story' : '’s Investigation')
      : (m === 'soup' ? ' 的海龟汤' : m === 'td' ? ' 的真心话大冒险' : m === 'jbs' ? ' 的剧本杀' : m === 'botc' ? ' 的血染' : m === 'mcc' ? ' 的午夜猫诅咒' : m === 'dnd' ? ' 的龙与地下城' : m === 'story' ? ' 的故事' : ' 的调查');
    return `${name.trim()}${suffix}`;
  }

  async function createRoom(m: GM = gameMode) {
    if (!name.trim()) {
      setErr(t('err_name'));
      heroRef.current?.scrollIntoView({ behavior: 'smooth' });
      setTimeout(() => nameRef.current?.focus(), 400);
      return;
    }
    setGameMode(m);
    setBusy(true);
    setErr('');
    try {
      await ensureSession(name.trim());
      const res = await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: roomName(m), displayName: name.trim(), mode: m, language: lang }),
      });
      const data = await res.json();
      if (res.status === 402) {
        try { localStorage.setItem('pendingGame', JSON.stringify({ mode: m, name: name.trim(), language: lang })); } catch {}
        router.push('/upgrade');
        return;
      }
      if (!res.ok) throw new Error(data.error || '创建失败');
      router.push(`/room/${data.roomId}`);
    } catch (e: any) {
      setErr(e.message);
      setBusy(false);
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
      <LangToggle lang={lang} onChange={switchLang} />
      <AccountBadge t={t} />

      <header ref={heroRef} className="w-full max-w-2xl flex flex-col items-center gap-5">
        <h1 className="text-4xl md:text-6xl font-serif tracking-wide text-parchment">{t('home_title')}</h1>
        <p className="max-w-xl text-parchment/70 leading-relaxed">{t('home_tagline')}</p>
        <button onClick={openPromo} className="text-sm px-4 py-1.5 rounded-full border border-eldritch/40 text-parchment/80 hover:bg-eldritch/20 transition">▶ {lang === 'en' ? 'Watch the trailer' : '观看宣传片'}</button>

        <input
          ref={nameRef}
          value={name}
          onChange={(e) => setName(e.target.value)}
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
        <div className="font-mono text-[11px] tracking-[.25em] uppercase text-eldritch/70">{lang === 'en' ? 'Eight games · one AI host' : '八种玩法 · 一个 AI 主持'}</div>
        <p className="max-w-md text-parchment/45 text-sm leading-relaxed">{lang === 'en' ? 'Every mode is generated live and runs in real time for one player or a full table. Pick one — the AI sets it all up.' : '每个模式都由 AI 现场生成、实时进行，单人或一桌人都能玩。挑一个，剩下的交给 AI。'}</p>
      </div>

      <GameShowcase lang={lang} busy={busy} onPlay={(m) => createRoom(m)} />

      <a href="/upgrade" className="text-parchment/40 hover:text-parchment text-sm underline">{t('home_upgrade_link')}</a>
      <AdminPanel lang={lang} />
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
    <button onClick={() => setMin(false)} title="Admin" className="fixed bottom-3 left-3 z-30 w-8 h-8 rounded-full bg-fog/90 border border-eldritch/30 text-eldritch text-sm flex items-center justify-center backdrop-blur">📊</button>
  );
  return (
    <div className="fixed bottom-3 left-3 z-30 rounded-lg bg-fog/90 border border-eldritch/30 px-3 py-2 text-xs text-parchment/80 backdrop-blur space-y-0.5 text-left max-w-[78vw]">
      <div className="flex items-center justify-between gap-3"><span className="text-eldritch font-medium">● Admin · live</span><button onClick={() => setMin(true)} className="text-parchment/50 hover:text-parchment text-base leading-none px-1">–</button></div>
      <div>🟢 {en ? 'Online' : '在线'} <span className="text-parchment">{s.activePlayers}</span> · {en ? 'active rooms' : '活跃房间'} <span className="text-parchment">{s.activeRooms}</span></div>
      <div>{en ? 'Users' : '历史玩家'} {s.distinctUsers} · {en ? 'played' : '已玩'} {s.gamesPlayed} · {en ? 'finished' : '完成'} {s.gamesFinished}</div>
      <div>{en ? 'Today' : '今日'}: {en ? 'new games' : '新局'} {s.roomsToday} · {en ? 'new players' : '新玩家'} {s.playersToday}</div>
      <div>{en ? 'Playtime' : '总时长'} {s.totalPlayMinutes}m · {en ? 'avg/game' : '均局'} {s.avgGameMinutes}m · {en ? 'msgs' : '消息'} {s.totalMessages}</div>
      <div className="text-parchment/40">CoC {s.modes?.coc ?? 0} · {en ? 'Soup' : '汤'} {s.modes?.soup ?? 0} · {en ? 'T/D' : '真'} {s.modes?.td ?? 0} · {en ? 'Murder' : '杀'} {s.modes?.jbs ?? 0}</div>
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
        <div className="flex items-center gap-1.5 sm:gap-2 rounded-full bg-fog/80 border border-eldritch/30 px-2.5 py-1.5 text-parchment/80 backdrop-blur min-w-0">
          <span className="truncate max-w-[28vw] sm:max-w-[150px] min-w-0" title={s.email}>{s.email}</span>
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
