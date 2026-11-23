'use client';
import { useEffect, useState } from 'react';
import { getClientLang } from '@/lib/i18n';
import { DailyPage } from '@/components/Daily';

export default function DailyClient() {
  const [en, setEn] = useState<boolean | null>(null);
  useEffect(() => { try { setEn(getClientLang() === 'en'); } catch { setEn(false); } }, []);
  return (
    <main className="min-h-[100svh]">
      <a href="/play" className="fixed left-3 z-30 h-8 px-3 rounded-full flex items-center text-[12.5px] text-parchment/70 border border-white/10 bg-ink/60 backdrop-blur" style={{ top: 'calc(env(safe-area-inset-top) + 10px)' }}>{en ? '← Hall' : '← 大厅'}</a>
      {en !== null && <DailyPage en={en} />}
    </main>
  );
}
