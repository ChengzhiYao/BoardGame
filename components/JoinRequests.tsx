'use client';
// 房主在房间里：有人申请加入就弹一张卡，同意 / 拒绝；也可以关掉公开
import { useEffect, useRef, useState } from 'react';
import { toast } from '@/components/Toast';
import { useRouter } from 'next/navigation';

export default function JoinRequests({ roomId, en }: { roomId: string; en: boolean }) {
  const router = useRouter();
  const [reqs, setReqs] = useState<any[]>([]);
  const [listed, setListed] = useState(true);
  const [busy, setBusy] = useState('');
  const seen = useRef<Set<string>>(new Set());
  useEffect(() => {
    let stop = false;
    const tick = async () => {
      if (stop) return;
      if (!document.hidden) {
        const d = await fetch(`/api/rooms/requests?roomId=${roomId}`).then((r) => r.json()).catch(() => null);
        if (d && !stop) {
          setListed(d.listed !== false);
          const list = d.requests || [];
          if (list.some((r: any) => !seen.current.has(r.id))) { try { navigator.vibrate?.(60); } catch {} }
          list.forEach((r: any) => seen.current.add(r.id));
          setReqs(list);
        }
      }
      setTimeout(tick, 5000);
    };
    tick();
    return () => { stop = true; };
  }, [roomId]);
  async function decide(id: string, ok: boolean) {
    setBusy(id);
    const r = await fetch('/api/rooms/requests', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ roomId, id, ok }) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) toast(d.error || 'error');
    else if (ok) { toast(en ? 'They’re in.' : '已经让 TA 进来了', 'info'); router.refresh(); }
    setReqs((l) => l.filter((x) => x.id !== id)); setBusy('');
  }
  async function closeListing() {
    await fetch('/api/rooms/requests', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ roomId, listed: false }) });
    setListed(false); setReqs([]); toast(en ? 'This game is now private.' : '这局不再公开，别人看不到了', 'info');
  }
  if (!reqs.length || !listed) return null;
  const r = reqs[0];
  return (
    <div className="fixed inset-x-0 z-[60] flex justify-center px-3 pointer-events-none" style={{ top: 'calc(env(safe-area-inset-top) + 58px)' }}>
      <div className="pointer-events-auto w-full max-w-sm rounded-2xl border border-[#8fd3b8]/40 bg-[#0f1714]/95 backdrop-blur-xl p-3.5 shadow-[0_20px_60px_-15px_rgba(0,0,0,.9)] mn-sheet">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {r.avatar ? <img src={r.avatar} alt="" className="w-10 h-10 rounded-full object-cover" /> : <span className="w-10 h-10 rounded-full bg-white/[0.08] flex items-center justify-center font-serif text-parchment/80">{String(r.name).slice(0, 1)}</span>}
          <span className="flex-1 min-w-0">
            <span className="block text-[14px] text-[#e6f5ef] truncate">{en ? `${r.name} wants to join` : `${r.name} 想加入`}</span>
            <span className="block text-[12px] text-parchment/55 truncate">{!r.slot ? (en ? 'No seat left' : '已经没有位置了') : r.slot.key === 'seat' ? (en ? 'Takes an open seat' : '坐一个空位') : (en ? `Takes over AI “${r.slot.label}”` : `接替 AI「${r.slot.label}」`)}{reqs.length > 1 ? (en ? ` · +${reqs.length - 1} more` : ` · 还有 ${reqs.length - 1} 人`) : ''}</span>
          </span>
        </div>
        <div className="mt-3 flex gap-2">
          <button onClick={() => decide(r.id, true)} disabled={!!busy || !r.slot} className="flex-1 h-10 rounded-xl bg-[#2f6b5f] border border-[#8fd3b8]/45 text-[#f0faf6] text-[14px] disabled:opacity-50">{busy === r.id ? '…' : (en ? 'Let them in' : '同意')}</button>
          <button onClick={() => decide(r.id, false)} disabled={!!busy} className="h-10 px-4 rounded-xl border border-white/10 text-parchment/70 text-[13.5px]">{en ? 'No' : '拒绝'}</button>
        </div>
        <button onClick={closeListing} className="mt-2 w-full text-center text-[11.5px] text-parchment/40">{en ? 'Stop showing this game to others' : '这局不再公开'}</button>
      </div>
    </div>
  );
}
