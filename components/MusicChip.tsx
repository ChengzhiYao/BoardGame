'use client';
import { useEffect, useState } from 'react';
import { getClientLang } from '@/lib/i18n';

// 右上角「音乐」入口：跳到 /music（独立的静态音乐网站，放在 public/music 下）
export default function MusicChip({ en: enProp }: { en?: boolean }) {
  const [en, setEn] = useState(!!enProp);
  useEffect(() => { if (enProp !== undefined) { setEn(enProp); return; } try { setEn(getClientLang() === 'en'); } catch {} }, [enProp]);
  return (
    <a href="/music" title={en ? 'Music' : '音乐'}
      className="relative flex items-center gap-1.5 rounded-full bg-fog/80 border border-eldritch/30 px-2.5 py-1.5 text-xs text-parchment/80 backdrop-blur hover:border-eldritch/60 hover:text-parchment">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></svg>
      <span className="whitespace-nowrap">{en ? 'Music' : '音乐'}</span>
    </a>
  );
}
