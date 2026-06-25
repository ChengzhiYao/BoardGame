'use client';
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

export default function Track() {
  const pathname = usePathname();
  useEffect(() => {
    if (!pathname) return;
    try {
      fetch('/api/track', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path: pathname, ref: document.referrer || '' }), keepalive: true });
    } catch {}
  }, [pathname]);
  return null;
}
