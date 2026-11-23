'use client';
// 排行榜：本周 / 总榜 × 六个分类；我的名次和"超过了多少玩家"放最上面
import { useEffect, useState } from 'react';
import { getClientLang } from '@/lib/i18n';
import { CATS, CAT_LABEL, RATE_MIN, type Cat } from '@/lib/ranks';

const MEDAL = ['#e6c76e', '#cfd6df', '#d39a6a'];
const openProfile = (id: string) => { try { window.dispatchEvent(new CustomEvent('mn-profile', { detail: { id } })); } catch {} };

export default function RanksClient() {
  const [en, setEn] = useState(false);
  const [win, setWin] = useState<'week' | 'all'>('week');
  const [cat, setCat] = useState<Cat>('games');
  const [d, setD] = useState<any>(null);
  useEffect(() => { try { setEn(getClientLang() === 'en'); } catch {} }, []);
  useEffect(() => { setD(null); fetch(`/api/ranks?win=${win}`).then((r) => r.json()).then(setD).catch(() => setD({ cats: {} })); }, [win]);
  useEffect(() => { if (win === 'week' && cat === 'badges') setCat('games'); }, [win, cat]);
  const L = (zh: string, e: string) => (en ? e : zh);
  const lab = CAT_LABEL[cat];
  const c = d?.cats?.[cat];
  const unit = (v: number) => cat === 'rate' ? `${v}%` : `${v} ${en ? lab[3] : lab[2]}`;
  const who = (id: string) => d?.people?.[id] || { name: L('玩家', 'Player'), avatar: null };
  const cats = CATS.filter((x) => !(win === 'week' && x === 'badges'));

  return (
    <main className="min-h-[100svh] pb-36">
      <div aria-hidden className="fixed inset-0 -z-10" style={{ background: 'radial-gradient(90% 55% at 50% 0%, rgba(230,199,110,.14), transparent 60%), #0c0d10' }} />
      <a href="/play" className="fixed left-3 z-30 h-8 px-3 rounded-full flex items-center text-[12.5px] text-parchment/70 border border-white/10 bg-ink/60 backdrop-blur" style={{ top: 'calc(env(safe-area-inset-top) + 10px)' }}>{L('← 大厅', '← Hall')}</a>
      <div className="w-full max-w-xl mx-auto px-5" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 64px)' }}>
        <div className="text-center">
          <div className="text-[10px] tracking-[.5em] pl-[.5em] uppercase text-[#e6c76e]/80">Leaderboard</div>
          <h1 className="mt-2 font-serif font-semibold text-[30px] tracking-[.08em] text-[#f6ecd0]">{L('排行榜', 'Leaderboard')}</h1>
          <div className="mt-1 text-[12.5px] text-parchment/45">{d ? L(`${win === 'week' ? '最近 7 天' : '全部时间'} · ${d.players} 位玩家上场`, `${win === 'week' ? 'Last 7 days' : 'All time'} · ${d.players} players`) : '…'}</div>
        </div>

        <div className="mt-5 mx-auto w-fit flex rounded-full border border-[#d8c7a8]/15 p-1">
          {(['week', 'all'] as const).map((w) => (
            <button key={w} onClick={() => setWin(w)} className={`px-5 h-8 rounded-full text-[13px] ${win === w ? 'bg-[#e6c76e]/20 text-[#f6ecd0]' : 'text-parchment/50'}`}>{w === 'week' ? L('本周', 'This week') : L('总榜', 'All time')}</button>
          ))}
        </div>

        <div className="mt-4 flex gap-2 overflow-x-auto pb-1 -mx-5 px-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {cats.map((k) => (
            <button key={k} onClick={() => setCat(k)} className={`shrink-0 h-9 px-3.5 rounded-full text-[13px] border ${cat === k ? 'border-[#e6c76e]/60 bg-[#e6c76e]/15 text-[#f6ecd0]' : 'border-white/10 text-parchment/55'}`}>{en ? CAT_LABEL[k][1] : CAT_LABEL[k][0]}</button>
          ))}
        </div>

        {/* 我的位置 */}
        {c?.me && (
          <div className="mt-4 rounded-2xl border border-[#e6c76e]/35 bg-[linear-gradient(120deg,rgba(230,199,110,.16),rgba(11,12,15,.85))] px-4 py-3.5 flex items-center gap-4">
            <div className="shrink-0 text-center w-16">
              <div className="text-[10px] tracking-[.2em] text-[#e6c76e]/80">{L('我的名次', 'MY RANK')}</div>
              <div className="font-serif text-[28px] leading-none text-[#f6ecd0] mt-1">{c.me.rank ? `#${c.me.rank}` : '—'}</div>
            </div>
            <div className="flex-1 min-w-0">
              {c.me.rank ? (
                <>
                  <div className="font-serif text-[17px] text-[#f6ecd0]">{L(`超过了 ${c.me.beat}% 的玩家`, `Ahead of ${c.me.beat}% of players`)}</div>
                  <div className="text-[12.5px] text-parchment/55">{en ? lab[1] : lab[0]}：{unit(c.me.value)}{c.me.rank > 1 && c.top[c.me.rank - 2] ? L(` · 离上一名还差 ${Math.max(1, c.top[c.me.rank - 2].v - c.me.value)}${cat === 'rate' ? '%' : ''}`, ` · ${Math.max(1, c.top[c.me.rank - 2].v - c.me.value)} behind the next`) : c.me.rank === 1 ? L(' · 你是第一', ' · you’re #1') : ''}</div>
                </>
              ) : (
                <div className="text-[13px] text-parchment/60">{cat === 'rate' ? L(`喝完 ${RATE_MIN} 碗汤才上这个榜`, `Finish ${RATE_MIN} soups to get on this board`) : L('还没上榜，玩一局就上来了', 'Play a game to get on the board')}</div>
              )}
            </div>
          </div>
        )}

        {/* 前三 */}
        {c?.top?.length > 0 && (
          <div className="mt-6 grid grid-cols-3 gap-2 items-end">
            {[1, 0, 2].map((i) => { const r = c.top[i]; if (!r) return <div key={i} />; const p = who(r.id); const me = r.id === d.me; return (
              <button key={i} onClick={() => !me && openProfile(r.id)} className={`flex flex-col items-center text-center ${i === 0 ? '' : 'pt-5'}`}>
                <span className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {p.avatar ? <img src={p.avatar} alt="" className={`${i === 0 ? 'w-16 h-16' : 'w-12 h-12'} rounded-full object-cover border-2`} style={{ borderColor: MEDAL[i] }} /> : <span className={`${i === 0 ? 'w-16 h-16 text-[22px]' : 'w-12 h-12 text-[17px]'} rounded-full border-2 bg-white/[0.05] flex items-center justify-center font-serif text-parchment/80`} style={{ borderColor: MEDAL[i] }}>{String(p.name).slice(0, 1)}</span>}
                  <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-5 h-5 rounded-full text-[11px] font-bold flex items-center justify-center text-[#0c0d10]" style={{ background: MEDAL[i] }}>{i + 1}</span>
                </span>
                <span className={`mt-2.5 w-full truncate text-[12.5px] ${me ? 'text-[#e6c76e]' : 'text-[#ece3cf]'}`}>{p.name}</span>
                <span className="text-[12px] text-parchment/55">{unit(r.v)}</span>
                <span className="mt-1.5 w-full rounded-t-lg" style={{ height: i === 0 ? 46 : i === 1 ? 32 : 24, background: `linear-gradient(180deg, ${MEDAL[i]}40, transparent)` }} />
              </button>
            ); })}
          </div>
        )}

        {/* 第 4 名往后 */}
        <div className="mt-2 rounded-2xl border border-white/[0.07] bg-[#0b0c0f]/60 divide-y divide-white/[0.05]">
          {!d && [0, 1, 2, 3].map((i) => <div key={i} className="h-12 animate-pulse" />)}
          {d && !c?.top?.length && <div className="py-8 text-center text-[13px] text-parchment/40">{L('这个榜还空着，你来当第一个', 'Nobody here yet — be the first')}</div>}
          {c?.top?.slice(3).map((r: any, i: number) => { const p = who(r.id); const me = r.id === d.me; return (
            <button key={r.id} onClick={() => !me && openProfile(r.id)} className={`w-full text-left flex items-center gap-3 px-3.5 py-2.5 ${me ? 'bg-[#e6c76e]/[0.08]' : 'hover:bg-white/[0.03]'}`}>
              <span className="w-6 text-center font-serif text-[13px] text-parchment/45">{i + 4}</span>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {p.avatar ? <img src={p.avatar} alt="" className="w-8 h-8 rounded-full object-cover" /> : <span className="w-8 h-8 rounded-full bg-white/[0.06] flex items-center justify-center text-[12px] text-parchment/60">{String(p.name).slice(0, 1)}</span>}
              <span className={`flex-1 min-w-0 truncate text-[14px] ${me ? 'text-[#e6c76e]' : 'text-parchment/85'}`}>{p.name}{me ? L('（你）', ' (you)') : ''}</span>
              <span className="text-[13px] text-parchment/65">{unit(r.v)}{cat === 'rate' && r.sub ? <span className="text-parchment/35 text-[11px]"> / {r.sub}{L('碗', '')}</span> : null}</span>
            </button>
          ); })}
        </div>
        <p className="mt-2 text-[11.5px] text-parchment/35 text-center">{L('点玩家可以看资料、加好友、私聊约局', 'Tap a player to see their profile, add them or message them')}</p>
        {cat === 'rate' && <p className="mt-2 text-[11.5px] text-parchment/35 text-center">{L(`喝完至少 ${RATE_MIN} 碗才上猜中率榜；看汤底不算猜中`, `At least ${RATE_MIN} finished soups; peeking doesn't count`)}</p>}
        <div className="mt-8 flex justify-center gap-5 text-[13px]">
          <a href="/daily" className="text-[#8fd3b8] border-b border-[#8fd3b8]/40">{L('今天的每日一汤 →', 'Today’s Daily Soup →')}</a>
          <a href="/me" className="text-[#c9a96e] border-b border-[#c9a96e]/40">{L('我的收藏 →', 'My collection →')}</a>
        </div>
      </div>
    </main>
  );
}
