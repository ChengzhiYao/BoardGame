'use client';
// 和 Linger 伴侣一起玩的局:不显示大厅/选本,直接显示"TA 正在开局",像被朋友拉进一局那样
import { useEffect, useState } from 'react';
export default function CompanionWaiting({ comp, en, title, sub, onStart, busy }: { comp: any; en: boolean; title?: string; sub?: string; onStart?: () => void; busy?: boolean }) {
  const [slow, setSlow] = useState(false);
  useEffect(() => { const t = setTimeout(() => setSlow(true), 30000); return () => clearTimeout(t); }, []);
  const nm = comp?.name || '';
  return (
    <main className="min-h-[100svh] flex flex-col items-center justify-center gap-5 px-6 text-center">
      {comp?.avatar ? <img src={comp.avatar} alt="" className="w-20 h-20 rounded-full object-cover border border-eldritch/40" /> : null}
      <h1 className="text-2xl font-serif text-parchment">{title || (en ? `${nm} is setting up the game…` : `${nm} 正在开局…`)}</h1>
      {sub ? <p className="text-parchment/55 max-w-sm">{sub}</p> : null}
      <div className="flex gap-1.5">{[0, 1, 2].map((i) => <span key={i} className="w-2 h-2 rounded-full bg-parchment/50 animate-pulse" style={{ animationDelay: `${i * 0.2}s` }} />)}</div>
      {slow && onStart && <button disabled={busy} onClick={onStart} className="mt-2 px-5 py-2 rounded-full border border-eldritch/40 text-sm text-parchment/80">{en ? 'Taking too long? Start now' : '等太久了?现在开始'}</button>}
    </main>
  );
}
