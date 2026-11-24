'use client';
// 横向滑动的海报栏：一屏一张、居中对齐，下面是页码点，电脑上有左右箭头
import { useEffect, useRef, useState } from 'react';
import Icon from '@/components/Icon';

export default function PosterRail({ count, children }: { count: number; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [at, setAt] = useState(0);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const on = () => { const kids = Array.from(el.children) as HTMLElement[]; const mid = el.scrollLeft + el.clientWidth / 2; let best = 0, d = 1e9; kids.forEach((k, i) => { const c = k.offsetLeft + k.offsetWidth / 2; if (Math.abs(c - mid) < d) { d = Math.abs(c - mid); best = i; } }); setAt(best); };
    el.addEventListener('scroll', on, { passive: true }); return () => el.removeEventListener('scroll', on);
  }, []);
  const go = (i: number) => { const el = ref.current; const k = el?.children[Math.max(0, Math.min(count - 1, i))] as HTMLElement | undefined; if (el && k) el.scrollTo({ left: k.offsetLeft - (el.clientWidth - k.offsetWidth) / 2, behavior: 'smooth' }); };
  return (
    <div className="relative -mx-5">
      <div ref={ref} className="flex gap-4 overflow-x-auto snap-x snap-mandatory px-[11vw] sm:px-[calc(50%-170px)] py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">{children}</div>
      <button onClick={() => go(at - 1)} disabled={at === 0} aria-label="prev" className="hidden sm:flex absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/50 border border-white/10 items-center justify-center text-parchment/70 disabled:opacity-0"><Icon n="prev" size={18} /></button>
      <button onClick={() => go(at + 1)} disabled={at >= count - 1} aria-label="next" className="hidden sm:flex absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/50 border border-white/10 items-center justify-center text-parchment/70 disabled:opacity-0"><Icon n="next" size={18} /></button>
      <div className="mt-3 flex justify-center gap-1.5">{Array.from({ length: count }).map((_, i) => <button key={i} onClick={() => go(i)} aria-label={`${i + 1}`} className={`h-1.5 rounded-full transition-all ${i === at ? 'w-5 bg-[#c9a96e]' : 'w-1.5 bg-white/20'}`} />)}</div>
    </div>
  );
}
