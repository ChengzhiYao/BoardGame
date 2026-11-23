'use client';
// 大厅：大家正在玩的局。点「申请加入」→ 房主同意后直接进房，顶替一个 AI 角色或坐进空位。
import { useEffect, useRef, useState } from 'react';
import { toast } from '@/components/Toast';

const MODE: Record<string, [string, string, string]> = {
  soup: ['海龟汤', 'Lateral Soup', '#3f9d88'],
  jbs: ['剧本杀', 'Murder Mystery', '#c9a96e'], botc: ['血染钟楼', 'Bloodbound', '#b8503f'], mcc: ['午夜猫诅咒', 'Cat Curse', '#a78bfa'], coc: ['克苏鲁跑团', 'Call of Cthulhu', '#b8503f'],
};

export default function OpenRooms({ en, onLogin }: { en: boolean; onLogin?: () => void }) {
  const [rooms, setRooms] = useState<any[] | null>(null);
  const [pick, setPick] = useState<any>(null);
  const [waiting, setWaiting] = useState<{ id: string; roomId: string; label: string } | null>(null);
  const timer = useRef<any>(null);
  const load = () => fetch('/api/rooms/open').then((r) => r.json()).then((d) => setRooms(d.rooms || [])).catch(() => setRooms([]));
  useEffect(() => { load(); const t = setInterval(() => { if (!document.hidden) load(); }, 30000); return () => clearInterval(t); }, []);

  // 等房主回应
  useEffect(() => {
    if (!waiting) return;
    const tick = async () => {
      const d = await fetch(`/api/rooms/request?id=${waiting.id}`).then((r) => r.json()).catch(() => ({}));
      if (d.status === 'approved') { window.location.href = `/room/${d.roomId || waiting.roomId}`; return; }
      if (d.status === 'declined') { toast(d.note || (en ? 'The host said not this time.' : '房主这次没同意，换一局试试')); setWaiting(null); load(); return; }
      if (d.status === 'expired' || d.status === 'none') { toast(en ? 'The host didn’t answer in time.' : '房主没来得及回应，换一局试试', 'info'); setWaiting(null); load(); return; }
      timer.current = setTimeout(tick, 2500);
    };
    timer.current = setTimeout(tick, 2000);
    return () => clearTimeout(timer.current);
  }, [waiting, en]);

  async function ask(room: any, slot: any) {
    setPick(null);
    const r = await fetch('/api/rooms/request', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ roomId: room.id, target: slot.key }) });
    const d = await r.json().catch(() => ({}));
    if (d.reason === 'login' || r.status === 401) { onLogin ? onLogin() : toast(en ? 'Sign in first' : '先登录'); return; }
    if (d.status === 'approved') { window.location.href = `/room/${d.roomId}`; return; }
    if (!r.ok) { toast(d.error || 'error'); load(); return; }
    setWaiting({ id: d.id, roomId: room.id, label: slot.key === 'seat' ? (en ? 'a seat' : '一个空位') : slot.label });
  }

  if (!rooms || !rooms.length) return null;
  return (
    <section className="w-full">
      <div className="flex items-center gap-3 mb-2.5">
        <span className="text-[11px] tracking-[.28em] text-parchment/45 shrink-0">{en ? 'PLAYING NOW · JOIN IN' : '大家正在玩 · 可以加入'}</span>
        <span className="flex-1 h-px bg-[#d8c7a8]/10" />
        <span className="flex items-center gap-1 text-[11px] text-[#8fd3b8]/80 shrink-0"><span className="w-1.5 h-1.5 rounded-full bg-[#8fd3b8] animate-pulse" />{rooms.length}</span>
      </div>
      <div className="flex gap-2.5 overflow-x-auto pb-1 -mx-1 px-1 snap-x [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {rooms.map((r) => {
          const m = MODE[r.mode] || MODE.jbs;
          const ai = r.slots.filter((s: any) => s.key !== 'seat').length;
          return (
            <div key={r.id} className="snap-start shrink-0 w-[255px] rounded-2xl border bg-[#0b0c0f]/75 backdrop-blur-md p-3.5 flex flex-col" style={{ borderColor: m[2] + '40' }}>
              <button onClick={() => { try { window.dispatchEvent(new CustomEvent('mn-profile', { detail: { id: r.host.id } })); } catch {} }} className="flex items-center gap-2.5 text-left">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {r.host.avatar ? <img src={r.host.avatar} alt="" className="w-9 h-9 rounded-full object-cover border border-white/10" /> : <span className="w-9 h-9 rounded-full bg-white/[0.06] flex items-center justify-center font-serif text-parchment/70">{String(r.host.name).slice(0, 1)}</span>}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px] text-[#ece3cf]">{r.host.name}</span>
                  <span className="block text-[11px]" style={{ color: m[2] }}>{en ? m[1] : m[0]} <span className="text-parchment/40">· {r.stage}</span></span>
                </span>
              </button>
              <div className="mt-2.5 text-[12px] text-parchment/55 leading-snug min-h-[34px]">
                {r.mode === 'soup' ? (en ? `${r.humans} ${r.humans > 1 ? 'people are' : 'person is'} guessing. Jump in and ask together.` : `${r.humans} 个人正在猜，进去一起问。`) : ai ? (en ? `${r.humans} ${r.humans > 1 ? 'people' : 'person'} + ${ai} AI. Take over an AI and play with them.` : `${r.humans} 个真人 + ${ai} 个 AI。顶替一个 AI，和 TA 们一起玩。`)
                  : (en ? `${r.humans} waiting for more players.` : `${r.humans} 个人在等人开局。`)}
              </div>
              {waiting?.roomId === r.id ? (
                <div className="mt-2.5 h-10 rounded-xl border border-[#8fd3b8]/30 bg-[#8fd3b8]/10 flex items-center justify-center gap-2 text-[12.5px] text-[#bfeadb]">
                  <span className="w-3.5 h-3.5 rounded-full border-2 border-[#8fd3b8]/30 border-t-[#8fd3b8] animate-spin" />{en ? 'Waiting for the host…' : '等房主同意…'}
                </div>
              ) : (
                <button onClick={() => (r.slots.length > 1 && ai ? setPick(r) : ask(r, r.slots[0]))} disabled={!!waiting}
                  className="mt-2.5 h-10 rounded-xl text-[13.5px] border disabled:opacity-40" style={{ borderColor: m[2] + '66', color: '#f2ead9', background: m[2] + '22' }}>
                  {en ? 'Ask to join' : '申请加入'}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {pick && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60" onClick={() => setPick(null)}>
          <div className="w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl bg-[#121318] border border-[#d8c7a8]/15 p-5 mn-sheet" style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }} onClick={(e) => e.stopPropagation()}>
            <div className="text-[10.5px] tracking-[.3em] text-[#c9a96e]/80">{en ? 'WHO DO YOU WANT TO PLAY?' : '你想接替谁？'}</div>
            <div className="mt-1 text-[12.5px] text-parchment/50">{en ? 'You take over their role, secrets and all. The host has to say yes.' : '你会拿到这个角色的身份和秘密，接着往下玩。房主同意后就进去。'}</div>
            <div className="mt-3 space-y-2 max-h-[50vh] overflow-y-auto">
              {pick.slots.map((s: any) => (
                <button key={s.key} onClick={() => ask(pick, s)} className="w-full flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] hover:border-[#c9a96e]/40 px-3.5 py-3 text-left">
                  <span className="w-8 h-8 rounded-full bg-white/[0.06] flex items-center justify-center text-[11px] text-parchment/60">AI</span>
                  <span className="flex-1 min-w-0"><span className="block truncate font-serif text-[15px] text-[#efe6d2]">{s.key === 'seat' ? (en ? 'An open seat' : '一个空位') : s.label}</span>{s.sub && <span className="block truncate text-[11.5px] text-parchment/45">{s.sub}</span>}</span>
                  <span className="text-[#c9a96e] text-[13px]">→</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
