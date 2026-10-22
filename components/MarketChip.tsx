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
  const fmt = (n: number) => '¥' + (n || 0).toLocaleString();

  return (
    <button onClick={open} title={en ? 'The Market' : '身价场'}
      className="relative flex items-center gap-1.5 rounded-full bg-fog/80 border border-amber-500/30 px-2.5 py-1.5 text-xs text-parchment/80 backdrop-blur hover:border-amber-400/60">
      <span>💰</span>
      <span className="text-amber-300/90">{fmt(d.price)}</span>
      {hasNew && <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-blood border-2 border-fog animate-pulse" />}
    </button>
  );
}
