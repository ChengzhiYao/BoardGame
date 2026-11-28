'use client';
// 谜夜首页动态背景（夜景 + 漂浮翻转的游戏卡牌 + 飘落物 + 暗处的眼睛 + 远处闪电）。绘制逻辑在 /public/nightbg.js。
// 主题(月夜 / 雪夜 / 樱夜 / 雷雨 / 血月 / 深渊…)由玩家在「我的」里换,存在 localStorage 和账号上;换了立刻生效。
import { useEffect, useRef, useState } from 'react';

export default function NightBackground() {
  const ref = useRef<HTMLCanvasElement>(null);
  const [theme, setTheme] = useState<string>(() => { try { return localStorage.getItem('mn_bg') || 'night'; } catch { return 'night'; } });
  useEffect(() => {
    const on = (e: any) => { const t = String(e?.detail || 'night'); try { localStorage.setItem('mn_bg', t); } catch {} setTheme(t); };
    window.addEventListener('mn-bg', on);
    // 账号上存的(换了设备也一样)
    fetch('/api/me/bg', { cache: 'no-store' }).then((r) => r.json()).then((d) => { if (d?.bg && d.bg !== theme) on({ detail: d.bg }); }).catch(() => {});
    return () => window.removeEventListener('mn-bg', on);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    let stop: (() => void) | null = null; let dead = false;
    const run = () => { if (!dead && ref.current && (window as any).startNightBg) stop = (window as any).startNightBg(ref.current, { theme }); };
    if ((window as any).startNightBg) run();
    else {
      const s = document.createElement('script'); s.src = '/nightbg.js?v=3'; s.async = true; s.onload = run;
      document.head.appendChild(s);
    }
    return () => { dead = true; stop?.(); };
  }, [theme]);
  return <canvas ref={ref} aria-hidden className="fixed inset-0 w-full h-full pointer-events-none -z-20" style={{ background: '#080a16' }} />;
}
