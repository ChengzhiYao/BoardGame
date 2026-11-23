'use client';
// 派对夜卡：一个人付，整桌朋友一起玩 3 小时，所有玩法随便开。
import { useEffect, useState } from 'react';
import { toast } from '@/components/Toast';

export async function buyParty(en: boolean) {
  try {
    const r = await fetch('/api/billing/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ plan: 'party3h', returnTo: typeof window !== 'undefined' ? window.location.pathname : '/play' }) });
    const d = await r.json();
    if (d.url) { window.location.href = d.url; return; }
    toast(d.error || (en ? 'Could not start checkout' : '没能打开支付'));
  } catch { toast(en ? 'Network error' : '网络错误'); }
}

export default function PartyPass({ en, until, compact }: { en: boolean; until?: string | null; compact?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [, tick] = useState(0);
  useEffect(() => { const id = setInterval(() => tick((x) => x + 1), 30000); return () => clearInterval(id); }, []);
  const left = until ? Math.max(0, new Date(until).getTime() - Date.now()) : 0;
  if (left > 0) {
    const m = Math.round(left / 60000);
    return (
      <div className="rounded-2xl border border-[#f2a65a]/45 bg-[linear-gradient(110deg,rgba(242,166,90,.18),rgba(242,166,90,.04)_60%,rgba(11,12,15,.6))] px-4 py-3 flex items-center gap-3">
        <span className="text-[22px]">🎉</span>
        <span className="flex-1 min-w-0"><span className="block font-serif text-[15px] text-[#fbe7cf]">{en ? 'Party night is on' : '派对夜进行中'}</span><span className="block text-[12px] text-[#fbe7cf]/60">{en ? `Every game unlocked · ${Math.floor(m / 60)}h ${m % 60}m left` : `所有玩法随便开 · 还剩 ${Math.floor(m / 60)} 小时 ${m % 60} 分`}</span></span>
      </div>
    );
  }
  return (
    <button onClick={async () => { setBusy(true); await buyParty(en); setBusy(false); }} disabled={busy}
      className="group w-full text-left rounded-2xl border border-[#f2a65a]/40 bg-[linear-gradient(110deg,rgba(242,166,90,.16),rgba(242,166,90,.03)_55%,rgba(11,12,15,.65))] px-4 py-3.5 flex items-center gap-3.5 hover:border-[#f2a65a]/70 transition-colors disabled:opacity-60">
      <span className="shrink-0 w-11 h-11 rounded-xl bg-[#f2a65a]/20 flex items-center justify-center text-[22px]">🎉</span>
      <span className="min-w-0 flex-1">
        <span className="block font-serif text-[16px] text-[#fbe7cf]">{en ? 'Playing with friends tonight?' : '今晚和朋友一起玩？'}</span>
        <span className="block text-[12px] text-[#fbe7cf]/60 leading-snug">{compact ? (en ? 'Party pass: 3 hours, every game, friends free' : '派对夜卡：3 小时全部玩法，朋友免费') : (en ? 'Party pass — 3 hours of every game incl. Murder Mystery & Cthulhu. You pay once, friends join free.' : '派对夜卡——3 小时所有玩法随便开，含剧本杀和克苏鲁。你付一次，朋友进来都免费。')}</span>
      </span>
      <span className="shrink-0 text-right"><span className="block font-serif text-[19px] text-[#fbe7cf]">{busy ? '…' : '$6.99'}</span><span className="block text-[10.5px] text-[#fbe7cf]/50">{en ? '3 hours' : '3 小时'}</span></span>
    </button>
  );
}
