'use client';
// 我的收藏：称号墙 + 汤谱 + 结局 + 调查员档案
import { useEffect, useState } from 'react';
import { getClientLang } from '@/lib/i18n';

const FATE: Record<string, [string, string, string]> = {
  survived: ['活了下来', 'Survived', '#8fd3b8'], dead: ['死去', 'Died', '#c0453f'], mad: ['疯了', 'Went mad', '#a78bfa'],
  playing: ['故事还没完', 'Still in a story', '#c9a96e'], left: ['半路离开', 'Left early', '#888'],
};
const KIND: Record<string, [string, string, string]> = {
  good: ['好结局', 'Good ending', '#8fd3b8'], bad: ['坏结局', 'Bad ending', '#c0453f'], hidden: ['隐藏结局', 'Hidden ending', '#e6c76e'], bitter: ['苦涩结局', 'Bittersweet', '#c9a96e'],
};

export default function MeClient() {
  const [en, setEn] = useState(false);
  const [d, setD] = useState<any>(null);
  const [tab, setTab] = useState<'soup' | 'end' | 'inv'>('soup');
  const [open, setOpen] = useState<string | null>(null);
  const [badge, setBadge] = useState<any>(null);
  useEffect(() => {
    let e = false; try { e = getClientLang() === 'en'; } catch {} setEn(e);
    fetch(`/api/me/collection?lang=${e ? 'en' : 'zh'}`).then((r) => r.json()).then(setD).catch(() => setD({ loggedIn: false }));
  }, []);
  const L = (zh: string, e: string) => (en ? e : zh);
  const fmtDay = (s: string) => { try { return new Date(s).toLocaleDateString(en ? 'en-US' : 'zh-CN', { month: 'short', day: 'numeric' }); } catch { return ''; } };

  if (!d) return <main className="min-h-[100svh] flex items-center justify-center text-parchment/40">…</main>;
  if (!d.loggedIn) return (
    <main className="min-h-[100svh] flex flex-col items-center justify-center gap-3 text-center px-6">
      <div className="font-serif text-[20px] text-[#efe6d2]">{L('登录后才有收藏', 'Sign in to see your collection')}</div>
      <a href="/play" className="text-[13px] text-[#c9a96e] border-b border-[#c9a96e]/40">{L('回到大厅', 'Back to the hall')}</a>
    </main>
  );
  const s = d.stats || {};
  const earned = (d.badges || []).filter((b: any) => b.earned).length;

  return (
    <main className="min-h-[100svh] pb-20">
      <div aria-hidden className="fixed inset-0 -z-10" style={{ background: 'radial-gradient(90% 60% at 50% 0%, rgba(201,169,110,.13), transparent 60%), #0c0d10' }} />
      <a href="/play" className="fixed left-3 z-30 h-8 px-3 rounded-full flex items-center text-[12.5px] text-parchment/70 border border-white/10 bg-ink/60 backdrop-blur" style={{ top: 'calc(env(safe-area-inset-top) + 10px)' }}>{L('← 大厅', '← Hall')}</a>
      <div className="w-full max-w-xl mx-auto px-5" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 64px)' }}>
        {/* 头部 */}
        <div className="flex flex-col items-center text-center">
          <span className="w-20 h-20 rounded-full overflow-hidden border-2 border-[#c9a96e]/45 bg-[#c9a96e]/10 flex items-center justify-center font-serif text-[28px] text-[#efe6d2] shadow-[0_0_40px_-8px_rgba(201,169,110,.5)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {d.avatar ? <img src={d.avatar} alt="" className="w-full h-full object-cover" /> : String(d.name || '?').slice(0, 1)}
          </span>
          <div className="mt-3 font-serif text-[22px] text-[#efe6d2]">{d.name || L('无名调查员', 'Nameless')}</div>
          <div className="mt-0.5 text-[12px] tracking-[.2em] text-[#c9a96e]/80">{L(`${earned} / ${d.badges.length} 个称号`, `${earned} / ${d.badges.length} titles`)}</div>
          <div className="mt-5 w-full grid grid-cols-4 rounded-2xl border border-[#d8c7a8]/[0.12] bg-[#0b0c0f]/70 divide-x divide-white/[0.06]">
            {[[s.played, L('局', 'games')], [s.soupSolved, L('碗猜中', 'soups')], [s.cocEndings + s.jbsDone, L('个结局', 'endings')], [s.streak, L('天连续', 'day streak')]].map(([n, t], i) => (
              <div key={i} className="py-3"><div className="font-serif text-[22px] text-[#efe6d2] leading-none">{n ?? 0}</div><div className="mt-1 text-[11px] text-parchment/45">{t}</div></div>
            ))}
          </div>
        </div>

        {/* 称号墙 */}
        <section className="mt-8">
          <div className="text-[11px] tracking-[.28em] text-parchment/40 mb-3">{L('称号', 'TITLES')}</div>
          <div className="grid grid-cols-4 sm:grid-cols-6 gap-2.5">
            {d.badges.map((b: any) => (
              <button key={b.id} onClick={() => setBadge(b)} className="flex flex-col items-center gap-1.5">
                <span className={`w-14 h-14 rounded-full flex items-center justify-center text-[24px] border transition ${b.earned ? 'border-[#e6c76e]/50 bg-[radial-gradient(circle_at_35%_30%,rgba(230,199,110,.3),rgba(230,199,110,.06))] shadow-[0_0_24px_-6px_rgba(230,199,110,.55)]' : 'border-white/[0.08] bg-white/[0.02] grayscale opacity-35'}`}>{b.icon}</span>
                <span className={`text-[11px] leading-tight text-center ${b.earned ? 'text-[#efe6d2]' : 'text-parchment/35'}`}>{en ? b.en : b.zh}</span>
              </button>
            ))}
          </div>
        </section>

        {/* 收藏 */}
        <section className="mt-9">
          <div className="flex rounded-xl border border-[#d8c7a8]/[0.14] overflow-hidden mb-4">
            {([['soup', L(`汤谱 ${d.soups?.length || 0}`, `Soups ${d.soups?.length || 0}`)], ['end', L(`结局 ${(d.endings?.length || 0) + (d.jbs?.length || 0)}`, `Endings ${(d.endings?.length || 0) + (d.jbs?.length || 0)}`)], ['inv', L(`调查员 ${d.investigators?.length || 0}`, `Investigators ${d.investigators?.length || 0}`)]] as [typeof tab, string][]).map(([k, t], i) => (
              <button key={k} onClick={() => setTab(k)} className={`flex-1 py-2.5 text-[13px] ${i ? 'border-l border-[#d8c7a8]/[0.1]' : ''} ${tab === k ? 'bg-[#c9a96e]/[0.16] text-[#efe6d2]' : 'text-parchment/50'}`}>{t}</button>
            ))}
          </div>

          {tab === 'soup' && (
            <div className="space-y-2">
              {!d.soups?.length && <Empty en={en} zh="还没喝完过一碗汤" e="No soups finished yet" href="/daily" cta={L('来一碗每日一汤 →', 'Try the Daily Soup →')} />}
              {d.soups?.map((p: any) => (
                <div key={p.id} className="rounded-xl border border-white/[0.08] bg-[#0b0c0f]/60">
                  <button onClick={() => setOpen(open === p.id ? null : p.id)} className="w-full flex items-center gap-3 px-3.5 py-3 text-left">
                    <span className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-[13px] ${p.solved ? 'bg-[#8fd3b8]/15 text-[#8fd3b8]' : 'bg-white/[0.05] text-parchment/40'}`}>{p.solved ? '✓' : '·'}</span>
                    <span className="flex-1 min-w-0">
                      <span className="block truncate font-serif text-[15px] text-[#efe6d2]">{p.title || L('无题', 'Untitled')}</span>
                      <span className="text-[11.5px] text-parchment/40">{fmtDay(p.at)} · {p.solved ? L(`${p.questions ?? '?'} 问猜中${p.hints ? ` · ${p.hints} 提示` : ''}`, `cracked in ${p.questions ?? '?'}`) : L('看了汤底', 'peeked')}</span>
                    </span>
                    <span className="text-parchment/30 text-[12px]">{open === p.id ? '▲' : '▼'}</span>
                  </button>
                  {open === p.id && (
                    <div className="px-4 pb-4 space-y-3 nf-in">
                      <div><div className="text-[10.5px] tracking-[.3em] text-[#c9a96e]/75 mb-1">{L('汤面', 'THE PUZZLE')}</div><p className="font-serif text-[14px] leading-[1.85] text-parchment/80 whitespace-pre-wrap">{p.surface}</p></div>
                      {p.bottom && <div><div className="text-[10.5px] tracking-[.3em] text-[#c0453f]/80 mb-1">{L('汤底', 'THE TRUTH')}</div><p className="font-serif text-[14px] leading-[1.85] text-parchment/70 whitespace-pre-wrap">{p.bottom}</p></div>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {tab === 'end' && (
            <div className="space-y-2.5">
              {!(d.endings?.length || d.jbs?.length) && <Empty en={en} zh="还没打到过结局" e="No endings yet" href="/play" cta={L('去开一局跑团 →', 'Start a story →')} />}
              {d.endings?.map((e: any) => { const k = KIND[e.kind] || KIND.bitter; return (
                <div key={e.room} className="rounded-xl border bg-[#0b0c0f]/60 px-4 py-3.5" style={{ borderColor: k[2] + '40' }}>
                  <div className="flex items-center gap-2"><span className="text-[10.5px] tracking-[.2em]" style={{ color: k[2] }}>{en ? k[1] : k[0]}</span><span className="text-[11px] text-parchment/35">{fmtDay(e.at)} · {L('克苏鲁跑团', 'Call of Cthulhu')}</span></div>
                  <div className="mt-1 font-serif text-[16px] text-[#efe6d2]">{e.name ? `《${e.name}》` : e.story}</div>
                  {e.name && e.story && <div className="text-[12px] text-parchment/45">{e.story}</div>}
                  <p className="mt-1.5 text-[13px] leading-[1.75] text-parchment/60 line-clamp-3">{e.text}</p>
                  {e.who && <div className="mt-1.5 text-[11.5px] text-parchment/45">{e.who.name} · {e.who.alive ? L(`活着回来了，理智 ${e.who.san}`, `made it back, SAN ${e.who.san}`) : L('没能回来', 'did not come back')}</div>}
                </div>
              ); })}
              {d.jbs?.map((j: any) => (
                <div key={j.room} className="rounded-xl border border-white/[0.08] bg-[#0b0c0f]/60 px-4 py-3 flex items-center gap-3">
                  <span className="text-[18px]">🎭</span>
                  <span className="flex-1 min-w-0"><span className="block truncate font-serif text-[15px] text-[#efe6d2]">{j.name}</span><span className="text-[11.5px] text-parchment/40">{fmtDay(j.at)} · {L('剧本杀 · 已结案', 'Murder mystery · closed')}</span></span>
                  <a href={`/room/${j.room}`} className="text-[12px] text-[#c9a96e] border-b border-[#c9a96e]/40">{L('回看', 'Revisit')}</a>
                </div>
              ))}
            </div>
          )}

          {tab === 'inv' && (
            <div className="space-y-2.5">
              {!d.investigators?.length && <Empty en={en} zh="还没有调查员" e="No investigators yet" href="/play" cta={L('去跑一团 →', 'Start a story →')} />}
              {d.investigators?.length > 0 && <p className="text-[12px] text-parchment/45 mb-1">{L('活下来的调查员，可以在下一局跑团选人物时带进新故事。伤疤和失去的理智会一起带过去。', 'Survivors can be brought into your next story when you pick an investigator — scars and lost Sanity come with them.')}</p>}
              {d.investigators?.map((c: any) => { const f = FATE[c.fate] || FATE.left; return (
                <div key={c.id} className="rounded-xl border border-white/[0.08] bg-[#0b0c0f]/60 px-3.5 py-3 flex items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {c.avatar ? <img src={c.avatar} alt="" className={`w-12 h-12 rounded-full object-cover border ${c.fate === 'dead' ? 'grayscale' : ''}`} style={{ borderColor: f[2] + '66' }} /> : <span className="w-12 h-12 rounded-full bg-white/[0.05] flex items-center justify-center font-serif text-parchment/60">{String(c.name).slice(0, 1)}</span>}
                  <span className="flex-1 min-w-0">
                    <span className="flex items-center gap-2"><span className="truncate font-serif text-[15.5px] text-[#efe6d2]">{c.name}</span>{c.runs > 1 && <span className="text-[10px] px-1.5 rounded bg-[#e6c76e]/15 text-[#e6c76e]">{L(`第 ${c.runs} 个故事`, `story ${c.runs}`)}</span>}</span>
                    <span className="block text-[11.5px] text-parchment/45 truncate">{c.occupation} · {c.story}</span>
                    <span className="block mt-0.5 text-[11.5px]"><span style={{ color: f[2] }}>{en ? f[1] : f[0]}</span><span className="text-parchment/40"> · HP {c.hp}/{c.hpMax} · {L('理智', 'SAN')} {c.san}{c.sanStart && c.san < c.sanStart ? <span className="text-[#a78bfa]/80">{en ? ` (-${c.sanStart - c.san})` : `（-${c.sanStart - c.san}）`}</span> : ''}</span></span>
                  </span>
                </div>
              ); })}
            </div>
          )}
        </section>
      </div>

      {badge && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60" onClick={() => setBadge(null)}>
          <div className="w-full max-w-sm m-3 rounded-2xl border border-[#d8c7a8]/15 bg-[#121318] p-6 text-center mn-sheet" onClick={(e) => e.stopPropagation()}>
            <div className={`mx-auto w-20 h-20 rounded-full flex items-center justify-center text-[36px] border ${badge.earned ? 'border-[#e6c76e]/50 bg-[#e6c76e]/10' : 'border-white/10 grayscale opacity-40'}`}>{badge.icon}</div>
            <div className="mt-3 font-serif text-[20px] text-[#efe6d2]">{en ? badge.en : badge.zh}</div>
            <div className="mt-1 text-[13px] text-parchment/60">{en ? badge.den : badge.dzh}</div>
            <div className={`mt-3 text-[12px] ${badge.earned ? 'text-[#e6c76e]' : 'text-parchment/40'}`}>{badge.earned ? L('已获得', 'Earned') : L('还没拿到', 'Not yet')}</div>
          </div>
        </div>
      )}
    </main>
  );
}

function Empty({ zh, e, en, href, cta }: { zh: string; e: string; en: boolean; href: string; cta: string }) {
  return <div className="rounded-xl border border-dashed border-[#d8c7a8]/15 px-5 py-7 text-center"><div className="font-serif text-[15px] text-parchment/60">{en ? e : zh}</div><a href={href} className="mt-2 inline-block text-[13px] text-[#c9a96e] border-b border-[#c9a96e]/40">{cta}</a></div>;
}
