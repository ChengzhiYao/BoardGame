'use client';
// 一局结束时挂上：有新称号就从底部弹一张小卡，点开去收藏页
import { useEffect, useRef, useState } from 'react';
import Icon from '@/components/Icon';

export default function BadgeCheck({ en }: { en: boolean }) {
  const done = useRef(false);
  const [list, setList] = useState<any[]>([]);
  useEffect(() => {
    if (done.current) return; done.current = true;
    const t = setTimeout(() => {
      fetch('/api/me/badges', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lang: en ? 'en' : 'zh' }) })
        .then((r) => r.json()).then((d) => { if (d?.fresh?.length) setList(d.fresh); }).catch(() => {});
    }, 2500);
    return () => clearTimeout(t);
  }, [en]);
  // 每张卡停 6 秒自己收起，不挡着汤底
  useEffect(() => { if (!list.length) return; const t = setTimeout(() => setList((l) => l.slice(1)), 6000); return () => clearTimeout(t); }, [list]);
  if (!list.length) return null;
  const b = list[0];
  return (
    <div className="fixed inset-x-0 z-50 flex justify-center px-4 pointer-events-none" style={{ bottom: 'calc(env(safe-area-inset-bottom) + 96px)' }}>
      <a href="/me" className={`pointer-events-auto w-full max-w-sm flex items-center gap-3 rounded-2xl border ${b.dark ? "border-[#a78bfa]/40 bg-[#14111c]/95" : "border-[#e6c76e]/40 bg-[#17140c]/95"} backdrop-blur-xl px-4 py-3 shadow-[0_20px_60px_-15px_rgba(0,0,0,.8)] mn-sheet`}>
        <span className="shrink-0 w-12 h-12 rounded-full flex items-center justify-center bg-[#e6c76e]/15 border border-[#e6c76e]/40 text-[#f1d58a] mcc-breathe"><Icon n={b.icon} size={24} stroke={1.5} /></span>
        <span className="flex-1 min-w-0">
          <span className="block text-[10.5px] tracking-[.3em] text-[#e6c76e]/85">{b.dark ? (en ? 'BLACK MARK' : '解锁黑历史') : (en ? 'NEW TITLE' : '获得新称号')}</span>
          <span className="block font-serif text-[17px] text-[#f6ecd0]">{en ? b.en : b.zh}</span>
          <span className="block text-[12px] text-parchment/55 truncate">{en ? b.den : b.dzh}{list.length > 1 ? (en ? ` · +${list.length - 1} more` : ` · 还有 ${list.length - 1} 个`) : ''}</span>
        </span>
        <button onClick={(e) => { e.preventDefault(); setList((l) => l.slice(1)); }} className="shrink-0 text-parchment/40 text-[18px] px-1">×</button>
      </a>
    </div>
  );
}
