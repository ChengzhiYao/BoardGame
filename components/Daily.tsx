'use client';
// 每日一汤：大厅入口卡、结束后的成绩卡（可分享）、排行榜。
import { useEffect, useState } from 'react';
import { toast } from '@/components/Toast';
import { LightPaywall } from '@/components/LightPay';

export function useDaily(lang: 'zh' | 'en', bump = 0) {
  const [d, setD] = useState<any>(null);
  useEffect(() => { fetch(`/api/daily/status?lang=${lang}`).then((r) => r.json()).then(setD).catch(() => setD({ ok: false })); }, [lang, bump]);
  return d;
}

export async function startDaily(lang: 'zh' | 'en', day?: string): Promise<{ pay?: boolean } | void> {
  try {
    const r = await fetch('/api/daily/start', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lang, day }) });
    const d = await r.json().catch(() => ({}));
    if (d.url) { window.location.href = d.url; return; }
    if (d.reason === 'login' || r.status === 401) { const { signInWithGoogle } = await import('@/lib/auth'); await signInWithGoogle('/daily'); return; }
    if (d.reason === 'light_pay') return { pay: true };
    toast(d.error || (lang === 'en' ? 'Could not open it' : '没打开，再试一次'));
  } catch (e: any) { toast(e?.message || 'error'); }
}

function untilTomorrow(en: boolean) {
  const tz = en ? 'America/New_York' : 'Asia/Shanghai';
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', minute: 'numeric', hourCycle: 'h23' }).formatToParts(new Date());
  const h = Number(parts.find((p) => p.type === 'hour')?.value || 0), m = Number(parts.find((p) => p.type === 'minute')?.value || 0);
  const left = 24 * 60 - (h * 60 + m);
  return en ? `${Math.floor(left / 60)}h ${left % 60}m` : `${Math.floor(left / 60)} 小时 ${left % 60} 分`;
}

const Flame = ({ n, en }: { n: number; en: boolean }) => n > 0 ? (
  <span className="inline-flex items-center gap-1 text-[12px] text-[#f0a35a]"><span className="text-[13px]">🔥</span>{en ? `${n}-day streak` : `连续 ${n} 天`}</span>
) : null;

// 大厅里的入口：一条醒目的横幅
export function DailyCard({ en }: { en: boolean }) {
  const d = useDaily(en ? 'en' : 'zh');
  const [busy, setBusy] = useState(false);
  if (!d?.ok) return <div className="h-[76px] rounded-2xl bg-white/[0.03] animate-pulse" />;
  const done = !!d.me;
  return (
    <button onClick={async () => { if (done) { window.location.href = '/daily'; return; } setBusy(true); await startDaily(en ? 'en' : 'zh'); setBusy(false); }}
      className="group relative w-full overflow-hidden text-left rounded-2xl px-4 py-3.5 sm:px-5 flex items-center gap-3.5 border border-[#8fd3b8]/30 hover:border-[#8fd3b8]/55 transition-colors"
      style={{ background: 'linear-gradient(100deg, rgba(63,125,112,.28), rgba(63,125,112,.06) 60%, rgba(11,12,15,.7))' }}>
      <span className="shrink-0 w-12 h-12 rounded-xl flex flex-col items-center justify-center bg-[#0b0c0f]/60 border border-[#8fd3b8]/25">
        <span className="text-[9px] tracking-[.2em] text-[#8fd3b8]/80">{en ? 'NO.' : '第'}</span>
        <span className="font-serif text-[18px] leading-none text-[#e6f5ef]">{d.no}</span>
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2 flex-wrap">
          <span className="font-serif text-[16px] sm:text-[18px] font-semibold text-[#e6f5ef]">{en ? 'Daily Soup' : '每日一汤'}</span>
          <span className="text-[10px] tracking-[.14em] text-[#9fbf9f]/85">{en ? 'FREE' : '免费'}</span>
          <Flame n={d.streak} en={en} />
        </span>
        <span className="block mt-0.5 text-[12px] text-parchment/55 truncate">
          {done
            ? (d.me.solved ? (en ? `Solved in ${d.me.questions} · beat ${d.me.beat}% · next in ${untilTomorrow(en)}` : `${d.me.questions} 问破案 · 击败 ${d.me.beat}% · ${untilTomorrow(en)}后换新题`) : (en ? `Not cracked today · next in ${untilTomorrow(en)}` : `今天没猜出来 · ${untilTomorrow(en)}后换新题`))
            : d.playing ? (en ? 'You started today’s — keep going' : '今天这碗你还没喝完，接着来')
            : (en ? `Same puzzle for everyone today · ${d.players} played` : `全站今天同一道题 · 已有 ${d.players} 人挑战`)}
        </span>
      </span>
      <span className="shrink-0 h-9 px-3.5 rounded-full flex items-center text-[13px] bg-[#8fd3b8]/15 text-[#bfeadb] border border-[#8fd3b8]/30">{busy ? '…' : done ? (en ? 'Results' : '看成绩') : d.playing ? (en ? 'Resume' : '继续') : (en ? 'Play' : '挑战')}</span>
    </button>
  );
}

