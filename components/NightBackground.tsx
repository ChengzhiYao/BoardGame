'use client';
// 谜夜首页动态背景（月夜 + 漂浮翻转的游戏卡牌 + 萤火 + 暗处的眼睛 + 远处闪电）。绘制逻辑在 /public/nightbg.js。
import { useEffect, useRef } from 'react';

export default function NightBackground() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let stop: (() => void) | null = null; let dead = false;
    const run = () => { if (!dead && ref.current && (window as any).startNightBg) stop = (window as any).startNightBg(ref.current); };
    if ((window as any).startNightBg) run();
    else {
      const s = document.createElement('script'); s.src = '/nightbg.js'; s.async = true; s.onload = run;
      document.head.appendChild(s);
    }
    return () => { dead = true; stop?.(); };
  }, []);
  return <canvas ref={ref} aria-hidden className="fixed inset-0 w-full h-full pointer-events-none -z-20" style={{ background: '#080a16' }} />;
}
