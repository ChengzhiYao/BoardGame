'use client';
// 播放一段介绍配音（固定稿子）。同一时间只放一段。
import { useEffect, useRef, useState } from 'react';
let current: HTMLAudioElement | null = null;
export function useIntroVoice() {
  const [state, setState] = useState<'idle' | 'loading' | 'playing'>('idle');
  const mine = useRef<HTMLAudioElement | null>(null);
  async function play(k: string, lang: 'zh' | 'en') {
    stop();
    setState('loading');
    try {
      const r = await fetch(`/api/public/intro?k=${encodeURIComponent(k)}&lang=${lang}`);
      const d = await r.json();
      if (!d?.url) { setState('idle'); return; }
      try { current?.pause(); } catch {}
      const a = new Audio(d.url); mine.current = a; current = a;
      a.onended = () => setState('idle'); a.onerror = () => setState('idle');
      await a.play(); setState('playing');
    } catch { setState('idle'); }
  }
  function stop() { try { mine.current?.pause(); } catch {} mine.current = null; setState('idle'); }
  useEffect(() => () => { try { mine.current?.pause(); } catch {} }, []);
  return { state, play, stop };
}