export function Board({ board, en, max = 10 }: { board: any[]; en: boolean; max?: number }) {
  if (!board?.length) return <div className="text-center text-[13px] text-parchment/40 py-4">{en ? 'Nobody yet — be the first.' : '还没人上榜，你来当第一个。'}</div>;
  return (
    <div className="divide-y divide-white/[0.05]">
      {board.slice(0, max).map((r) => (
        <button key={r.rank} onClick={() => { if (!r.me && r.id) try { window.dispatchEvent(new CustomEvent('mn-profile', { detail: { id: r.id } })); } catch {} }} className={`w-full text-left flex items-center gap-3 py-2 px-1 ${r.me ? 'bg-[#8fd3b8]/[0.06] rounded-lg' : ''}`}>
          <span className={`w-6 text-center font-serif text-[14px] ${r.rank <= 3 ? 'text-[#e6c76e]' : 'text-parchment/40'}`}>{r.rank}</span>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {r.avatar ? <img src={r.avatar} alt="" className="w-7 h-7 rounded-full object-cover" /> : <span className="w-7 h-7 rounded-full bg-white/[0.06] flex items-center justify-center text-[12px] text-parchment/60">{String(r.name).slice(0, 1)}</span>}
          <span className="flex-1 min-w-0 truncate text-[13.5px] text-parchment/85">{r.name}{r.me ? (en ? ' (you)' : '（你）') : ''}</span>
          <span className="shrink-0 text-[12px] text-parchment/55">{r.solved ? (en ? `${r.questions} Q` : `${r.questions} 问`) : (en ? 'gave up' : '没猜出')}{r.hints ? (en ? ` · ${r.hints} hint` : ` · ${r.hints} 提示`) : ''}</span>
        </button>
      ))}
    </div>
  );
}

