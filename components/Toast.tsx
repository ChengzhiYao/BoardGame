'use client';
// 站内提示条 + 确认面板，替代浏览器自带的 alert / confirm（那种 "xxx.com says" 的弹窗）。
import { useEffect, useState } from 'react';

export function toast(msg: any, kind: 'info' | 'error' = 'error') {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('mn-toast', { detail: { msg: String(msg ?? ''), kind } }));
}

export function ask(msg: string, opts: { ok?: string; cancel?: string; danger?: boolean } = {}): Promise<boolean> {
  if (typeof window === 'undefined') return Promise.resolve(false);
  return new Promise((resolve) => window.dispatchEvent(new CustomEvent('mn-confirm', { detail: { msg, ...opts, resolve } })));
}

export default function Toaster() {
  const [items, setItems] = useState<{ id: number; msg: string; kind: string }[]>([]);
  const [dlg, setDlg] = useState<any>(null);
  useEffect(() => {
    const onT = (e: any) => {
      const id = Date.now() + Math.random();
      setItems((x) => [...x.slice(-2), { id, ...e.detail }]);
      setTimeout(() => setItems((x) => x.filter((i) => i.id !== id)), 4200);
    };
    const onC = (e: any) => setDlg(e.detail);
    window.addEventListener('mn-toast', onT); window.addEventListener('mn-confirm', onC);
    return () => { window.removeEventListener('mn-toast', onT); window.removeEventListener('mn-confirm', onC); };
  }, []);
  const close = (v: boolean) => { dlg?.resolve?.(v); setDlg(null); };
  const en = typeof document !== 'undefined' && document.documentElement.lang === 'en';
  return (
    <>
      <div className="fixed left-1/2 -translate-x-1/2 z-[200] w-[min(92vw,420px)] space-y-2 pointer-events-none" style={{ top: 'calc(max(10px, env(safe-area-inset-top)) + 58px)' }}>
        {items.map((t) => (
          <div key={t.id} onClick={() => setItems((x) => x.filter((i) => i.id !== t.id))}
            className={`pointer-events-auto nf-in rounded-2xl px-4 py-3 text-[13.5px] leading-relaxed backdrop-blur-md shadow-[0_12px_40px_rgba(0,0,0,.55)] border ${t.kind === 'error' ? 'bg-[#2a1010]/92 border-[#a83232]/45 text-[#f6dede]' : 'bg-[#15161b]/92 border-white/12 text-[#efe6d2]'}`}>
            {t.msg}
          </div>
        ))}
      </div>
      {dlg && (
        <div className="fixed inset-0 z-[210] flex items-end sm:items-center justify-center bg-black/65 backdrop-blur-[2px] mn-fadein" onClick={() => close(false)}>
          <div onClick={(e) => e.stopPropagation()} className="mn-sheet w-full sm:w-[380px] rounded-t-3xl sm:rounded-3xl bg-[#121318] border border-white/10 px-5 pt-6" style={{ paddingBottom: 'max(20px, env(safe-area-inset-bottom))' }}>
            <p className="text-center font-serif text-[16.5px] leading-relaxed text-[#efe6d2] whitespace-pre-line">{dlg.msg}</p>
            <div className="mt-5 flex gap-2.5">
              <button onClick={() => close(false)} className="flex-1 h-12 rounded-2xl border border-white/12 text-[14px] text-parchment/70">{dlg.cancel || (en ? 'Cancel' : '取消')}</button>
              <button onClick={() => close(true)} className={`flex-1 h-12 rounded-2xl text-[14.5px] ${dlg.danger === false ? 'bg-[#c9a96e] text-[#14110b]' : 'bg-[#7d1d1d] border border-[#a83232]/60 text-[#f2ead9]'}`}>{dlg.ok || (en ? 'OK' : '确定')}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
