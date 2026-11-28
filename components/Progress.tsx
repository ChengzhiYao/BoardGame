'use client';
// 成长相关的界面:带头像框的头像、等级条、每日打卡卡片、头像框选择
import { useEffect, useState } from 'react';
import { toast } from '@/components/Toast';
import { FRAMES } from '@/lib/progress';

const css = (id?: string | null) => FRAMES.find((f) => f.id === id)?.css || null;

export function FrameAvatar({ url, name, frame, size = 32 }: { url?: string | null; name: string; frame?: string | null; size?: number }) {
  const ring = css(frame); const pad = ring ? Math.max(2, Math.round(size / 14)) : 0;
  return (
    <span className="relative inline-flex shrink-0 rounded-full" style={{ width: size, height: size, padding: pad, background: ring || undefined }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {url ? <img src={url} alt="" className="w-full h-full rounded-full object-cover bg-[#1c1d23]" />
        : <span className="w-full h-full rounded-full bg-[#2a2530] flex items-center justify-center text-parchment/80" style={{ fontSize: Math.round(size * 0.38) }}>{(name || '?').slice(0, 1).toUpperCase()}</span>}
    </span>
  );
}

export function LvTag({ lv }: { lv?: number | null }) {
  if (!lv || lv < 2) return null;
  return <span className="ml-1 inline-flex items-center px-1.5 h-[15px] rounded-[5px] text-[9.5px] font-semibold tracking-wide bg-[#c9a96e]/15 text-[#e6c76e] align-middle">Lv{lv}</span>;
}

export function LevelBar({ prog, en }: { prog: any; en: boolean }) {
  if (!prog) return null;
  const pct = Math.round((prog.cur / Math.max(1, prog.span)) * 100);
  return (
    <div className="w-full mt-4">
      <div className="flex items-baseline justify-between text-[12px]">
        <span className="text-[#e6c76e] font-medium">Lv.{prog.level} · {prog.title}</span>
        <span className="text-parchment/45">{en ? `${prog.cur} / ${prog.span} XP to Lv.${prog.level + 1}` : `再得 ${prog.span - prog.cur} 经验升到 ${prog.level + 1} 级`}</span>
      </div>
      <div className="mt-1.5 h-2 rounded-full bg-white/[0.06] overflow-hidden"><div className="h-full rounded-full" style={{ width: pct + '%', background: 'linear-gradient(90deg,#a8873f,#e6c76e)' }} /></div>
    </div>
  );
}

const localDay = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

export function CheckinCard({ en, onDone }: { en: boolean; onDone?: () => void }) {
  const L = (zh: string, e: string) => (en ? e : zh);
  const [d, setD] = useState<any>(null); const [busy, setBusy] = useState(false);
  useEffect(() => { fetch(`/api/checkin?day=${localDay()}`, { cache: 'no-store' }).then((r) => r.json()).then(setD).catch(() => setD(null)); }, []);
  if (!d?.ok || !d.loggedIn) return null;
  async function go() {
    setBusy(true);
    try {
      const r = await fetch('/api/checkin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ day: localDay() }) }).then((x) => x.json());
      if (r.ok) {
        setD({ ...d, ...r, checkedToday: true });
        toast(r.reward ? L(`打卡成功!累计 ${r.total} 天,送你 ${r.reward} 次免费豪华局(跑团/剧本杀/血染都能用)`, `Checked in! ${r.total} days total — ${r.reward} free premium game added`) : L(`打卡成功 · 连续 ${r.streak} 天 · 再打 ${r.toNext} 次送 1 次免费跑团`, `Checked in · ${r.streak}-day streak · ${r.toNext} more for a free premium game`), 'info');
        onDone?.();
      }
    } catch {}
    setBusy(false);
  }
  const wd = en ? ['S', 'M', 'T', 'W', 'T', 'F', 'S'] : ['日', '一', '二', '三', '四', '五', '六'];
  return (
    <div className="w-full rounded-2xl border border-[#c9a96e]/25 px-4 py-3.5" style={{ background: 'linear-gradient(100deg, rgba(201,169,110,.14), rgba(201,169,110,.03) 60%, rgba(11,12,15,.7))' }}>
      <div className="flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <div className="font-serif text-[16px] text-[#f3e8cf]">{L('每日打卡', 'Daily check-in')}{d.streak > 1 && <span className="ml-2 text-[12px] text-[#f0a35a]">{L(`连续 ${d.streak} 天`, `${d.streak}-day streak`)}</span>}</div>
          <div className="text-[12px] text-parchment/55 mt-0.5">{d.toNext === d.every && d.checkedToday ? L('刚拿到一次免费豪华局 · 再打 5 次再送', 'Free premium game earned · 5 more for the next') : L(`再打 ${d.toNext} 次,送 1 次免费跑团 / 剧本杀`, `${d.toNext} more check-ins for a free premium game`)}</div>
        </div>
        <button onClick={go} disabled={busy || d.checkedToday} className="shrink-0 h-9 px-4 rounded-full text-[13px] font-medium bg-[#c9a96e] text-[#1a140a] disabled:bg-white/[0.06] disabled:text-parchment/45">
          {d.checkedToday ? L('今天已打卡', 'Done today') : busy ? '…' : L('打卡', 'Check in')}
        </button>
      </div>
      <div className="mt-3 flex justify-between">
        {d.week.map((w: any) => { const dt = new Date(w.day + 'T12:00:00'); return (
          <div key={w.day} className="flex flex-col items-center gap-1">
            <span className={`w-7 h-7 rounded-full flex items-center justify-center text-[12px] ${w.done ? 'bg-[#c9a96e] text-[#1a140a]' : 'bg-white/[0.05] text-parchment/35'}`}>{w.done ? '✓' : dt.getDate()}</span>
            <span className="text-[10px] text-parchment/35">{wd[dt.getDay()]}</span>
          </div>
        ); })}
      </div>
    </div>
  );
}

export function FramePicker({ prog, en, onChange }: { prog: any; en: boolean; onChange?: (id: string | null) => void }) {
  const L = (zh: string, e: string) => (en ? e : zh);
  const [cur, setCur] = useState<string | null>(prog?.frame || null);
  if (!prog?.frames) return null;
  async function pick(id: string | null) {
    const r = await fetch('/api/me/frame', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ frame: id }) }).then((x) => x.json()).catch(() => null);
    if (r?.ok) { setCur(id); onChange?.(id); toast(id ? L('头像框已戴上', 'Frame on') : L('已摘下头像框', 'Frame off'), 'info'); }
  }
  return (
    <div className="mt-7">
      <div className="text-[11px] tracking-[.3em] text-[#c9a96e]/80 mb-2.5">{L('头像框', 'AVATAR FRAMES')}</div>
      <div className="grid grid-cols-3 gap-2.5">
        <button onClick={() => pick(null)} className={`rounded-xl border px-2 py-3 flex flex-col items-center gap-1.5 ${!cur ? 'border-[#e6c76e]/60 bg-[#e6c76e]/[0.06]' : 'border-white/10 bg-white/[0.02]'}`}>
          <span className="w-11 h-11 rounded-full bg-white/[0.06]" />
          <span className="text-[12px] text-parchment/70">{L('不戴', 'None')}</span>
        </button>
        {prog.frames.map((f: any) => (
          <button key={f.id} disabled={!f.unlocked} onClick={() => pick(f.id)} title={en ? f.den : f.dzh}
            className={`rounded-xl border px-2 py-3 flex flex-col items-center gap-1.5 ${cur === f.id ? 'border-[#e6c76e]/60 bg-[#e6c76e]/[0.06]' : 'border-white/10 bg-white/[0.02]'} ${f.unlocked ? '' : 'opacity-45'}`}>
            <span className="w-11 h-11 rounded-full p-[3px]" style={{ background: f.css }}><span className="block w-full h-full rounded-full bg-[#14151a]" /></span>
            <span className="text-[12px] text-parchment/80">{en ? f.en : f.zh}</span>
            <span className="text-[10px] text-parchment/40 leading-tight text-center">{f.unlocked ? L('已解锁', 'Unlocked') : (en ? f.den : f.dzh)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
