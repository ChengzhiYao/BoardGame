'use client';
import { useEffect, useState } from 'react';
import { getClientLang } from '@/lib/i18n';

type St = any;
export default function MarketPage() {
  const [en, setEn] = useState(false);
  const L = (zh: string, e: string) => (en ? e : zh);
  const [s, setS] = useState<St | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState<'market' | 'team' | 'rank' | 'feed'>('market');
  const [busy, setBusy] = useState('');
  const [toast, setToast] = useState('');

  useEffect(() => { try { setEn(getClientLang() === 'en'); } catch {} }, []);
  async function load() { try { const r = await fetch('/api/market/state'); const d = await r.json(); setS(d); } catch {} setLoaded(true); }
  useEffect(() => { load(); const id = setInterval(load, 15000); return () => clearInterval(id); }, []);

  function flash(t: string) { setToast(t); setTimeout(() => setToast(''), 2600); }
  async function act(url: string, body?: any, label?: string) {
    setBusy(url + (body?.targetId || ''));
    try {
      const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
      const d = await r.json().catch(() => ({}));
      if (r.ok && d.ok) {
        if (d.reward) flash(L('领取 +' + d.reward, '+' + d.reward + ' claimed'));
        else if (d.earn) flash(L('打工赚了 +' + d.earn, 'Earned +' + d.earn));
        else if (d.gain) flash(L('讨好得到 +' + d.gain, 'Got +' + d.gain));
        else if (d.text) flash(d.text);
        else if (label) flash(label);
        await load();
      } else {
        const m: any = { poor: L('现金不够', 'Not enough cash'), protected: L('对方在保护期', 'Protected'), working: L('对方打工中', 'At work'), trade_limit: L('今日交易已达上限', 'Daily trade limit'), target_limit: L('对方今日已被买2次', 'Already bought twice today'), capped: L('对方持有满10,不可买', 'Holds 10, not buyable'), claimed: L('今天已领过', 'Already claimed'), used: L('今天已抽过', 'Already used'), free: L('你现在是自由身', 'You are free') };
        flash(m[d.reason] || L('操作失败', 'Failed'));
      }
    } catch { flash(L('网络错误', 'Network error')); }
    setBusy('');
  }

  if (!loaded) return <main className="min-h-screen flex items-center justify-center text-parchment/50">{L('加载中…', 'Loading…')}</main>;
  if (!s || !s.loggedIn) return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-4 text-parchment px-6 text-center">
      <p className="text-parchment/70">{L('登录后进入身价场。', 'Sign in to enter The Market.')}</p>
      <a href="/" className="px-5 py-2.5 rounded bg-blood/80 hover:bg-blood border border-blood">{L('返回首页', 'Home')}</a>
    </main>
  );
  const me = s.me;
  const fmt = (n: number) => n.toLocaleString();

  return (
    <main className="min-h-screen text-parchment px-4 sm:px-6 py-8 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-serif">{L('身价场', 'The Market')}</h1>
        <a href="/" className="text-sm text-parchment/50 hover:text-parchment">{L('← 返回', '← Home')}</a>
      </div>

      {/* my panel */}
      <div className="rounded-2xl border border-eldritch/30 bg-fog/60 p-4 mb-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
          <Stat k={L('现金', 'Cash')} v={fmt(me.cash)} />
          <Stat k={L('我的身价', 'My price')} v={fmt(me.price)} />
          <Stat k={L('总资产', 'Net worth')} v={fmt(me.assets)} />
          <Stat k={L('持有', 'Holding')} v={`${me.holdings}/${me.holdCap}`} />
        </div>
        <div className="mt-3 text-sm text-parchment/70 text-center">
          {me.ownerName ? L(`被 ${me.ownerName} 持有`, `Owned by ${me.ownerName}`) : me.protectedUntil && new Date(me.protectedUntil) > new Date() ? L('🛡 保护期中', '🛡 Protected') : L('自由身', 'Free agent')}
        </div>
        <div className="mt-3 flex flex-wrap gap-2 justify-center">
          <button disabled={!me.dailyAvailable || !!busy} onClick={() => act('/api/market/daily')} className="text-xs px-3 py-1.5 rounded bg-eldritch/60 hover:bg-eldritch disabled:opacity-40">{me.dailyAvailable ? L('领每日 +100', 'Daily +100') : L('今日已领', 'Claimed')}</button>
          <button disabled={!me.fateAvailable || !!busy} onClick={() => act('/api/market/fate')} className="text-xs px-3 py-1.5 rounded bg-blood/70 hover:bg-blood disabled:opacity-40">{me.fateAvailable ? L('🎴 命运卡', '🎴 Fate card') : L('命运卡(明日)', 'Fate (tomorrow)')}</button>
          {me.ownerName && <button disabled={!!busy} onClick={() => act('/api/market/please')} className="text-xs px-3 py-1.5 rounded bg-eldritch/50 hover:bg-eldritch">{L('讨好主人', 'Please owner')}</button>}
          {me.ownerName && <button disabled={!!busy} onClick={() => act('/api/market/redeem')} className="text-xs px-3 py-1.5 rounded bg-fog border border-eldritch/40 hover:bg-eldritch/30">{L(`赎身(${fmt(me.price)})`, `Redeem (${fmt(me.price)})`)}</button>}
          <button disabled={!!busy} onClick={() => act('/api/market/optout', { out: !me.optedOut })} className="text-xs px-3 py-1.5 rounded bg-fog border border-eldritch/30 text-parchment/60 hover:text-parchment">{me.optedOut ? L('重新加入市场', 'Rejoin market') : L('退出市场', 'Leave market')}</button>
        </div>
      </div>

      {/* tabs */}
      <div className="flex gap-4 text-sm mb-3 border-b border-eldritch/20 pb-2">
        {([['market', L('市场', 'Market')], ['team', L('我的队伍', 'My team')], ['rank', L('排行榜', 'Leaderboard')], ['feed', L('动态', 'Feed')]] as const).map(([k, lab]) => (
          <button key={k} onClick={() => setTab(k as any)} className={tab === k ? 'text-parchment font-medium' : 'text-parchment/40 hover:text-parchment'}>{lab}</button>
        ))}
      </div>

      {tab === 'market' && (
        <div className="space-y-2">
          {s.list.length === 0 && <div className="text-sm text-parchment/40 py-8 text-center">{L('市场里还没有其他玩家', 'No other players yet')}</div>}
          {s.list.map((r: any) => (
            <Row key={r.id} r={r} right={
              r.status === 'buyable'
                ? <button disabled={!!busy} onClick={() => act('/api/market/buy', { targetId: r.id }, L('买下 ' + r.name, 'Bought ' + r.name))} className="text-xs px-3 py-1.5 rounded bg-blood/80 hover:bg-blood shrink-0">{L('买入', 'Buy')} {fmt(r.price)}</button>
                : <span className="text-[11px] text-parchment/40 shrink-0">{({ mine: L('你持有', 'Yours'), protected: L('保护中', 'Protected'), working: L('打工中', 'Working'), capped: L('满10', 'Capped'), soldout: L('今日售罄', 'Sold out') } as any)[r.status] || ''}</span>
            } sub={r.ownerName ? L(`主人:${r.ownerName}`, `Owner: ${r.ownerName}`) : L('自由身', 'Free')} />
          ))}
        </div>
      )}

      {tab === 'team' && (
        <div className="space-y-2">
          {s.team.length === 0 && <div className="text-sm text-parchment/40 py-8 text-center">{L('还没有持有任何玩家 · 去市场买入', 'You own nobody yet · buy from the market')}</div>}
          {s.team.map((t: any) => (
            <Row key={t.id} r={t} sub={t.working ? L('打工中', 'At work') : L('空闲', 'Idle')} right={
              <div className="flex gap-1.5 shrink-0">
                <button disabled={!!busy || t.working} onClick={() => act('/api/market/work', { targetId: t.id })} className="text-[11px] px-2 py-1 rounded bg-eldritch/60 hover:bg-eldritch disabled:opacity-40">{L('打工', 'Work')}</button>
                <button disabled={!!busy} onClick={() => act('/api/market/interact', { targetId: t.id, kind: 'soothe' })} className="text-[11px] px-2 py-1 rounded bg-eldritch/40 hover:bg-eldritch">{L('安抚', 'Soothe')}</button>
                <button disabled={!!busy} onClick={() => act('/api/market/interact', { targetId: t.id, kind: 'torment' })} className="text-[11px] px-2 py-1 rounded bg-blood/60 hover:bg-blood">{L('折磨', 'Torment')}</button>
              </div>
            } />
          ))}
        </div>
      )}

      {tab === 'rank' && (
        <div className="space-y-2">
          {s.leaderboard.map((r: any, i: number) => (
            <Row key={r.id} r={r} rank={i + 1} right={<span className="text-sm text-amber-300/90 shrink-0">{fmt(r.assets)}</span>} sub={L('身价 ' + fmt(r.price), 'Price ' + fmt(r.price))} />
          ))}
        </div>
      )}

      {tab === 'feed' && (
        <div className="space-y-1.5">
          {s.feed.length === 0 && <div className="text-sm text-parchment/40 py-8 text-center">{L('还没有动态', 'No activity yet')}</div>}
          {s.feed.map((f: any, i: number) => (<div key={i} className="text-sm text-parchment/70 border-b border-eldritch/10 py-1.5">{f.text}</div>))}
        </div>
      )}

      {toast && <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full bg-ink border border-eldritch/40 text-parchment text-sm shadow-xl">{toast}</div>}
    </main>
  );
}

