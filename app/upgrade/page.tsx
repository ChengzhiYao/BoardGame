'use client';
import { useEffect, useState } from 'react';
import { PACKS, CURRENCY_SYMBOL } from '@/lib/billing/plans';
import { MEMBERSHIP, yearlySavingsPct } from '@/lib/pricing';
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
    const q = new URLSearchParams(window.location.search);
    load();
    if (q.get('paid') === '1') afterPaid();
    if (q.get('member') === '1') { setContinuing(lang === 'en' ? 'Activating membership…' : '正在开通会员…'); (async () => { for (let i = 0; i < 8; i++) { try { const r = await fetch('/api/billing/status'); const d = await r.json(); if (d.member) break; } catch {} await sleep(1500); } setContinuing(''); load(); })(); }
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

  async function buySub(plan: 'monthly' | 'yearly') {
    setBusy('sub-' + plan); setErr('');
    try {
      const res = await fetch('/api/billing/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ plan }) });
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
            <span>{status.member ? (lang === 'en' ? 'Member ✓' : '会员 ✓') : status.whitelisted ? `${t('free_forever')} ✓` : `${status.credits} ${t('credits_left')}`}</span>
            <button onClick={async () => { await signOut(); load(); }} className="text-parchment/40 hover:text-parchment text-xs underline shrink-0">{t('logout')}</button>
          </div>
        ) : (
          <button onClick={() => signInWithGoogle('/upgrade').catch((e) => setErr(e.message))}
            className="px-6 py-3 rounded bg-eldritch/70 hover:bg-eldritch text-parchment border border-eldritch">
            {t('up_login_buy')}
          </button>
        )}
      </div>

      <div className="w-full max-w-3xl">
        <div className="text-center mb-3">
          <div className="font-serif text-xl text-parchment">{lang === 'en' ? 'Membership · Unlimited play ✦' : '会员 · 无限畅玩 ✦'}</div>
          <p className="text-parchment/50 text-sm">{lang === 'en' ? 'Every mode, no limits — no credits, no weekly time cap.' : '所有模式无限玩,不耗局数、没有每周时长限制。'}</p>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="rounded-xl border border-eldritch/30 bg-fog p-5 flex flex-col items-center gap-2">
            <div className="font-serif text-parchment text-lg">{lang === 'en' ? 'Monthly' : '月费'}</div>
            <div className="text-3xl font-serif text-parchment">{CURRENCY_SYMBOL}{(MEMBERSHIP.monthly.price / 100).toFixed(0)}<span className="text-sm text-parchment/50">{lang === 'en' ? '/mo' : ' /月'}</span></div>
            <button onClick={() => (status?.loggedIn ? buySub('monthly') : signInWithGoogle('/upgrade').catch((e) => setErr(e.message)))} disabled={busy === 'sub-monthly' || (status?.loggedIn && status?.member)}
              className="mt-1 w-full px-4 py-2 rounded bg-eldritch/60 hover:bg-eldritch text-parchment border border-eldritch disabled:opacity-40 text-sm">
              {status?.member ? (lang === 'en' ? 'Current member' : '已是会员') : busy === 'sub-monthly' ? t('up_redirect') : status?.loggedIn ? (lang === 'en' ? 'Subscribe' : '开通会员') : t('up_login_then')}
            </button>
          </div>
          <div className="relative rounded-xl border border-amber-500/50 bg-fog p-5 flex flex-col items-center gap-2 shadow-[0_0_30px_-12px_rgba(245,197,100,.5)]">
            <span className="absolute -top-2 right-3 text-[10px] px-2 py-0.5 rounded-full bg-amber-500/90 text-ink font-semibold">{lang === 'en' ? `Save ${yearlySavingsPct()}%` : `省 ${yearlySavingsPct()}%`}</span>
            <div className="font-serif text-parchment text-lg">{lang === 'en' ? 'Yearly' : '年费'}</div>
            <div className="text-3xl font-serif text-parchment">{CURRENCY_SYMBOL}{(MEMBERSHIP.yearly.price / 100).toFixed(0)}<span className="text-sm text-parchment/50">{lang === 'en' ? '/yr' : ' /年'}</span></div>
            <div className="text-parchment/45 text-xs">{lang === 'en' ? `~$5/mo · ${yearlySavingsPct()}% cheaper than monthly` : `约 $5/月 · 比月费省 ${yearlySavingsPct()}%`}</div>
            <button onClick={() => (status?.loggedIn ? buySub('yearly') : signInWithGoogle('/upgrade').catch((e) => setErr(e.message)))} disabled={busy === 'sub-yearly' || (status?.loggedIn && status?.member)}
              className="mt-1 w-full px-4 py-2 rounded bg-blood/80 hover:bg-blood text-parchment border border-blood disabled:opacity-40 text-sm">
              {status?.member ? (lang === 'en' ? 'Current member' : '已是会员') : busy === 'sub-yearly' ? t('up_redirect') : status?.loggedIn ? (lang === 'en' ? 'Subscribe · best value' : '开通 · 最划算') : t('up_login_then')}
            </button>
          </div>
        </div>
        <div className="text-center text-parchment/35 text-xs mt-6 mb-2">{lang === 'en' ? 'Or buy one-off hosting credits for premium modes:' : '或单独购买豪华大作的局数：'}</div>
      </div>

      <div className="grid sm:grid-cols-3 gap-4 w-full max-w-3xl">
        {PACKS.map((pk) => (
          <div key={pk.id} className={`relative rounded-xl border p-5 flex flex-col items-center gap-3 bg-fog ${pk.best ? 'border-blood/60' : 'border-eldritch/30'}`}>
            {pk.tag && <span className="absolute -top-2 right-3 text-[10px] px-2 py-0.5 rounded-full bg-blood/80 text-parchment">{pk.tag[lang === 'en' ? 'en' : 'zh']}</span>}
            <div className="font-serif text-parchment text-lg">{pk.label[lang === 'en' ? 'en' : 'zh']}</div>
            <div className="text-3xl font-serif text-parchment">{CURRENCY_SYMBOL}{(pk.price / 100).toFixed(2).replace(/\.00$/, '')}</div>
            <div className="text-parchment/45 text-xs">{pk.perGame[lang === 'en' ? 'en' : 'zh']}</div>
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
