'use client';
// 轻玩法（海龟汤 / 猫诅咒）：今日免费局的余量提示 + 用完后的付费面板（$1 一局 / $10 两小时 / 会员）
import { useEffect, useState } from 'react';

export type LightStatus = { login?: boolean; whitelisted?: boolean; member?: boolean; dailyTotal?: number; freeLeft?: number; credits?: number; passUntil?: string | null; memberWeekLeft?: number };

export function useLightStatus(mode: 'soup' | 'mcc', bump = 0) {
  const [st, setSt] = useState<LightStatus | null>(null);
  useEffect(() => {
    let dead = false;
    fetch(`/api/light/status?mode=${mode}`).then((r) => r.json()).then((d) => { if (!dead) setSt(d); }).catch(() => {});
    return () => { dead = true; };
  }, [mode, bump]);
  return st;
}

export function LightLine({ st, mode, en }: { st: LightStatus | null; mode: 'soup' | 'mcc'; en: boolean }) {
  const [, tick] = useState(0);
  useEffect(() => { const id = setInterval(() => tick((x) => x + 1), 30000); return () => clearInterval(id); }, []);
  if (!st || !st.login || st.whitelisted) return null;
  const unit = mode === 'soup' ? (en ? 'bowl' : '碗') : (en ? 'game' : '局');
  let txt = '';
  if (st.passUntil) {
    const mins = Math.max(0, Math.round((new Date(st.passUntil).getTime() - Date.now()) / 60000));
    txt = en ? `Pass active · ${Math.floor(mins / 60)}h ${mins % 60}m left` : `畅玩中 · 还剩 ${Math.floor(mins / 60)} 小时 ${mins % 60} 分`;
  } else if ((st.freeLeft || 0) > 0) {
    txt = en ? `${st.freeLeft} free ${unit}${(st.freeLeft || 0) > 1 ? 's' : ''} left today` : `今天还能免费玩 ${st.freeLeft} ${unit}`;
  } else if (st.member && (st.memberWeekLeft || 0) > 0) {
    const m = Math.round((st.memberWeekLeft || 0) / 60);
    txt = en ? `Member time · ${m} min left this week` : `会员时长 · 本周还剩 ${m} 分钟`;
  } else if ((st.credits || 0) > 0) {
    txt = en ? `${st.credits} paid ${unit}${(st.credits || 0) > 1 ? 's' : ''} ready` : `已买 ${st.credits} ${unit}，随时开`;
  } else {
    txt = en ? 'Today’s free games are used up' : '今天的免费局用完了';
  }
  return <p className="text-[12px] text-parchment/45 text-center">{txt}</p>;
}

export function LightPaywall({ open, onClose, mode, en }: { open: boolean; onClose: () => void; mode: 'soup' | 'mcc'; en: boolean }) {
  const [busy, setBusy] = useState('');
  if (!open) return null;
  const unit = mode === 'soup' ? (en ? 'bowl' : '碗') : (en ? 'game' : '局');
  async function buy(plan: string) {
    setBusy(plan);
    try {
      const rt = typeof window !== 'undefined' ? window.location.pathname : '/play';
      const r = await fetch('/api/billing/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ plan, returnTo: rt }) });
      const d = await r.json();
      if (d.url) { window.location.href = d.url; return; }
      alert(d.error || (en ? 'Failed' : '创建支付失败'));
    } catch { alert(en ? 'Network error' : '网络错误'); }
    setBusy('');
  }
  const Opt = ({ plan, price, title, sub, strong }: { plan: string; price: string; title: string; sub: string; strong?: boolean }) => (
    <button onClick={() => buy(plan)} disabled={!!busy}
      className={`w-full rounded-2xl px-4 py-3.5 flex items-center gap-3 text-left border transition disabled:opacity-50 ${strong ? 'border-[#a83232]/60 bg-[#7d1d1d]/35' : 'border-white/10 bg-white/[0.035]'}`}>
      <span className="min-w-0 flex-1"><span className="block text-[15px] text-[#efe6d2]">{title}</span><span className="block text-[12px] text-parchment/50 mt-0.5">{sub}</span></span>
      <span className="shrink-0 font-serif text-[20px] text-[#efe6d2]">{busy === plan ? '…' : price}</span>
    </button>
  );
  return (
    <div className="fixed inset-0 z-[90]" onClick={onClose}>
      <div className="absolute inset-0 bg-black/65 backdrop-blur-[2px] mn-fadein" />
      <div onClick={(e) => e.stopPropagation()} className="mn-sheet absolute inset-x-0 bottom-0 sm:inset-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-[400px] rounded-t-3xl sm:rounded-3xl bg-[#111216] border border-white/10 px-5 pt-3 sm:pt-5" style={{ paddingBottom: 'max(22px, env(safe-area-inset-bottom))' }}>
        <div className="mx-auto w-10 h-1 rounded-full bg-white/15 sm:hidden" />
        <div className="mt-4 sm:mt-0 text-center">
          <div className="font-serif text-[20px] text-[#efe6d2]">{en ? 'Today’s free games are used up' : '今天的免费局用完了'}</div>
          <p className="mt-1.5 text-[13px] text-parchment/50">{mode === 'soup' ? (en ? '2 free bowls every day — back tomorrow, or keep going now.' : '每天送 2 碗，明天会再送；也可以现在接着玩。') : (en ? '1 free game every day — back tomorrow, or keep going now.' : '每天送 1 局，明天会再送；也可以现在接着玩。')}</p>
        </div>
        <div className="mt-5 space-y-2.5">
          <Opt plan="light1" price="$1" title={en ? `One more ${unit}` : `再来一${unit}`} sub={en ? 'Just this one' : '只买这一次'} />
          <Opt plan="pass2h" price="$10" strong title={en ? '2 hours, unlimited' : '2 小时随便玩'} sub={en ? 'Soup and Cat Curse — no counting' : '海龟汤、猫诅咒都不限局数'} />
          <a href="/upgrade" className="block w-full rounded-2xl px-4 py-3 text-center text-[13px] text-parchment/60 border border-white/[0.07]">{en ? 'Or become a member →' : '或者开通会员 →'}</a>
        </div>
        <button onClick={onClose} className="mt-3 w-full h-10 text-[13px] text-parchment/40">{en ? 'Not now' : '先不了'}</button>
      </div>
    </div>
  );
}
