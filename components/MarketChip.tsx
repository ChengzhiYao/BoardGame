'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getClientLang } from '@/lib/i18n';

export default function MarketChip() {
  const router = useRouter();
  const [en, setEn] = useState(false);
  const [d, setD] = useState<any>(null);
  const [hasNew, setHasNew] = useState(false);
  useEffect(() => { try { setEn(getClientLang() === 'en'); } catch {} }, []);

  async function load() {
    try {
      const r = await fetch('/api/market/me'); const j = await r.json();
      if (!j.loggedIn) { setD(null); return; }
      setD(j);
      try {
        const key = 'mkt_seen_owner';
        const seen = localStorage.getItem(key); // null = 从未记录
        const cur = j.ownerId || '';
        if (seen === null) { localStorage.setItem(key, cur); }
        else if (seen !== cur) { setHasNew(true); }
      } catch {}
    } catch {}
  }
  useEffect(() => { load(); const id = setInterval(load, 30000); return () => clearInterval(id); }, []);

  if (!d) return null;
  const open = () => { try { localStorage.setItem('mkt_seen_owner', d.ownerId || ''); } catch {} setHasNew(false); router.push('/market'); };

  return (
    <button onClick={open} title={en ? 'The Market' : '身价场'}
      className="relative flex items-center gap-1.5 rounded-full bg-fog/80 border border-eldritch/30 px-2.5 py-1.5 text-xs text-parchment/80 backdrop-blur hover:border-eldritch/60 hover:text-parchment">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><path d="M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0L2 12V2h10l8.6 8.6a2 2 0 0 1 0 2.8z" /><line x1="7" y1="7" x2="7.01" y2="7" /></svg>
      <span className="whitespace-nowrap">{en ? 'The Market' : '身价场'}</span>
      {hasNew && <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-blood border-2 border-fog animate-pulse" />}
    </button>
  );
}
