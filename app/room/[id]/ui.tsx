'use client';
// 房间里共用的小部件：底部抽屉（电脑上是右侧抽屉）
import { useEffect } from 'react';
import type { ReactNode } from 'react';

export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[70]" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px] mn-fadein" />
      <div onClick={(e) => e.stopPropagation()}
        className="mn-sheet absolute inset-x-0 bottom-0 max-h-[84svh] rounded-t-3xl lg:inset-x-auto lg:right-0 lg:top-0 lg:bottom-0 lg:max-h-none lg:w-[400px] lg:rounded-none lg:rounded-l-3xl bg-[#111216] border-t lg:border-t-0 lg:border-l border-white/10 flex flex-col">
        <div className="shrink-0 pt-2.5 lg:pt-5 px-5">
          <div className="mx-auto w-10 h-1 rounded-full bg-white/15 lg:hidden" />
          <div className="mt-3 lg:mt-0 flex items-center justify-between">
            <h2 className="font-serif text-[18px] text-[#efe6d2] tracking-[.06em]">{title}</h2>
            <button onClick={onClose} className="w-9 h-9 -mr-2 rounded-full text-parchment/50 hover:text-parchment flex items-center justify-center">✕</button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-5 pt-3" style={{ paddingBottom: 'max(24px, env(safe-area-inset-bottom))' }}>{children}</div>
      </div>
    </div>
  );
}
export function SheetLabel({ children }: { children: ReactNode }) { return <div className="text-[11px] tracking-[.24em] text-[#c9a96e]/75 mb-2.5">{children}</div>; }
export function Field({ k, v }: { k: string; v?: string }) {
  if (!v) return null;
  return <div><div className="text-[11px] tracking-[.2em] text-[#c9a96e]/80 mb-1">{k}</div><div className="text-[#efe6d2]/90 leading-relaxed">{v}</div></div>;
}

