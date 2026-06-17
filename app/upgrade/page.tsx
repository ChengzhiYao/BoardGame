'use client';
import { useEffect, useState } from 'react';
import { PACKS, CURRENCY_SYMBOL } from '@/lib/billing/plans';
import { signInWithGoogle, signOut } from '@/lib/auth';
import { tr, getClientLang, type Lang } from '@/lib/i18n';

const MODE_LABEL: Record<string, string> = { soup: '海龟汤', td: '真心话大冒险', coc: '调查' };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default function Upgrade() {
  const [status, setStatus] = useState<any>(null);
  const [busy, setBusy] = useState<string>('');
  const [err, setErr] = useState('');
  const [continuing, setContinuing] = useState('');
  const [lang, setLang] = useState<Lang>('zh');
  useEffect(() => { setLang(getClientLang()); }, []);
  const t = tr(lang);

  async function load() {
    try { const res = await fetch('/api/billing/status'); setStatus(await res.json()); }
    catch { setStatus({ loggedIn: false }); }
  }

  async function createPending(): Promise<boolean> {
    let pend: any = null;
    try { pend = JSON.parse(localStorage.getItem('pendingGame') || 'null'); } catch {}
    if (!pend) return false;
    const label = MODE_LABEL[pend.mode] || '调查';
    const res = await fetch('/api/rooms', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: `${pend.name || '调查员'} 的${label}`, displayName: pend.name, mode: pend.mode, language: pend.language || lang }),
    });
    const data = await res.json();
    if (res.ok && data.roomId) { localStorage.removeItem('pendingGame'); window.location.href = `/room/${data.roomId}`; return true; }
    return false;
  }

  async function afterPaid() {
    setContinuing(t('up_paying_open'));
    for (let i = 0; i < 8; i++) {
      try { const r = await fetch('/api/billing/status'); const d = await r.json(); if (d.whitelisted || (d.credits || 0) > 0) break; } catch {}
      await sleep(1500);
    }
    const went = await createPending();
    if (!went) { setContinuing(''); load(); }
  }

  useEffect(() => {
    const paid = new URLSearchParams(window.location.search).get('paid') === '1';
    load();
    if (paid) afterPaid();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function buy(packId: string) {
    setBusy(packId); setErr('');
    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packId }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || '下单失败');
      if (d.url) window.location.href = d.url;
    } catch (e: any) { setErr(e.message); setBusy(''); }
  }

  if (continuing) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center gap-4 text-center px-6">
        <div className="w-8 h-8 border-2 border-eldritch/30 border-t-eldritch rounded-full animate-spin" />
        <p className="text-parchment/80">{continuing}</p>
        <p className="text-parchment/40 text-sm">{t('up_no_redirect_a')}<a href="/" className="underline text-parchment/70">{t('up_no_redirect_b')}</a>{t('up_no_redirect_c')}</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex flex-col items-center px-6 py-12 gap-8">
      <div className="max-w-2xl text-center space-y-4">
        <h1 className="text-3xl md:text-4xl font-serif text-parchment">{t('up_title')}</h1>
        <p className="text-parchment/75 leading-relaxed">
          {t('up_desc1a')}<span className="text-eldritch">{t('up_desc1b')}</span>{t('up_desc1c')}<span className="text-parchment">{t('up_desc1d')}</span>{t('up_desc1e')}
        </p>
        <p className="text-parchment/55 text-sm">
          {t('up_desc2a')}<span className="text-parchment/75">{t('up_desc2b')}</span>
        </p>
      </div>

      <div className="w-full max-w-md text-center">
        {!status ? (
          <div className="text-parchment/40 text-sm">{t('up_reading')}</div>
        ) : status.loggedIn ? (
          <div className="rounded-lg bg-fog border border-eldritch/30 px-4 py-3 text-sm text-parchment/80 flex items-center justify-between gap-3">
            <span className="truncate">{status.email}</span>
            <span>{status.whitelisted ? `${t('free_forever')} ✓` : `${status.credits} ${t('credits_left')}`}</span>
            <button onClick={async () => { await signOut(); load(); }} className="text-parchment/40 hover:text-parchment text-xs underline shrink-0">{t('logout')}</button>
          </div>
        ) : (
          <button onClick={() => signInWithGoogle('/upgrade').catch((e) => setErr(e.message))}
            className="px-6 py-3 rounded bg-eldritch/70 hover:bg-eldritch text-parchment border border-eldritch">
            {t('up_login_buy')}
          </button>
        )}
      </div>

      <div className="grid sm:grid-cols-3 gap-4 w-full max-w-3xl">
        {PACKS.map((pk) => (
          <div key={pk.id} className={`relative rounded-xl border p-5 flex flex-col items-center gap-3 bg-fog ${pk.tag === '最划算' ? 'border-blood/60' : 'border-eldritch/30'}`}>
            {pk.tag && <span className="absolute -top-2 right-3 text-[10px] px-2 py-0.5 rounded-full bg-blood/80 text-parchment">{pk.tag}</span>}
            <div className="font-serif text-parchment text-lg">{pk.label}</div>
            <div className="text-3xl font-serif text-parchment">{CURRENCY_SYMBOL}{(pk.price / 100).toFixed(2).replace(/\.00$/, '')}</div>
            <div className="text-parchment/45 text-xs">{pk.perGame}</div>
            <button
              onClick={() => (status?.loggedIn ? buy(pk.id) : signInWithGoogle('/upgrade').catch((e) => setErr(e.message)))}
              disabled={busy === pk.id || (status?.loggedIn && status?.whitelisted)}
              className="mt-1 w-full px-4 py-2 rounded bg-blood/80 hover:bg-blood text-parchment border border-blood disabled:opacity-40 text-sm">
              {status?.loggedIn && status?.whitelisted ? t('up_already_free') : busy === pk.id ? t('up_redirect') : status?.loggedIn ? t('up_buy') : t('up_login_then')}
            </button>
          </div>
        ))}
      </div>

      {err && <p className="text-blood text-sm">{err}</p>}
      <a href="/" className="text-parchment/40 hover:text-parchment text-sm underline">{t('up_back_home')}</a>
    </main>
  );
}