// 每日一汤结束后：成绩卡 + 分享 + 排行
export function DailyResult({ en, grid }: { en: boolean; grid?: string }) {
  const [bump, setBump] = useState(0);
  const d = useDaily(en ? 'en' : 'zh', bump);
  // 成绩刚写进去，稍等再拉一次
  useEffect(() => { const t = setTimeout(() => setBump(1), 1500); return () => clearTimeout(t); }, []);
  if (!d?.ok) return null;
  const r = d.me;
  if (!r) return <div className="text-center text-[13px] text-parchment/45 py-3">{en ? 'Only your first try each day counts on the board.' : '每天只有第一次挑战计入排行。'}</div>;
  async function share() {
    const { shareText } = await import('@/lib/soup/daily');
    const t = shareText(r, d.no, en, d.streak);
    try { if ((navigator as any).share) { await (navigator as any).share({ text: t }); return; } } catch { return; }
    try { await navigator.clipboard.writeText(t); toast(en ? 'Copied — paste it anywhere' : '已复制，去群里贴一下', 'info'); } catch {}
  }
  const cells = Array.from(String(r.grid || grid || ''));
  return (
    <div className="rounded-2xl border border-[#8fd3b8]/25 bg-[#0b0c0f]/80 backdrop-blur-md p-4 nf-in">
      <div className="flex items-baseline justify-between">
        <span className="text-[10.5px] tracking-[.3em] text-[#8fd3b8]/85">{en ? `DAILY SOUP #${d.no}` : `每日一汤 · 第 ${d.no} 期`}</span>
        <Flame n={d.streak} en={en} />
      </div>
      <div className="mt-2 font-serif text-[22px] text-[#e6f5ef]">{r.solved ? (en ? `Solved in ${r.questions} questions` : `${r.questions} 问破案`) : (en ? 'Not this time' : '这次没猜出来')}</div>
      <div className="mt-1 text-[12.5px] text-parchment/55">
        {r.solved && (en ? `Beat ${r.beat}% of players · ` : `击败了 ${r.beat}% 的人 · `)}
        {en ? `#${r.rank} of ${d.players}` : `今天第 ${r.rank} / ${d.players} 名`}{r.hints ? (en ? ` · ${r.hints} hints` : ` · 用了 ${r.hints} 个提示`) : ''}
      </div>
      {cells.length > 0 && <div className="mt-3 text-[17px] leading-[1.35] tracking-[2px] break-all">{cells.join('')}</div>}
      <div className="mt-3.5 flex gap-2">
        <button onClick={share} className="flex-1 h-10 rounded-xl bg-[#8fd3b8]/20 border border-[#8fd3b8]/40 text-[#e6f5ef] text-[14px]">{en ? 'Share (no spoilers)' : '分享成绩（不剧透）'}</button>
        <a href="/daily" className="h-10 px-4 rounded-xl border border-white/10 text-parchment/70 text-[13px] flex items-center">{en ? 'Leaderboard' : '排行榜'}</a>
      </div>
      <div className="mt-2.5 text-[11.5px] text-parchment/40 text-center">{en ? `New puzzle in ${untilTomorrow(en)}` : `${untilTomorrow(en)}后出下一碗`}{d.protected ? (en ? ' · your streak is protected' : ' · 你有断签保护') : ''}</div>
    </div>
  );
}

