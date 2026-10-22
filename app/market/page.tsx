'use client';
import { useEffect, useMemo, useState } from 'react';
import { getClientLang } from '@/lib/i18n';

export default function MarketPage() {
  const [en, setEn] = useState(false);
  const L = (zh: string, e: string) => (en ? e : zh);
  const [s, setS] = useState<any>(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState('');
  const [toast, setToast] = useState('');
  const [q, setQ] = useState('');
  const [onlyAfford, setOnlyAfford] = useState(false);

  useEffect(() => { try { setEn(getClientLang() === 'en'); } catch {} }, []);
  async function load() { try { const r = await fetch('/api/market/state'); setS(await r.json()); } catch {} setLoaded(true); }
  useEffect(() => { load(); const id = setInterval(load, 15000); return () => clearInterval(id); }, []);

  function flash(t: string) { setToast(t); setTimeout(() => setToast(''), 2600); }
  async function act(url: string, body?: any) {
    setBusy(url + (body?.targetId || ''));
    try {
      const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
      const d = await r.json().catch(() => ({}));
      if (r.ok && d.ok) {
        if (d.reward) flash('+' + d.reward); else if (d.earn) flash(L('打工 +' + d.earn, 'Work +' + d.earn));
        else if (d.gain) flash(L('讨好 +' + d.gain, '+' + d.gain)); else if (d.text) flash(d.text);
        else if (d.cost) flash(L('赎身成功', 'Redeemed')); else if (url.includes('buy')) flash(L('买入成功', 'Bought'));
        await load();
      } else {
        const m: any = { poor: L('现金不够', 'Not enough cash'), protected: L('对方保护期中', 'Protected'), working: L('对方打工中', 'At work'), trade_limit: L('今日交易上限', 'Daily trade limit'), target_limit: L('对方今日已被买2次', 'Bought twice today'), capped: L('对方满10不可买', 'Holds 10'), claimed: L('今天已领', 'Claimed'), used: L('今天已抽', 'Used'), free: L('你是自由身', 'You are free') };
        flash(m[d.reason] || L('操作失败', 'Failed'));
      }
    } catch { flash(L('网络错误', 'Network error')); }
    setBusy('');
  }

  const me = s?.me;
  const list = useMemo(() => {
    let l = (s?.list || []);
    if (q.trim()) l = l.filter((r: any) => r.name.toLowerCase().includes(q.trim().toLowerCase()));
    if (onlyAfford && me) l = l.filter((r: any) => r.status === 'buyable' && r.price <= me.cash);
    return l;
  }, [s, q, onlyAfford, me]);

  if (!loaded) return <main className="min-h-screen flex items-center justify-center text-parchment/50">{L('加载中…', 'Loading…')}</main>;
  if (!s || !s.loggedIn) return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-4 text-parchment px-6 text-center">
      <p className="text-parchment/70">{L('登录后进入身价场。', 'Sign in to enter The Market.')}</p>
      <a href="/" className="px-5 py-2.5 rounded bg-blood/80 hover:bg-blood border border-blood">{L('返回首页', 'Home')}</a>
    </main>
  );
  const fmt = (n: number) => '¥' + (n || 0).toLocaleString();
  const protectedNow = me.protectedUntil && new Date(me.protectedUntil) > new Date();

  return (
    <main className="min-h-screen text-parchment px-4 sm:px-6 py-7 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-serif">{L('身价场', 'The Market')} <span className="text-parchment/40 text-sm">· The Market</span></h1>
        <a href="/" className="text-sm text-parchment/50 hover:text-parchment">{L('← 返回', '← Home')}</a>
      </div>

      {/* 我的身价 */}
      <div className="rounded-2xl border border-eldritch/30 bg-fog/60 p-4 mb-5 flex flex-col sm:flex-row gap-4 items-start">
        <Av url={me.avatar} name={me.name} big />
        <div className="flex-1 text-sm leading-relaxed text-parchment/70">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="text-lg text-parchment">{me.name}</div>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30">{(en ? me.rank.en : me.rank.zh)} · Lv.{me.rank.level}</span>
          </div>
          <div className="flex items-center gap-2 mt-1 mb-0.5">
            <div className="h-1.5 rounded-full bg-ink overflow-hidden w-40"><div className="h-full bg-amber-400/70" style={{ width: (me.rank.prog * 100) + '%' }} /></div>
            <span className="text-[10px] text-parchment/40">{me.rank.nextMin ? `${me.rank.exp}/${me.rank.nextMin} EXP` : 'MAX'}</span>
          </div>
          <div className="mt-1 grid grid-cols-2 gap-x-6 gap-y-0.5">
            <span>{L('身价', 'Price')} <b className="text-amber-300">{fmt(me.price)}</b></span>
            <span>{L('总资产', 'Net worth')} <b className="text-amber-300">{fmt(me.assets)}</b></span>
            <span>{L('现金', 'Cash')} <b className="text-parchment">{fmt(me.cash)}</b></span>
            <span>{L('持有', 'Holding')} <b className="text-parchment">{me.holdings}/{me.holdCap}</b></span>
          </div>
          <div className="mt-1.5 text-parchment/55">{me.ownerName ? L(`被 ${me.ownerName} 持有`, `Owned by ${me.ownerName}`) : protectedNow ? L('🛡 保护期中', '🛡 Protected') : L('自由身', 'Free agent')}</div>
        </div>
        <div className="flex flex-wrap gap-2 sm:flex-col sm:items-end sm:text-right">
          <button disabled={!me.dailyAvailable || !!busy} onClick={() => act('/api/market/daily')} className="text-xs px-3 py-1.5 rounded bg-eldritch/60 hover:bg-eldritch disabled:opacity-40">{me.dailyAvailable ? L('领每日 +100', 'Daily +100') : L('今日已领', 'Claimed')}</button>
          <button disabled={!me.fateAvailable || !!busy} onClick={() => act('/api/market/fate')} className="text-xs px-3 py-1.5 rounded bg-blood/70 hover:bg-blood disabled:opacity-40">{me.fateAvailable ? L('🎴 命运卡', '🎴 Fate card') : L('命运卡(明日)', 'Fate (tomorrow)')}</button>
          {me.ownerName && <button disabled={!!busy} onClick={() => act('/api/market/please')} className="text-xs px-3 py-1.5 rounded bg-eldritch/50 hover:bg-eldritch">{L('讨好主人', 'Please owner')}</button>}
          {me.ownerName && <button disabled={!!busy} onClick={() => act('/api/market/redeem')} className="text-xs px-3 py-1.5 rounded bg-fog border border-eldritch/40 hover:bg-eldritch/30">{L(`赎身 ${fmt(me.price)}`, `Redeem ${fmt(me.price)}`)}</button>}
          <button disabled={!!busy} onClick={() => act('/api/market/optout', { out: !me.optedOut })} className="text-xs px-3 py-1.5 rounded bg-fog border border-eldritch/30 text-parchment/60 hover:text-parchment">{me.optedOut ? L('重新加入', 'Rejoin') : L('退出市场', 'Leave')}</button>
        </div>
      </div>

      <div className="rounded-xl border border-eldritch/25 bg-fog/40 px-4 py-3 mb-5 flex flex-wrap items-center gap-x-5 gap-y-2">
        <span className="text-sm text-parchment/80">{L('每日任务', 'Daily quests')}</span>
        <Quest ok={me.quest.buy >= 1} label={L('买入 1 人', 'Buy 1')} />
        <Quest ok={me.quest.work >= 1} label={L('打工 1 次', 'Work 1')} />
        <Quest ok={me.quest.social >= 1} label={L('互动 1 次', 'Interact 1')} />
        <button disabled={!me.quest.canClaim || !!busy} onClick={() => act('/api/market/quest')} className="ml-auto text-xs px-3 py-1.5 rounded bg-amber-600/70 hover:bg-amber-600 text-ink font-medium disabled:opacity-40 disabled:text-parchment">{me.quest.claimed ? L('今日已领', 'Claimed') : L('领取 +200', 'Claim +200')}</button>
      </div>

      <div className="grid md:grid-cols-[1fr_300px] gap-5">
        {/* left */}
        <div className="space-y-6">
          {/* 购买 */}
          <div>
            <div className="flex items-center gap-3 mb-2.5">
              <div className="text-sm text-parchment/80">{L('购买玩家', 'Buy players')}</div>
              <label className="text-[11px] text-parchment/45 flex items-center gap-1 cursor-pointer"><input type="checkbox" checked={onlyAfford} onChange={(e) => setOnlyAfford(e.target.checked)} /> {L('只看买得起的', 'Affordable only')}</label>
            </div>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={L('搜索玩家…', 'Search players…')} className="w-full mb-3 px-3 py-2 rounded-lg bg-ink border border-eldritch/30 text-parchment placeholder:text-parchment/30 text-sm outline-none focus:border-eldritch" />
            <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
              {list.length === 0 && <div className="text-sm text-parchment/40 py-6 text-center">{L('没有匹配的玩家', 'No players')}</div>}
              {list.map((r: any) => (
                <Row key={r.id} r={r} sub={r.ownerName ? L(`主人:${r.ownerName}`, `Owner: ${r.ownerName}`) : L('自由身', 'Free')} right={
                  r.status === 'buyable'
                    ? <button disabled={!!busy || r.price > me.cash} onClick={() => act('/api/market/buy', { targetId: r.id })} className="text-xs px-3 py-1.5 rounded bg-blood/80 hover:bg-blood disabled:opacity-40 shrink-0">{L('买入', 'Buy')} {fmt(r.price)}</button>
                    : <span className="text-[11px] text-parchment/40 shrink-0">{({ mine: L('你持有', 'Yours'), protected: L('保护中', 'Protected'), working: L('打工中', 'Working'), capped: L('满10', 'Capped'), soldout: L('今日售罄', 'Sold out') } as any)[r.status] || ''}</span>
                } />
              ))}
            </div>
          </div>

          {/* 我的队伍 */}
          <div>
            <div className="text-sm text-parchment/80 mb-2.5">{L('我的队伍', 'My team')}</div>
            <div className="space-y-2">
              {s.team.length === 0 && <div className="text-sm text-parchment/40 py-4">{L('还没有持有玩家 · 去上面买入', 'You own nobody yet')}</div>}
              {s.team.map((t: any) => (
                <Row key={t.id} r={t} sub={t.working ? L('打工中', 'At work') : L('空闲', 'Idle')} right={
                  <div className="flex gap-1.5 shrink-0">
                    <button disabled={!!busy || t.working} onClick={() => act('/api/market/work', { targetId: t.id })} className="text-[11px] px-2 py-1 rounded bg-eldritch/60 hover:bg-eldritch disabled:opacity-40">{L('打工', 'Work')}</button>
                    <button disabled={!!busy} onClick={() => act('/api/market/interact', { targetId: t.id, kind: 'soothe' })} className="text-[11px] px-2 py-1 rounded bg-eldritch/40 hover:bg-eldritch">{L('安抚', 'Soothe')}</button>
                    <button disabled={!!busy} onClick={() => act('/api/market/interact', { targetId: t.id, kind: 'torment' })} className="text-[11px] px-2 py-1 rounded bg-blood/60 hover:bg-blood">{L('折磨', 'Torment')}</button>
                    <button disabled={!!busy} onClick={() => { const n = window.prompt(L('给 TA 起个绰号(留空清除)', 'Nickname (blank to clear)'), ''); if (n !== null) act('/api/market/nick', { targetId: t.id, name: n }); }} className="text-[11px] px-2 py-1 rounded bg-fog border border-eldritch/30 text-parchment/60 hover:text-parchment">{L('绰号', 'Rename')}</button>
                    <button disabled={!!busy} onClick={() => act('/api/market/release', { targetId: t.id })} className="text-[11px] px-2 py-1 rounded bg-fog border border-eldritch/30 text-parchment/50 hover:text-parchment">{L('释放', 'Release')}</button>
                  </div>
                } />
              ))}
            </div>
          </div>
        </div>

        {/* right */}
        <div className="space-y-6">
          {me.ownerName && (
            <div>
              <div className="text-[11px] tracking-wider uppercase text-parchment/40 mb-2">{L('我的主人', 'My owner')}</div>
              <div className="rounded-xl border border-eldritch/20 bg-fog/40 px-3 py-2.5 text-sm text-parchment/75">{me.ownerName}</div>
            </div>
          )}
          <div>
            <div className="text-[11px] tracking-wider uppercase text-parchment/40 mb-2">{L('总资产排行榜', 'Leaderboard')}</div>
            <div className="space-y-1.5">
              {s.leaderboard.map((r: any, i: number) => (
                <div key={r.id} className="flex items-center gap-2.5 text-sm">
                  <span className="w-4 text-center text-parchment/45">{i + 1}</span>
                  <Av url={r.avatar} name={r.name} />
                  <span className="flex-1 truncate">{r.name}</span>
                  <span className="text-amber-300/90 text-xs">{fmt(r.assets)}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <div className="text-[11px] tracking-wider uppercase text-parchment/40 mb-2">{L('事件记录', 'Activity')}</div>
            <div className="space-y-0">
              {s.feed.length === 0 && <div className="text-sm text-parchment/40 py-3">{L('还没有动态', 'No activity')}</div>}
              {s.feed.map((f: any, i: number) => (<div key={i} className="text-xs text-parchment/60 border-t border-eldritch/10 py-2">{f.text}</div>))}
            </div>
          </div>
        </div>
      </div>

      {toast && <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full bg-ink border border-eldritch/40 text-parchment text-sm shadow-xl">{toast}</div>}
    </main>
  );
}

function Quest({ ok, label }: { ok: boolean; label: string }) {
  return <span className={`text-xs flex items-center gap-1 ${ok ? 'text-green-400' : 'text-parchment/45'}`}>{ok ? '✓' : '○'} {label}</span>;
}
function Av({ url, name, big }: { url?: string | null; name: string; big?: boolean }) {
  const c = big ? 'w-16 h-16 text-2xl' : 'w-8 h-8 text-sm';
  return url ? <img src={url} alt="" className={`${c} rounded-full object-cover border border-eldritch/30 shrink-0`} /> : <span className={`${c} rounded-full bg-eldritch/40 flex items-center justify-center shrink-0`}>{(name || '?').slice(0, 1).toUpperCase()}</span>;
}
function Row({ r, right, sub }: { r: any; right?: any; sub?: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-eldritch/15 bg-fog/40 px-3 py-2">
      <Av url={r.avatar} name={r.name} />
      <div className="flex-1 min-w-0 leading-tight">
        <div className="truncate text-sm">{r.name}{typeof r.price === 'number' && <span className="text-amber-300/80 text-xs ml-2">💰 {r.price.toLocaleString()}</span>}</div>
        {sub && <div className="text-[11px] text-parchment/40 truncate">{sub}</div>}
      </div>
      {right}
    </div>
  );
}
