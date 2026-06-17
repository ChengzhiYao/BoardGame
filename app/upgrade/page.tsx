'use client';
import { useEffect, useState } from 'react';
import { PACKS } from '@/lib/billing/plans';
import { signInWithGoogle, signOut } from '@/lib/auth';

export default function Upgrade() {
  const [status, setStatus] = useState<any>(null);
  const [busy, setBusy] = useState<string>('');
  const [err, setErr] = useState('');

  async function load() {
    try {
      const res = await fetch('/api/billing/status');
      setStatus(await res.json());
    } catch { setStatus({ loggedIn: false }); }
  }
  useEffect(() => { load(); }, []);

  const paid = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('paid') === '1';

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

      {paid && <div className="text-emerald-300 bg-emerald-900/20 border border-emerald-700/40 rounded px-4 py-2">支付成功，局数已到账。可以回去开房了。</div>}

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
            <div className="text-3xl font-serif text-parchment">¥{(pk.price / 100).toFixed(2).replace(/\.00$/, '')}</div>
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
