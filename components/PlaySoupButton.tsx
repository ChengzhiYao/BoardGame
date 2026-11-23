'use client';
// 题库页：和 AI 一起玩这道汤（按普通海龟汤计：每天 2 碗免费）
import { useState } from 'react';
import { ensureSession } from '@/lib/auth';

export default function PlaySoupButton({ id, en }: { id: string; en: boolean }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  async function go() {
    setBusy(true); setMsg('');
    try {
      await ensureSession();
      const r = await fetch('/api/soup/from-lib', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ libId: id }) });
      const d = await r.json().catch(() => ({}));
      if (d.url) { window.location.href = d.url; return; }
      if (d.reason === 'login' || r.status === 401) { const { signInWithGoogle } = await import('@/lib/auth'); await signInWithGoogle(window.location.pathname); return; }
      if (d.reason === 'light_pay') { setMsg(en ? 'Today’s free bowls are used up — get more on the pricing page.' : '今天的免费碗数用完了，可以去价格页加玩。'); return; }
      setMsg(d.error || 'error');
    } catch (e: any) { setMsg(e?.message || 'error'); } finally { setBusy(false); }
  }
  return (
    <div>
      <button onClick={go} disabled={busy} className="w-full sm:w-auto px-7 py-3.5 rounded-xl bg-[#7d1d1d] hover:bg-[#8e2323] border border-[#a83232]/60 text-[#f2ead9] font-serif tracking-[.15em] text-[16px] disabled:opacity-50">
        {busy ? (en ? 'Opening…' : '正在开局…') : (en ? 'Play it with the AI host' : '和 AI 一起玩这道汤')}
      </button>
      {msg && <p className="mt-2 text-[13px] text-[#e8b4b4]">{msg}{/pricing|价格/.test(msg) && <a href="/upgrade" className="ml-1 underline">→</a>}</p>}
    </div>
  );
}
