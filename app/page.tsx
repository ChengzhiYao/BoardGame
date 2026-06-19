'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ensureSession, signInWithGoogle, signOut } from '@/lib/auth';
import { tr, getClientLang, setClientLang, type Lang } from '@/lib/i18n';

export default function Home() {
  const router = useRouter();
  const [lang, setLang] = useState<Lang>('zh');
  const [name, setName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [mode, setMode] = useState<'idle' | 'join'>('idle');
  const [gameMode, setGameMode] = useState<'coc' | 'soup' | 'td' | 'jbs' | 'botc' | 'mcc'>('coc');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  useEffect(() => { setLang(getClientLang()); }, []);
  const t = tr(lang);

  function switchLang(l: Lang) { setLang(l); setClientLang(l); }

  function roomName() {
    const suffix = lang === 'en'
      ? (gameMode === 'soup' ? '’s Lateral Mystery' : gameMode === 'td' ? '’s Truth or Dare' : gameMode === 'jbs' ? '’s Murder Mystery' : gameMode === 'botc' ? '’s Bloodbound' : gameMode === 'mcc' ? '’s Cat Curse' : '’s Investigation')
      : (gameMode === 'soup' ? ' 的海龟汤' : gameMode === 'td' ? ' 的真心话大冒险' : gameMode === 'jbs' ? ' 的剧本杀' : gameMode === 'botc' ? ' 的血染' : gameMode === 'mcc' ? ' 的午夜猫诅咒' : ' 的调查');
    return `${name.trim()}${suffix}`;
  }

  async function createRoom() {
    if (!name.trim()) return setErr(t('err_name'));
    setBusy(true);
    setErr('');
    try {
      await ensureSession(name.trim());
      const res = await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: roomName(), displayName: name.trim(), mode: gameMode, language: lang }),
      });
      const data = await res.json();
      if (res.status === 402) {
        try { localStorage.setItem('pendingGame', JSON.stringify({ mode: gameMode, name: name.trim(), language: lang })); } catch {}
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

  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-7 px-6 text-center">
      <LangToggle lang={lang} onChange={switchLang} />
      <AccountBadge t={t} />
      <h1 className="text-4xl md:text-5xl font-serif tracking-wide text-parchment">{t('home_title')}</h1>
      <p className="max-w-md text-parchment/70 leading-relaxed">{t('home_tagline')}</p>

      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={t('home_name_ph')}
        className="w-72 px-4 py-3 rounded bg-fog border border-eldritch/40 text-parchment placeholder:text-parchment/30 outline-none focus:border-eldritch"
      />

      {mode === 'idle' && (
        <div className="flex gap-2 flex-wrap justify-center">
          {(['coc', 'soup', 'td', 'jbs', 'botc', 'mcc'] as const).map((k) => (
            <button key={k} onClick={() => setGameMode(k)}
              className={`px-4 py-2 rounded text-sm border ${gameMode === k ? 'bg-blood/30 border-blood text-parchment' : 'bg-fog border-eldritch/30 text-parchment/60'}`}>
              {t(`mode_${k}`)}
            </button>
          ))}
        </div>
      )}

      {mode === 'idle' ? (
        <div className="flex gap-4">
          <button onClick={createRoom} disabled={busy}
            className="px-6 py-3 rounded bg-blood/80 hover:bg-blood text-parchment border border-blood disabled:opacity-50">
            {busy ? t('starting') : t(`create_${gameMode}`)}
          </button>
          <button onClick={() => setMode('join')} disabled={busy}
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
      <a href="/upgrade" className="text-parchment/40 hover:text-parchment text-sm underline">{t('home_upgrade_link')}</a>
      <AdminPanel lang={lang} />
    </main>
  );
}

function AdminPanel({ lang }: { lang: Lang }) {
  const en = lang === 'en';
  const [s, setS] = useState<any | null>(null);
  async function load() {
    try { const r = await fetch('/api/admin/stats'); if (r.ok) setS(await r.json()); else setS(null); }
    catch { setS(null); }
  }
  useEffect(() => { load(); const id = setInterval(load, 15000); return () => clearInterval(id); }, []);
  if (!s) return null;
  return (
    <div className="fixed bottom-3 left-3 z-30 rounded-lg bg-fog/90 border border-eldritch/30 px-3 py-2 text-xs text-parchment/80 backdrop-blur space-y-0.5 text-left">
      <div className="text-eldritch font-medium">● Admin · live</div>
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
    <div className="fixed top-3 right-3 z-20 text-xs">
      {s.loggedIn ? (
        <div className="flex items-center gap-2 rounded-full bg-fog/80 border border-eldritch/30 px-3 py-1.5 text-parchment/80 backdrop-blur">
          <span className="truncate max-w-[150px]" title={s.email}>{s.email}</span>
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
