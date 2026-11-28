'use client';
// 首页背景 iframe 的地址:跟着玩家在「我的」里选的动态背景走(本机先用 localStorage,再和账号同步)
import { useEffect, useState } from 'react';
import { bgSrc, DEFAULT_BG_SRC } from '@/lib/bg3d';

export function useHomeBgSrc() {
  const [src, setSrc] = useState(DEFAULT_BG_SRC);
  useEffect(() => {
    const apply = (id?: string | null) => setSrc(bgSrc(id));
    try { apply(localStorage.getItem('mn_bg')); } catch {}
    const on = (e: any) => { const id = String(e?.detail || 'night'); try { localStorage.setItem('mn_bg', id); } catch {} apply(id); };
    window.addEventListener('mn-bg', on);
    fetch('/api/me/bg', { cache: 'no-store' }).then((r) => r.json()).then((d) => { if (d?.ok && d.bg) { try { localStorage.setItem('mn_bg', d.bg); } catch {} apply(d.bg); } }).catch(() => {});
    return () => window.removeEventListener('mn-bg', on);
  }, []);
  return src;
}