// /daily 页面主体
export function DailyPage({ en }: { en: boolean }) {
  const d = useDaily(en ? 'en' : 'zh');
  const [busy, setBusy] = useState('');
  const [pay, setPay] = useState(false);
  async function go(day?: string) { setBusy(day || 'today'); const r = await startDaily(en ? 'en' : 'zh', day); if (r?.pay) setPay(true); setBusy(''); }
  if (!d) return <div className="pt-40 text-center text-parchment/40">…</div>;
  if (!d.ok) return <div className="pt-40 text-center text-parchment/50">{en ? 'No puzzle today.' : '今天的题还没备好。'}</div>;
  return (
    <div className="w-full max-w-md mx-auto px-5 pb-20" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 72px)' }}>
      <div className="text-center">
        <div className="text-[10px] tracking-[.5em] pl-[.5em] uppercase text-[#8fd3b8]/80">Daily Soup</div>
        <h1 className="mt-2 font-serif font-semibold text-[30px] tracking-[.08em] text-[#e6f5ef]">{en ? 'Daily Soup' : '每日一汤'}</h1>
        <div className="mt-1 text-[13px] text-parchment/50">{en ? `No. ${d.no} · ${d.players} played · ${d.solved} cracked it` : `第 ${d.no} 期 · ${d.players} 人挑战 · ${d.solved} 人猜中`}</div>
        {d.title && <div className="mt-4 font-serif text-[19px] text-[#efe6d2]">《{d.title}》</div>}
        <p className="mt-3 text-[13.5px] leading-[1.8] text-parchment/65">{en ? 'Everyone gets the same puzzle today. Fewest questions wins. Only your first try counts.' : '全站今天喝同一碗汤，问得越少排名越高。每人每天只算第一次。'}</p>
      </div>

      <div className="mt-6">
        {d.me ? <DailyResult en={en} /> : (
          <button onClick={() => go()} disabled={!!busy} className="w-full py-3.5 rounded-xl bg-[#2f6b5f] hover:bg-[#367a6c] border border-[#8fd3b8]/45 text-[#f0faf6] font-serif font-semibold tracking-[.2em] text-[17px] disabled:opacity-50">
            {busy === 'today' ? '…' : d.playing ? (en ? 'Continue today’s' : '继续今天这碗') : !d.loggedIn ? (en ? 'Sign in to play' : '登录后挑战') : (en ? 'Start today’s' : '开始挑战')}
          </button>
        )}
        {!d.me && <div className="mt-2.5 text-center"><Flame n={d.streak} en={en} /></div>}
      </div>

      <section className="mt-8">
        <div className="text-[11px] tracking-[.28em] text-parchment/40 mb-2">{en ? 'TODAY’S BOARD' : '今日排行'}</div>
        <div className="rounded-2xl border border-white/[0.08] bg-[#0b0c0f]/60 px-3 py-1.5"><Board board={d.board} en={en} /></div>
      </section>

      <section className="mt-8">
        <div className="text-[11px] tracking-[.28em] text-parchment/40 mb-2">{en ? 'STREAK PROTECTION' : '断签保护'}</div>
        <p className="text-[13px] leading-[1.75] text-parchment/60">
          {en ? 'Members and pass holders can miss one day a week without losing their streak.' : '会员、畅玩卡和派对夜卡用户，每 7 天可以漏掉 1 天，连续天数不会断。'}
          {d.protected ? <span className="text-[#8fd3b8]">{en ? ' You have it.' : ' 你已经有了。'}</span> : <a href="/upgrade" className="ml-1 text-[#c9a96e] border-b border-[#c9a96e]/40">{en ? 'Get it →' : '去开通 →'}</a>}
          {d.savedDays > 0 && <span className="block mt-1 text-[12px] text-parchment/45">{en ? `Saved your streak ${d.savedDays} time(s).` : `已经帮你保住过 ${d.savedDays} 次。`}</span>}
        </p>
      </section>

      {d.archive?.length > 0 && (
        <section className="mt-8">
          <div className="text-[11px] tracking-[.28em] text-parchment/40 mb-2">{en ? 'PAST PUZZLES' : '往期'}</div>
          <div className="text-[12px] text-parchment/40 mb-2">{en ? 'Replays count as a regular soup bowl (2 free a day).' : '补玩往期按普通海龟汤算（每天 2 碗免费）。'}</div>
          <div className="space-y-1.5">
            {d.archive.map((a: any) => (
              <div key={a.day} className="flex items-center gap-3 rounded-xl border border-white/[0.07] bg-[#0b0c0f]/50 px-3 py-2.5">
                <span className="w-10 text-center font-serif text-[14px] text-[#8fd3b8]/80">#{a.no}</span>
                <span className="flex-1 min-w-0"><span className="block truncate text-[13.5px] text-parchment/85">{a.title || '—'}</span><span className="text-[11px] text-parchment/40">{a.day}</span></span>
                {a.result ? <span className="text-[12px] text-parchment/55">{a.result.solved ? (en ? `✅ ${a.result.questions} Q` : `✅ ${a.result.questions} 问`) : '❌'}</span>
                  : <button onClick={() => go(a.day)} disabled={!!busy} className="text-[12.5px] text-[#c9a96e] border-b border-[#c9a96e]/40">{busy === a.day ? '…' : (en ? 'Play' : '补玩')}</button>}
              </div>
            ))}
          </div>
        </section>
      )}
      <div className="mt-10 text-center"><a href="/play" className="text-[13px] text-parchment/50 border-b border-white/15">{en ? 'Back to the hall' : '回到大厅'}</a></div>
      <LightPaywall open={pay} onClose={() => setPay(false)} mode="soup" en={en} />
    </div>
  );
}
