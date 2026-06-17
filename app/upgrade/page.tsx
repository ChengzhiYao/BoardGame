'use client';
import { useEffect, useState } from 'react';
import { PACKS, CURRENCY_SYMBOL } from '@/lib/billing/plans';
import { signInWithGoogle, signOut } from '@/lib/auth';

const MODE_LABEL: Record<string, string> = { soup: '海龟汤', td: '真心话大冒险', coc: '调查' };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default function Upgrade() {
  const [status, setStatus] = useState<any>(null);
  const [busy, setBusy] = useState<string>('');
  const [err, setErr] = useState('');
  const [continuing, setContinuing] = useState('');

  async function load() {
    try { const res = await fetch('/api/billing/status'); setStatus(await res.json()); }
    catch { setStatus({ loggedIn: false }); }
  }

  // 把付款前暂存的"原本要开的那局"开出来，并跳进房间
  async function createPending(): Promise<boolean> {
    let pend: any = null;
    try { pend = JSON.parse(localStorage.getItem('pendingGame') || 'null'); } catch {}
    if (!pend) return false;
    const label = MODE_LABEL[pend.mode] || '调查';
    const res = await fetch('/api/rooms', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: `${pend.name || '调查员'} 的${label}`, displayName: pend.name, mode: pend.mode }),
    });
    const data = await res.json();
    if (res.ok && data.roomId) { localStorage.removeItem('pendingGame'); window.location.href = `/room/${data.roomId}`; return true; }
    return false;
  }

  // 付款成功回来：等 webhook 充值到账 → 自动开原本那局 → 进房间
  async function afterPaid() {
    setContinuing('支付成功，正在为你开房…');
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

  // 付款回来、正在自动开房：占位等待界面
  if (continuing) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center gap-4 text-center px-6">
        <div className="w-8 h-8 border-2 border-eldritch/30 border-t-eldritch rounded-full animate-spin" />
        <p className="text-parchment/80">{continuing}</p>
        <p className="text-parchment/40 text-sm">若几秒后没有自动跳转，<a href="/" className="underline text-parchment/70">点此返回首页开房</a>。</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex flex-col items-center px-6 py-12 gap-8">
      <div className="max-w-2xl text-center space-y-4">
        <h1 className="text-3xl md:text-4xl font-serif text-parchment">开房 · 购买局数</h1>
        <p className="text-parchment/75 leading-relaxed">
          为了还原真实的跑团体验，这里的<span className="text-eldritch">每一句剧情、每一条线索、每一个 NPC 都由高额智能 AI 实时生成</span>——没有固定脚本，世界随你的每一个选择而变。
          这背后是真金白银的算力成本，所以<span className="text-parchment">开房当主持需要购买局数</span>来维持运转。
        </p>
        <p className="text-parchment/55 text-sm">
          局数对所有模式通用：克苏鲁调查跑团 · 海龟汤 · 真心话大冒险，开房各消耗 1 局。
          <span className="text-parchment/75">被你邀请进房的朋友始终免费游玩，无需登录或付费。</span>
        </p>
      </div>

      {/* 账号状态 */}
      <div className="w-full max-w-md text-center">
        {!status ? (
          <div className="text-parchment/40 text-sm">读取账号中…</div>
        ) : status.loggedIn ? (
          <div className="rounded-lg bg-fog border border-eldritch/30 px-4 py-3 text-sm text-parchment/80 flex items-center justify-between gap-3">
            <span className="truncate">{status.email}</span>
            <span>{status.whitelisted ? '永久免费 ✓' : `剩余 ${status.credits} 局`}</span>
            <button onClick={async () => { await signOut(); load(); }} className="text-parchment/40 hover:text-parchment text-xs underline shrink-0">退出</button>
          </div>
        ) : (
          <button onClick={() => signInWithGoogle('/upgrade').catch((e) => setErr(e.message))}
            className="px-6 py-3 rounded bg-eldritch/70 hover:bg-eldritch text-parchment border border-eldritch">
            用 Google 登录后购买
          </button>
        )}
      </div>

      {/* 三档套餐 */}
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
              {status?.loggedIn && status?.whitelisted ? '你已永久免费' : busy === pk.id ? '跳转支付…' : status?.loggedIn ? '购买' : '登录后购买'}
            </button>
          </div>
        ))}
      </div>

      {err && <p className="text-blood text-sm">{err}</p>}
      <a href="/" className="text-parchment/40 hover:text-parchment text-sm underline">← 返回首页</a>
    </main>
  );
}
