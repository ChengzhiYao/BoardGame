'use client';
// 身价场：手机优先重做。上面是"我"（身价、现金、今日能做的事），下面分页：市场 / 我的队伍 / 排行 / 动态。
import { useEffect, useMemo, useRef, useState } from 'react';
import { getClientLang } from '@/lib/i18n';

type Tab = 'market' | 'team' | 'rank' | 'feed';
const openProfile = (id: string) => { try { window.dispatchEvent(new CustomEvent('mn-profile', { detail: { id } })); } catch {} };

export default function MarketPage() {
  const [en, setEn] = useState(false);
  const L = (zh: string, e: string) => (en ? e : zh);
  const [s, setS] = useState<any>(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState('');
  const [toast, setToast] = useState<{ t: string; good: boolean } | null>(null);
  const [q, setQ] = useState('');
  const [onlyAfford, setOnlyAfford] = useState(false);
  const [tab, setTab] = useState<Tab>('market');
  const [sheet, setSheet] = useState<any>(null); // 队员的更多操作
  const [nick, setNick] = useState('');
  const [help, setHelp] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);

  useEffect(() => { try { setEn(getClientLang() === 'en'); } catch {} try { if (!localStorage.getItem('mk_help')) { setHelp(true); localStorage.setItem('mk_help', '1'); } } catch {} }, []);
  async function load() { try { const r = await fetch('/api/market/state'); const d = await r.json(); setS(d); if (d && Array.isArray(d.notices) && d.notices.length) flash(d.notices.length > 1 ? (d.notices[0] + L(` 等 ${d.notices.length} 条`, ` +${d.notices.length - 1} more`)) : d.notices[0], true); } catch {} setLoaded(true); }
  useEffect(() => { load(); const id = setInterval(() => { if (!document.hidden) load(); }, 15000); return () => clearInterval(id); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const tt = useRef<any>(null);
  function flash(t: string, good = true) { setToast({ t, good }); clearTimeout(tt.current); tt.current = setTimeout(() => setToast(null), 2600); try { navigator.vibrate?.(good ? 20 : [30, 40, 30]); } catch {} }
  async function act(url: string, body?: any) {
    setBusy(url + (body?.targetId || ''));
    try {
      const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
      const d = await r.json().catch(() => ({}));
      if (r.ok && d.ok) {
        if (d.reward) flash('+¥' + d.reward); else if (d.earn) flash(L('打工赚了 ¥' + d.earn, 'Work +¥' + d.earn));
        else if (d.gain) flash(L('讨好成功 +' + d.gain, '+' + d.gain));
        else if (d.kind === 'soothe' || d.kind === 'torment') {
          const seg: string[] = [];
          if (d.dPrice) seg.push(L('身价', 'Price') + (d.dPrice > 0 ? ' +' : ' ') + d.dPrice);
          if (d.dCash) seg.push(L('现金', 'Cash') + (d.dCash > 0 ? ' +' : ' ') + d.dCash);
          const head = d.kind === 'soothe' ? L('🤲 安抚了 TA', '🤲 Soothed') : L('🔥 折磨了 TA', '🔥 Tormented');
          flash(seg.length ? head + ' · ' + seg.join(' · ') : head);
        }
        else if (d.text) flash(d.text);
        else if (d.cost) flash(L('赎身成功，你自由了', 'Redeemed — you’re free')); else if (url.includes('buy')) flash(L('买下了！TA 现在归你', 'Bought — they’re on your team'));
        await load();
      } else {
        const m: any = { poor: L('现金不够', 'Not enough cash'), protected: L('对方在保护期，暂时买不了', 'They’re protected for now'), working: L('对方正在打工', 'They’re at work'), trade_limit: L('今天交易次数用完了', 'Daily trade limit reached'), target_limit: L('TA 今天已经被买了 2 次', 'Bought twice today already'), capped: L('对方已经有 10 个人，买不了', 'They hold 10 already'), claimed: L('今天已经领过了', 'Already claimed today'), used: L('今天已经抽过了', 'Already drawn today'), free: L('你是自由身', 'You’re free') };
        flash(m[d.reason] || L('没成功，再试一次', 'Didn’t work, try again'), false);
      }
    } catch { flash(L('网络不太好', 'Network error'), false); }
    setBusy('');
  }

  const me = s?.me;
  const list = useMemo(() => {
    let l = (s?.list || []);
    if (q.trim()) l = l.filter((r: any) => r.name.toLowerCase().includes(q.trim().toLowerCase()));
    if (onlyAfford && me) l = l.filter((r: any) => r.status === 'buyable' && r.price <= me.cash);
    return l;
  }, [s, q, onlyAfford, me]);

  if (!loaded) return <main className="min-h-[100svh] flex items-center justify-center text-parchment/50">…</main>;
  if (!s || !s.loggedIn) return (
    <main className="min-h-[100svh] flex flex-col items-center justify-center gap-4 text-parchment px-6 text-center">
      <div className="text-[40px]">🪙</div>
      <h1 className="font-serif text-[24px] text-[#f1e3b8]">{L('身价场', 'The Market')}</h1>
      <p className="text-parchment/65 text-[14px] leading-relaxed max-w-xs">{L('每个玩家都有身价。买下别人、派 TA 打工、冲上资产排行榜。登录就能进场，永久免费。', 'Every player has a price. Buy players, send them to work, climb the rich list. Free — just sign in.')}</p>
      <a href="/play" className="px-6 py-3 rounded-xl bg-[#c9a54a] text-[#14110a] font-medium">{L('去登录', 'Sign in')}</a>
    </main>
  );
  const fmt = (n: number) => '¥' + (n || 0).toLocaleString();
  const protectedNow = me.protectedUntil && new Date(me.protectedUntil) > new Date();
  const myRank = (s.leaderboard || []).findIndex((r: any) => r.id === me.id) + 1;
  const qDone = [me.quest.buy >= 1, me.quest.work >= 1, me.quest.social >= 1];
  const idle = (s.team || []).filter((t: any) => !t.working).length;

  return (
    <main className="min-h-[100svh] text-parchment pb-36 overflow-x-hidden">
      <style>{`
        @keyframes mkUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
        @keyframes mkShimmer{0%{background-position:-180% 0}100%{background-position:180% 0}}
        @keyframes mkToast{from{opacity:0;transform:translate(-50%,10px)}to{opacity:1;transform:translate(-50%,0)}}
        @keyframes mkCoin{0%,100%{transform:translateY(0) rotate(0)}50%{transform:translateY(-3px) rotate(-6deg)}}
        .mk-up{animation:mkUp .35s ease both}
        .mk-xp{background:linear-gradient(90deg,#b8822f,#f2d58a,#b8822f);background-size:200% 100%;animation:mkShimmer 2.6s linear infinite}
        .mk-toast{animation:mkToast .25s ease both}
        .mk-coin{animation:mkCoin 2.4s ease-in-out infinite}
      `}</style>
      <div aria-hidden className="fixed inset-0 -z-10" style={{ background: 'radial-gradient(100% 50% at 50% 0%, rgba(201,165,74,.16), transparent 65%), #0c0d10' }} />

      {/* 顶栏 */}
      <header className="sticky top-0 z-30 backdrop-blur-xl bg-[#0c0d10]/80 border-b border-white/[0.06]" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="max-w-xl mx-auto h-12 px-3 flex items-center gap-2">
          <a href="/play" className="h-8 px-2.5 rounded-full flex items-center text-[13px] text-parchment/70 border border-white/10">{L('← 大厅', '← Hall')}</a>
          <div className="flex-1 text-center font-serif text-[17px] text-[#f1e3b8]">{L('身价场', 'The Market')}</div>
          <button onClick={() => setHelp(true)} className="h-8 w-8 rounded-full border border-white/10 text-parchment/60 text-[14px]">?</button>
        </div>
      </header>

      <div className="max-w-xl mx-auto px-4">
        {/* 我 */}
        <section className="mt-4 rounded-3xl border border-[#c9a54a]/30 overflow-hidden mk-up" style={{ background: 'linear-gradient(160deg, rgba(201,165,74,.20), rgba(18,19,24,.95) 55%)' }}>
          <div className="px-4 pt-4 flex items-center gap-3.5">
            <Av url={me.avatar} name={me.name} size={58} ring />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2"><span className="font-serif text-[19px] text-[#f6ecd0] truncate">{me.name}</span><span className="shrink-0 text-[10.5px] px-2 py-0.5 rounded-full bg-[#c9a54a]/20 text-[#e6c76e] border border-[#c9a54a]/35">{(en ? me.rank.en : me.rank.zh)} · Lv.{me.rank.level}</span></div>
              <div className="mt-1.5 flex items-center gap-2">
                <div className="h-1.5 rounded-full bg-black/40 overflow-hidden flex-1"><div className="h-full mk-xp transition-[width] duration-700" style={{ width: (me.rank.prog * 100) + '%' }} /></div>
                <span className="text-[10.5px] text-parchment/45 shrink-0">{me.rank.nextMin ? `${me.rank.exp}/${me.rank.nextMin}` : 'MAX'}</span>
              </div>
              <div className="mt-1 text-[12px] text-parchment/60">{me.ownerName ? <span className="text-[#e8a87c]">{L(`⛓ 被 ${me.ownerName} 持有`, `⛓ Owned by ${me.ownerName}`)}</span> : protectedNow ? L('🛡 保护期中，没人能买你', '🛡 Protected — nobody can buy you') : L('🕊 自由身', '🕊 Free agent')}{myRank ? <span className="text-parchment/40">{L(` · 资产第 ${myRank} 名`, ` · #${myRank} by net worth`)}</span> : null}</div>
            </div>
          </div>
          <div className="mt-4 px-4 flex items-end justify-between">
            <div>
              <div className="text-[11px] tracking-[.2em] text-[#e6c76e]/80">{L('我的身价', 'MY PRICE')}</div>
              <div className="font-serif text-[36px] leading-none text-[#f6ecd0] mt-1"><CountUp value={me.price} prefix="¥" /></div>
            </div>
            <button disabled={!!busy || me.cash < (me.hypeCost || 0)} onClick={() => act('/api/market/hype')} className="h-9 px-3.5 rounded-xl border border-[#c9a54a]/50 text-[#f1e3b8] text-[13px] disabled:opacity-40">📈 {L(`炒作 ${fmt(me.hypeCost)}`, `Hype ${fmt(me.hypeCost)}`)}</button>
          </div>
          <div className="mt-4 grid grid-cols-3 border-t border-white/[0.07] divide-x divide-white/[0.07] bg-black/20">
            <Stat label={L('现金', 'Cash')} value={<CountUp value={me.cash} prefix="¥" />} />
            <Stat label={L('总资产', 'Net worth')} value={<CountUp value={me.assets} prefix="¥" />} />
            <Stat label={L('队伍', 'Team')} value={`${me.holdings}/${me.holdCap}`} />
          </div>
        </section>

        {/* 被持有时：讨好 / 赎身 */}
        {me.ownerName && (
          <section className="mt-3 rounded-2xl border border-[#e8a87c]/30 bg-[#e8a87c]/[0.06] px-4 py-3 flex items-center gap-3 mk-up">
            <span className="text-[13px] text-parchment/75 flex-1">{L(`你现在归 ${me.ownerName}。讨好 TA 能加钱，攒够钱可以赎身。`, `${me.ownerName} owns you. Please them for cash, or buy your freedom.`)}</span>
            <div className="flex flex-col gap-1.5 shrink-0">
              <button disabled={!!busy} onClick={() => act('/api/market/please')} className="h-8 px-3 rounded-lg bg-white/[0.08] text-[12.5px]">{L('讨好', 'Please')}</button>
              <button disabled={!!busy || me.cash < me.price} onClick={() => act('/api/market/redeem')} className="h-8 px-3 rounded-lg bg-[#c9a54a] text-[#14110a] text-[12.5px] disabled:opacity-40">{L(`赎身 ${fmt(me.price)}`, `Redeem ${fmt(me.price)}`)}</button>
            </div>
          </section>
        )}

        {/* 今天 */}
        <section className="mt-3 grid grid-cols-2 gap-2.5">
          <BigBtn on={me.dailyAvailable} busy={!!busy} onClick={() => act('/api/market/daily')} icon="🪙" title={me.dailyAvailable ? L('领今日 +¥100', 'Daily +¥100') : L('今天领过了', 'Claimed today')} sub={L('每天来一次', 'Come back daily')} gold />
          <BigBtn on={me.fateAvailable} busy={!!busy} onClick={() => act('/api/market/fate')} icon="🃏" title={me.fateAvailable ? L('抽命运卡', 'Draw a fate card') : L('明天再抽', 'Tomorrow')} sub={L('可能大赚，也可能翻车', 'Big win or big loss')} red />
        </section>

        {/* 每日任务 */}
        <section className="mt-3 rounded-2xl border border-white/[0.08] bg-[#121318]/80 px-4 py-3">
          <div className="flex items-center justify-between">
            <span className="text-[13px] text-parchment/80">{L('每日任务', 'Daily quests')} <span className="text-parchment/40">{qDone.filter(Boolean).length}/3</span></span>
            <button disabled={!me.quest.canClaim || !!busy} onClick={() => act('/api/market/quest')} className={`h-8 px-3.5 rounded-lg text-[12.5px] ${me.quest.canClaim ? 'bg-[#c9a54a] text-[#14110a] font-medium' : 'bg-white/[0.05] text-parchment/40'}`}>{me.quest.claimed ? L('已领取', 'Claimed') : L('领 +¥200', 'Claim +¥200')}</button>
          </div>
          <div className="mt-2.5 grid grid-cols-3 gap-2">
            {[[L('买入 1 人', 'Buy 1'), 'market'], [L('派人打工', 'Send to work'), 'team'], [L('互动 1 次', 'Interact once'), 'team']].map(([t, go], i) => (
              <button key={i} onClick={() => setTab(go as Tab)} className={`rounded-xl px-2 py-2 text-[12px] border text-center ${qDone[i] ? 'border-[#8fd3b8]/35 bg-[#8fd3b8]/[0.08] text-[#bfeadb]' : 'border-white/[0.08] text-parchment/55'}`}>{qDone[i] ? '✓ ' : ''}{t}</button>
            ))}
          </div>
        </section>

        {/* 分页 */}
        <nav className="sticky z-20 mt-5 -mx-4 px-4 py-2 bg-[#0c0d10]/85 backdrop-blur-xl" style={{ top: 'calc(env(safe-area-inset-top) + 48px)' }}>
          <div className="flex rounded-xl border border-white/[0.1] p-1 bg-black/30">
            {([['market', L('市场', 'Market')], ['team', L(`队伍 ${s.team.length}`, `Team ${s.team.length}`)], ['rank', L('排行', 'Rich list')], ['feed', L('动态', 'Activity')]] as [Tab, string][]).map(([k, t]) => (
              <button key={k} onClick={() => setTab(k)} className={`relative flex-1 h-9 rounded-lg text-[13.5px] ${tab === k ? 'bg-[#c9a54a]/20 text-[#f6ecd0]' : 'text-parchment/50'}`}>{t}{k === 'team' && idle > 0 && <span className="absolute top-1.5 right-2 w-1.5 h-1.5 rounded-full bg-[#e6c76e]" />}</button>
            ))}
          </div>
        </nav>

        {tab === 'market' && (
          <section className="mt-2">
            <div className="flex gap-2">
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={L('搜玩家名字', 'Search players')} className="flex-1 min-w-0 h-10 px-3.5 rounded-xl bg-[#121318] border border-white/10 text-parchment placeholder:text-parchment/30 text-[14px] outline-none focus:border-[#c9a54a]/50" />
              <button onClick={() => setOnlyAfford((v) => !v)} className={`shrink-0 h-10 px-3 rounded-xl text-[12.5px] border ${onlyAfford ? 'border-[#c9a54a]/60 bg-[#c9a54a]/15 text-[#f1e3b8]' : 'border-white/10 text-parchment/55'}`}>{L('买得起', 'Affordable')}</button>
            </div>
            <div className="mt-3 space-y-2">
              {list.length === 0 && <Empty t={L('没有符合的玩家', 'Nobody matches')} />}
              {list.map((r: any, i: number) => {
                const can = r.status === 'buyable' && r.price <= me.cash;
                const why = ({ mine: L('已在你队伍', 'On your team'), protected: L('🛡 保护期', '🛡 Protected'), working: L('打工中', 'At work'), capped: L('队伍满了', 'Full team'), soldout: L('今天卖完了', 'Sold out today') } as any)[r.status];
                return (
                  <div key={r.id} className="mk-up flex items-center gap-3 rounded-2xl border border-white/[0.08] bg-[#121318]/85 pl-3 pr-2 py-2.5" style={{ animationDelay: Math.min(i, 12) * 25 + 'ms' }}>
                    <button onClick={() => openProfile(r.id)} className="shrink-0"><Av url={r.avatar} name={r.name} size={42} /></button>
                    <button onClick={() => openProfile(r.id)} className="flex-1 min-w-0 text-left">
                      <span className="block truncate text-[14.5px] text-[#ece3cf]">{r.name}</span>
                      <span className="block truncate text-[11.5px] text-parchment/45">{r.ownerName ? L(`主人：${r.ownerName}`, `Owner: ${r.ownerName}`) : L('自由身', 'Free agent')}</span>
                    </button>
                    {r.status === 'buyable' ? (
                      <button disabled={!!busy || !can} onClick={() => act('/api/market/buy', { targetId: r.id })} className={`shrink-0 min-w-[84px] h-11 rounded-xl flex flex-col items-center justify-center leading-tight ${can ? 'bg-[#7d1d1d] border border-[#a83232]/60 text-[#f6ecd0]' : 'bg-white/[0.04] border border-white/10 text-parchment/40'}`}>
                        <span className="text-[13.5px] font-medium">{fmt(r.price)}</span>
                        <span className="text-[10.5px] opacity-80">{busy === '/api/market/buy' + r.id ? '…' : can ? L('买下', 'Buy') : L('钱不够', 'Too pricey')}</span>
                      </button>
                    ) : <span className="shrink-0 text-right text-[11.5px] text-parchment/40 px-1"><span className="block text-[#e6c76e]/70 text-[12.5px]">{fmt(r.price)}</span>{why}</span>}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {tab === 'team' && (
          <section className="mt-2 space-y-2">
            {s.team.length === 0 && <Empty t={L('你还没买下任何人', 'Your team is empty')} cta={L('去市场看看 →', 'Browse the market →')} onCta={() => setTab('market')} />}
            {s.team.length > 0 && <p className="text-[12px] text-parchment/45 px-1">{L('派队员去打工赚钱；安抚会让 TA 身价涨，折磨能榨出现金但 TA 会贬值。', 'Send members to work for cash. Soothing raises their price; tormenting squeezes cash but they lose value.')}</p>}
            {s.team.map((t: any, i: number) => (
              <div key={t.id} className="mk-up rounded-2xl border border-white/[0.08] bg-[#121318]/85 px-3 py-3" style={{ animationDelay: i * 30 + 'ms' }}>
                <div className="flex items-center gap-3">
                  <button onClick={() => openProfile(t.id)}><Av url={t.avatar} name={t.name} size={42} /></button>
                  <div className="flex-1 min-w-0">
                    <div className="truncate text-[14.5px] text-[#ece3cf]">{t.name}</div>
                    <div className="text-[11.5px]"><span className="text-[#e6c76e]/80">{fmt(t.price)}</span> <span className={t.working ? 'text-[#8fd3b8]' : 'text-parchment/45'}>· {t.working ? L('打工中…', 'At work…') : L('闲着', 'Idle')}</span></div>
                  </div>
                  <button onClick={() => { setSheet(t); setNick(''); }} className="shrink-0 w-9 h-9 rounded-full border border-white/10 text-parchment/60">⋯</button>
                </div>
                <div className="mt-2.5 grid grid-cols-3 gap-2">
                  <button disabled={!!busy || t.working} onClick={() => act('/api/market/work', { targetId: t.id })} className="h-10 rounded-xl bg-[#c9a54a]/20 border border-[#c9a54a]/35 text-[13px] text-[#f1e3b8] disabled:opacity-35">💼 {L('打工', 'Work')}</button>
                  <button disabled={!!busy} onClick={() => act('/api/market/interact', { targetId: t.id, kind: 'soothe' })} className="h-10 rounded-xl bg-white/[0.05] border border-white/10 text-[13px]">🤲 {L('安抚', 'Soothe')}</button>
                  <button disabled={!!busy} onClick={() => act('/api/market/interact', { targetId: t.id, kind: 'torment' })} className="h-10 rounded-xl bg-[#7d1d1d]/60 border border-[#a83232]/40 text-[13px]">🔥 {L('折磨', 'Torment')}</button>
                </div>
              </div>
            ))}
          </section>
        )}

        {tab === 'rank' && (
          <section className="mt-2 rounded-2xl border border-white/[0.08] bg-[#121318]/85 divide-y divide-white/[0.05]">
            {s.leaderboard.length === 0 && <Empty t={L('还没有人上榜', 'Nobody yet')} />}
            {s.leaderboard.map((r: any, i: number) => (
              <button key={r.id} onClick={() => r.id !== me.id && openProfile(r.id)} className={`w-full text-left flex items-center gap-3 px-3.5 py-2.5 ${r.id === me.id ? 'bg-[#c9a54a]/[0.1]' : ''}`}>
                <span className={`w-6 text-center font-serif text-[14px] ${i < 3 ? 'text-[#e6c76e]' : 'text-parchment/40'}`}>{i < 3 ? ['🥇', '🥈', '🥉'][i] : i + 1}</span>
                <Av url={r.avatar} name={r.name} size={34} />
                <span className="flex-1 truncate text-[14px] text-[#ece3cf]">{r.name}{r.id === me.id ? L('（你）', ' (you)') : ''}</span>
                <span className="text-[13px] text-[#e6c76e]">{fmt(r.assets)}</span>
              </button>
            ))}
          </section>
        )}

        {tab === 'feed' && (
          <section className="mt-2 rounded-2xl border border-white/[0.08] bg-[#121318]/85 px-4 py-1">
            {s.feed.length === 0 && <Empty t={L('还没有动态', 'No activity yet')} />}
            {s.feed.map((f: any, i: number) => (<div key={i} className="text-[13px] leading-relaxed text-parchment/65 border-b border-white/[0.05] last:border-0 py-2.5">{f.text}</div>))}
          </section>
        )}

        <div className="mt-10 text-center">
          {confirmLeave ? (
            <span className="text-[12.5px] text-parchment/55">{me.optedOut ? '' : L('退出后别人不能买你，你也不能买人。', 'Others can’t buy you and you can’t trade. ')}
              <button onClick={() => { setConfirmLeave(false); act('/api/market/optout', { out: !me.optedOut }); }} className="ml-2 text-[#e08080]">{me.optedOut ? L('重新加入', 'Rejoin') : L('确定退出', 'Leave')}</button>
              <button onClick={() => setConfirmLeave(false)} className="ml-3 text-parchment/45">{L('取消', 'Cancel')}</button></span>
          ) : <button onClick={() => (me.optedOut ? act('/api/market/optout', { out: false }) : setConfirmLeave(true))} className="text-[12px] text-parchment/35 border-b border-white/10">{me.optedOut ? L('重新加入身价场', 'Rejoin the market') : L('退出身价场', 'Leave the market')}</button>}
        </div>
      </div>

      {/* 队员更多操作 */}
      {sheet && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center" onClick={() => setSheet(null)}>
          <div className="w-full sm:max-w-sm rounded-t-3xl sm:rounded-3xl bg-[#121318] border border-white/10 p-5 mn-sheet" style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3"><Av url={sheet.avatar} name={sheet.name} size={44} /><div><div className="font-serif text-[17px] text-[#f6ecd0]">{sheet.name}</div><div className="text-[12px] text-[#e6c76e]/80">{fmt(sheet.price)}</div></div></div>
            <div className="mt-4 text-[12px] text-parchment/50">{L('给 TA 起个绰号（只有你们看得到的那种）', 'Give them a nickname')}</div>
            <div className="mt-1.5 flex gap-2">
              <input value={nick} onChange={(e) => setNick(e.target.value)} maxLength={16} placeholder={L('留空 = 清除绰号', 'Blank = clear')} className="flex-1 min-w-0 h-10 px-3 rounded-xl bg-[#0c0d10] border border-white/10 text-parchment text-[14px] outline-none" />
              <button onClick={() => { act('/api/market/nick', { targetId: sheet.id, name: nick }); setSheet(null); }} className="h-10 px-4 rounded-xl bg-[#c9a54a] text-[#14110a] text-[13.5px]">{L('保存', 'Save')}</button>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button onClick={() => { openProfile(sheet.id); setSheet(null); }} className="h-11 rounded-xl border border-white/10 text-[13.5px]">{L('看资料 / 私聊', 'Profile / message')}</button>
              <button onClick={() => { act('/api/market/release', { targetId: sheet.id }); setSheet(null); }} className="h-11 rounded-xl border border-[#a83232]/40 text-[#e8a0a0] text-[13.5px]">{L('放 TA 自由', 'Release')}</button>
            </div>
          </div>
        </div>
      )}

      {/* 玩法说明 */}
      {help && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-end sm:items-center justify-center" onClick={() => setHelp(false)}>
          <div className="w-full sm:max-w-sm rounded-t-3xl sm:rounded-3xl bg-[#121318] border border-[#c9a54a]/30 p-6 mn-sheet" style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }} onClick={(e) => e.stopPropagation()}>
            <div className="text-center"><div className="text-[40px] mk-coin inline-block">🪙</div><div className="font-serif text-[22px] text-[#f1e3b8] mt-1">{L('身价场怎么玩', 'How the Market works')}</div></div>
            <ol className="mt-4 space-y-3 text-[14px] leading-relaxed text-parchment/80">
              {(en ? ['Every player on MystNight has a price.', 'Buy players with your cash — they join your team and you become their owner.', 'Send your team to work for cash. Soothe them to raise their price, or torment them for quick cash.', 'If someone buys you, please your owner or save up and buy your freedom.', 'Claim +¥100 daily, draw a fate card, finish quests — and climb the rich list.']
                : ['全站每个玩家都有一个身价。', '用现金买下别人，TA 就进了你的队伍，你是 TA 的主人。', '派队员去打工赚钱；安抚让 TA 身价上涨，折磨能马上榨出现金。', '你也可能被别人买下：讨好主人赚钱，或者攒够钱给自己赎身。', '每天领 ¥100、抽命运卡、做任务，冲上资产排行榜。']).map((t, i) => (
                <li key={i} className="flex gap-3"><span className="shrink-0 w-6 h-6 rounded-full bg-[#c9a54a]/20 text-[#e6c76e] text-[12px] flex items-center justify-center">{i + 1}</span><span>{t}</span></li>
              ))}
            </ol>
            <button onClick={() => setHelp(false)} className="mt-5 w-full h-12 rounded-xl bg-[#c9a54a] text-[#14110a] font-medium text-[15px]">{L('进场', 'Let’s go')}</button>
          </div>
        </div>
      )}

      {toast && <div className={`mk-toast fixed left-1/2 -translate-x-1/2 z-[60] max-w-[90vw] px-4 py-2.5 rounded-full border text-[14px] shadow-xl ${toast.good ? 'bg-[#17140c] border-[#c9a54a]/50 text-[#f6ecd0]' : 'bg-[#1a0f10] border-[#a83232]/50 text-[#f2c4c4]'}`} style={{ bottom: 'calc(env(safe-area-inset-bottom) + 90px)' }}>{toast.t}</div>}
    </main>
  );
}

function CountUp({ value, prefix = '' }: { value: number; prefix?: string }) {
  const [disp, setDisp] = useState(value);
  const ref = useRef(value);
  useEffect(() => {
    const from = ref.current, to = value; if (from === to) return;
    const start = performance.now(), dur = 550; let raf = 0;
    const tick = (t: number) => { const p = Math.min(1, (t - start) / dur); const e = 1 - Math.pow(1 - p, 3); const v = Math.round(from + (to - from) * e); setDisp(v); ref.current = v; if (p < 1) raf = requestAnimationFrame(tick); else ref.current = to; };
    raf = requestAnimationFrame(tick); return () => cancelAnimationFrame(raf);
  }, [value]);
  return <>{prefix}{(disp || 0).toLocaleString()}</>;
}
function Stat({ label, value }: { label: string; value: any }) {
  return <div className="py-2.5 text-center"><div className="text-[10.5px] text-parchment/45">{label}</div><div className="mt-0.5 text-[15px] text-[#f6ecd0] font-medium">{value}</div></div>;
}
function BigBtn({ on, busy, onClick, icon, title, sub, gold, red }: { on: boolean; busy: boolean; onClick: () => void; icon: string; title: string; sub: string; gold?: boolean; red?: boolean }) {
  const tone = !on ? 'border-white/[0.07] bg-white/[0.02] opacity-55' : gold ? 'border-[#c9a54a]/45 bg-[#c9a54a]/[0.12]' : red ? 'border-[#a83232]/50 bg-[#7d1d1d]/30' : 'border-white/10';
  return (
    <button disabled={!on || busy} onClick={onClick} className={`rounded-2xl border px-3.5 py-3 text-left flex items-center gap-3 ${tone}`}>
      <span className={`text-[26px] ${on ? 'mk-coin' : ''}`}>{icon}</span>
      <span className="min-w-0"><span className="block text-[14px] text-[#f6ecd0] truncate">{title}</span><span className="block text-[11px] text-parchment/50 truncate">{sub}</span></span>
    </button>
  );
}
function Empty({ t, cta, onCta }: { t: string; cta?: string; onCta?: () => void }) {
  return <div className="py-10 text-center"><div className="text-[14px] text-parchment/45">{t}</div>{cta && <button onClick={onCta} className="mt-2 text-[13px] text-[#e6c76e] border-b border-[#e6c76e]/40">{cta}</button>}</div>;
}
function Av({ url, name, size = 32, ring }: { url?: string | null; name: string; size?: number; ring?: boolean }) {
  const st = { width: size, height: size, fontSize: size * 0.4 };
  const cls = `rounded-full shrink-0 ${ring ? 'border-2 border-[#c9a54a]/60 shadow-[0_0_24px_-6px_rgba(201,165,74,.6)]' : 'border border-white/10'}`;
  // eslint-disable-next-line @next/next/no-img-element
  return url ? <img src={url} alt="" style={st} className={`${cls} object-cover`} /> : <span style={st} className={`${cls} bg-white/[0.06] flex items-center justify-center font-serif text-parchment/75`}>{(name || '?').slice(0, 1).toUpperCase()}</span>;
}
