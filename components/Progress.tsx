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
  const [d, setD] = useState<any>(null); const [busy, setBusy] = useState(false); const [pop, setPop] = useState(false);
  useEffect(() => { fetch(`/api/checkin?day=${localDay()}`, { cache: 'no-store' }).then((r) => r.json()).then(setD).catch(() => setD(null)); }, []);
  if (!d?.ok || !d.loggedIn) return null;
  async function go() {
    setBusy(true);
    try {
      const r = await fetch('/api/checkin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ day: localDay() }) }).then((x) => x.json());
      if (r.ok) {
        setD({ ...d, ...r, checkedToday: true });
        if (r.reward) { setPop(true); setTimeout(() => setPop(false), 2600); }
        toast(r.reward ? L(`打卡成功!送你 ${r.reward} 次免费豪华局(跑团/剧本杀/血染都能用)`, `Checked in! ${r.reward} free premium game added`) : L(`打卡成功 · 连续 ${r.streak} 天`, `Checked in · ${r.streak}-day streak`), 'info');
        onDone?.();
      }
    } catch {}
    setBusy(false);
  }
  const every = d.every || 5;
  const inCycle = d.total % every === 0 && d.total > 0 && d.checkedToday ? every : d.total % every; // 刚好打满这一轮时显示满格
  // 头像框里程碑(打卡相关的)
  const miles = [
    { f: FRAMES.find((x) => x.id === 'mist')!, have: d.total, need: 7, how: L('累计打卡', 'Total check-ins') },
    { f: FRAMES.find((x) => x.id === 'eclipse')!, have: Math.max(d.best || 0, d.streak || 0), need: 30, how: L('连续打卡', 'Streak') },
  ];
  return (
    <div className="relative w-full overflow-hidden rounded-2xl border border-[#c9a96e]/25 px-4 sm:px-5 py-4" style={{ background: 'linear-gradient(100deg, rgba(201,169,110,.15), rgba(201,169,110,.04) 55%, rgba(11,12,15,.75))' }}>
      <style>{`@keyframes mnGlow{0%,100%{box-shadow:0 0 0 0 rgba(230,199,110,.0),0 0 14px 2px rgba(230,199,110,.35)}50%{box-shadow:0 0 0 4px rgba(230,199,110,.12),0 0 22px 6px rgba(230,199,110,.55)}}@keyframes mnPop{0%{transform:scale(.6);opacity:0}30%{transform:scale(1.15);opacity:1}100%{transform:scale(1);opacity:1}}`}</style>
      <div className="flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-serif text-[17px] text-[#f3e8cf]">{L('每日打卡', 'Daily check-in')}</span>
            {d.streak > 0 && <span className="px-2 h-[20px] rounded-full bg-[#f0a35a]/15 text-[#f0a35a] text-[11.5px] flex items-center">🔥 {L(`连续 ${d.streak} 天`, `${d.streak}-day streak`)}</span>}
          </div>
          <div className="text-[12px] text-parchment/55 mt-0.5">{L(`累计 ${d.total} 天 · 每打满 ${every} 次送 1 次免费跑团 / 剧本杀`, `${d.total} days total · every ${every} check-ins = 1 free premium game`)}</div>
        </div>
        <button onClick={go} disabled={busy || d.checkedToday} className="shrink-0 h-10 px-5 rounded-full text-[14px] font-semibold bg-gradient-to-b from-[#ecd08f] to-[#c9a96e] text-[#1a140a] shadow-[0_4px_16px_-4px_rgba(201,169,110,.6)] disabled:from-white/[0.06] disabled:to-white/[0.06] disabled:text-parchment/45 disabled:shadow-none active:scale-95 transition">
          {d.checkedToday ? L('✓ 已打卡', '✓ Done') : busy ? '…' : L('打卡', 'Check in')}
        </button>
      </div>

      {/* 这一轮的进度:前 4 格是小圆点,第 5 格是奖励 */}
      <div className="mt-4 flex items-center max-w-[420px]">
        {Array.from({ length: every }).map((_, i) => {
          const n = i + 1; const done = n <= inCycle; const last = n === every;
          return (
            <div key={n} className={`flex items-center ${last ? '' : 'flex-1'}`}>
              {last ? (
                <div className="flex flex-col items-center">
                  <span className={`w-12 h-12 rounded-2xl flex items-center justify-center text-[22px] border ${done ? 'bg-gradient-to-b from-[#f3d995] to-[#c9a96e] border-[#f3d995]' : 'bg-[#2a2216] border-[#e6c76e]/60'}`}
                    style={{ animation: pop ? 'mnPop .6s ease-out' : done ? undefined : 'mnGlow 2.2s ease-in-out infinite' }}>🎁</span>
                </div>
              ) : (
                <span className={`w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-semibold border ${done ? 'bg-[#c9a96e] border-[#c9a96e] text-[#1a140a]' : 'bg-white/[0.04] border-white/10 text-parchment/40'}`}>{done ? '✓' : n}</span>
              )}
              {!last && <span className={`flex-1 h-[3px] mx-1 rounded-full ${n < inCycle ? 'bg-[#c9a96e]' : 'bg-white/[0.08]'}`} />}
            </div>
          );
        })}
      </div>
      <div className="mt-1.5 max-w-[420px] flex justify-between text-[11px]">
        <span className="text-parchment/45">{L(`本轮 ${inCycle} / ${every}`, `This round ${inCycle} / ${every}`)}</span>
        <span className="text-[#e6c76e] font-medium">{inCycle >= every ? L('免费跑团已到账!', 'Free game added!') : L(`再打 ${every - inCycle} 次 → 免费跑团 1 次`, `${every - inCycle} more → 1 free premium game`)}</span>
      </div>

      {/* 头像框里程碑 */}
      <div className="mt-4 pt-3 border-t border-white/[0.07] grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {miles.map(({ f, have, need, how }) => { const ok = have >= need; const pct = Math.min(100, Math.round((have / need) * 100)); return (
          <div key={f.id} className="flex items-center gap-3 rounded-xl bg-black/20 px-3 py-2.5">
            <span className="w-10 h-10 rounded-full p-[3px] shrink-0" style={{ background: f.css }}><span className="block w-full h-full rounded-full bg-[#14151a] flex items-center justify-center text-[11px] text-parchment/60">{ok ? '✓' : ''}</span></span>
            <div className="flex-1 min-w-0">
              <div className="text-[12.5px] text-[#f3e8cf]">{L('专属头像框', 'Avatar frame')}「{en ? f.en : f.zh}」</div>
              <div className="mt-1 h-1.5 rounded-full bg-white/[0.07] overflow-hidden"><div className="h-full rounded-full bg-[#c9a96e]" style={{ width: pct + '%' }} /></div>
              <div className="mt-0.5 text-[10.5px] text-parchment/45">{ok ? L('已解锁 · 去「我的」戴上', 'Unlocked · wear it in Me') : `${how} ${have} / ${need}`}</div>
            </div>
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