function Stat({ k, v }: { k: string; v: string }) { return (<div><div className="text-lg font-serif text-parchment">{v}</div><div className="text-[11px] text-parchment/45">{k}</div></div>); }
function Av({ url, name }: { url?: string | null; name: string }) {
  return url ? <img src={url} alt="" className="w-9 h-9 rounded-full object-cover border border-eldritch/30 shrink-0" /> : <span className="w-9 h-9 rounded-full bg-eldritch/40 flex items-center justify-center text-sm shrink-0">{(name || '?').slice(0, 1).toUpperCase()}</span>;
}
function Row({ r, right, sub, rank }: { r: any; right?: any; sub?: string; rank?: number }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-eldritch/15 bg-fog/40 px-3 py-2">
      {rank && <span className="w-5 text-center font-mono text-parchment/50 shrink-0">{rank}</span>}
      <Av url={r.avatar} name={r.name} />
      <div className="flex-1 min-w-0 leading-tight">
        <div className="truncate text-sm">{r.name}{typeof r.price === 'number' && <span className="text-parchment/45 text-xs ml-2">💰 {r.price.toLocaleString()}</span>}</div>
        {sub && <div className="text-[11px] text-parchment/40 truncate">{sub}</div>}
      </div>
      {right}
    </div>
  );
}
