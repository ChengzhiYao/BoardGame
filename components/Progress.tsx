'use client';
import { createPortal } from 'react-dom';
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


// 自绘图标(跟页面的暗金风格一致,不用系统 emoji)
function ChestIcon({ open, size = 30 }: { open?: boolean; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <defs>
        <linearGradient id="mnChestG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#f6dc98" /><stop offset="1" stopColor="#b88a3e" /></linearGradient>
        <linearGradient id="mnChestW" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#5a3b22" /><stop offset="1" stopColor="#3a2414" /></linearGradient>
      </defs>
      {open ? (
        <>
          <path d="M6 13 L9 6 H23 L26 13 Z" fill="url(#mnChestW)" stroke="url(#mnChestG)" strokeWidth="1.4" strokeLinejoin="round" />
          <path d="M16 4v3M10.5 3.5l1.2 2.4M21.5 3.5l-1.2 2.4" stroke="#f6dc98" strokeWidth="1.3" strokeLinecap="round" />
        </>
      ) : (
        <path d="M5 14 C5 8.5 9 6 16 6 C23 6 27 8.5 27 14 Z" fill="url(#mnChestW)" stroke="url(#mnChestG)" strokeWidth="1.4" />
      )}
      <rect x="5" y="14" width="22" height="13" rx="2.5" fill="url(#mnChestW)" stroke="url(#mnChestG)" strokeWidth="1.4" />
      <path d="M10 6.8V27M22 6.8V27" stroke="url(#mnChestG)" strokeWidth="1.4" opacity={open ? 0 : 1} />
      <path d="M10 14V27M22 14V27" stroke="url(#mnChestG)" strokeWidth="1.4" />
      <rect x="13.2" y="12" width="5.6" height="6.4" rx="1.4" fill="url(#mnChestG)" />
      <circle cx="16" cy="15.2" r="1" fill="#3a2414" />
    </svg>
  );
}

function TicketIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#e6c76e" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round">
      <path d="M3 8a2 2 0 0 0 2-2h14a2 2 0 0 0 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 0-2 2H5a2 2 0 0 0-2-2v-2a2 2 0 0 0 0-4z" />
      <path d="M9 7v10" strokeDasharray="1.5 2" />
      <path d="m14.5 9.8.8 1.6 1.8.3-1.3 1.2.3 1.8-1.6-.8-1.6.8.3-1.8-1.3-1.2 1.8-.3z" fill="#e6c76e" stroke="none" />
    </svg>
  );
}

const localDay = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

// 一格的奖励图标
function RewardIcon({ r, size = 22 }: { r: any; size?: number }) {
  if (!r) return null;
  if (r.kind === 'frame') return <span className="rounded-full p-[2.5px] block" style={{ width: size, height: size, background: r.css }}><span className="block w-full h-full rounded-full bg-[#14151a]" /></span>;
  if (r.kind === 'bg') return <span className="rounded-md block border border-white/25" style={{ width: size, height: size * 0.8, background: r.css }} />;
  if (r.kind === 'light' || r.kind === 'game') return <TicketIcon size={size} />;
  return r.big ? <ChestIcon size={size} /> : <span className="text-[9.5px] font-bold text-[#e6c76e] leading-none">+{r.xp}</span>;
}

function useCheckin() {
  const [d, setD] = useState<any>(null);
  useEffect(() => { fetch(`/api/checkin?day=${localDay()}`, { cache: 'no-store' }).then((r) => r.json()).then(setD).catch(() => setD(null)); }, []);
  return [d, setD] as const;
}

// 30 次一轮的签到日历:每 2 次小奖、每 5 次大奖
export function CheckinCard({ en, onDone, data, setData }: { en: boolean; onDone?: () => void; data?: any; setData?: (x: any) => void }) {
  const L = (zh: string, e: string) => (en ? e : zh);
  const own = useCheckin(); const d = data !== undefined ? data : own[0]; const setD = setData || own[1];
  const [busy, setBusy] = useState(false); const [pop, setPop] = useState<any>(null); const [tip, setTip] = useState<any>(null);
  if (!d?.ok || !d.loggedIn) return null;
  async function go() {
    setBusy(true);
    try {
      const r = await fetch('/api/checkin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ day: localDay() }) }).then((x) => x.json());
      if (r.ok) {
        setD({ ...d, ...r, checkedToday: true });
        if (r.got) { setPop(r.got); setTimeout(() => setPop(null), 3200); }
        toast(r.got ? L(`签到成功 · 获得${r.got.zh}`, `Checked in · ${r.got.en}`) : L(`签到成功 · +5 经验 · 连续 ${r.streak} 天`, `Checked in · +5 XP · ${r.streak}-day streak`), 'info');
        window.dispatchEvent(new Event('mn-checkin'));
        onDone?.();
      }
    } catch {}
    setBusy(false);
  }
  const map: Record<number, any> = {}; for (const nd of d.nodes || []) map[nd.n] = nd;
  const nb = d.nextBig;
  return (
    <div className="relative w-full overflow-hidden rounded-2xl border border-[#c9a96e]/25 px-4 py-4" style={{ background: 'linear-gradient(160deg, rgba(201,169,110,.14), rgba(14,15,20,.96) 45%)' }}>
      <style>{`@keyframes mnGlow{0%,100%{box-shadow:0 0 6px 1px rgba(230,199,110,.25)}50%{box-shadow:0 0 14px 4px rgba(230,199,110,.55)}}@keyframes mnPop{0%{transform:scale(.6);opacity:0}30%{transform:scale(1.12);opacity:1}100%{transform:scale(1);opacity:1}}`}</style>
      <div className="flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-serif text-[17px] text-[#f3e8cf]">{L('每日签到', 'Daily check-in')}</span>
            {d.streak > 0 && <span className="px-2 h-[20px] rounded-full bg-[#f0a35a]/15 text-[#f0a35a] text-[11.5px] flex items-center">🔥 {L(`连续 ${d.streak} 天`, `${d.streak}-day streak`)}</span>}
          </div>
          <div className="text-[12px] text-parchment/55 mt-0.5">{L(`第 ${d.round} 轮 · ${d.inRound} / ${d.roundLen} · 漏签不清零`, `Round ${d.round} · ${d.inRound} / ${d.roundLen} · missed days don't reset`)}</div>
        </div>
        <button onClick={go} disabled={busy || d.checkedToday} className="shrink-0 h-10 px-5 rounded-full text-[14px] font-semibold bg-gradient-to-b from-[#ecd08f] to-[#c9a96e] text-[#1a140a] shadow-[0_4px_16px_-4px_rgba(201,169,110,.6)] disabled:from-white/[0.06] disabled:to-white/[0.06] disabled:text-parchment/45 disabled:shadow-none active:scale-95 transition">
          {d.checkedToday ? L('✓ 已签到', '✓ Done') : busy ? '…' : L('签到', 'Check in')}
        </button>
      </div>

      {pop && (
        <div className="mt-3 rounded-xl border border-[#e6c76e]/50 bg-[#2a2010] px-3 py-2.5 flex items-center gap-3" style={{ animation: 'mnPop .6s ease-out' }}>
          <span className="w-9 h-9 flex items-center justify-center"><RewardIcon r={pop} size={28} /></span>
          <span className="text-[13px] text-[#f3e8cf]">{L('获得 ', 'Got ')}<b className="text-[#e6c76e]">{en ? pop.en : pop.zh}</b>{pop.kind === 'frame' || pop.kind === 'bg' ? L(' · 去「我的」换上', ' · equip it in Me') : ''}</span>
        </div>
      )}

      {/* 30 格日历:6 × 5,第 5/10/…/30 格是大奖(整列最右) */}
      <div className="mt-3.5 grid grid-cols-5 gap-1.5">
        {Array.from({ length: d.roundLen || 30 }).map((_, i) => {
          const n = i + 1; const nd = map[n]; const done = n <= d.inRound; const today = d.checkedToday ? n === d.inRound : n === d.inRound + 1;
          const big = nd?.big;
          return (
            <button key={n} type="button" onClick={() => setTip(nd ? { n, ...nd.reward } : null)}
              className={`relative h-[46px] rounded-lg border flex flex-col items-center justify-center gap-0.5 ${big ? (done ? 'bg-[#3a2a12] border-[#f3d995]/70' : 'bg-[#221a0e] border-[#e6c76e]/45') : done ? 'bg-[#c9a96e]/20 border-[#c9a96e]/40' : 'bg-white/[0.03] border-white/[0.07]'} ${today && !done ? 'ring-1 ring-[#e6c76e]' : ''}`}
              style={big && !done && n === nb?.n ? { animation: 'mnGlow 2.2s ease-in-out infinite' } : undefined}>
              <span className={`absolute top-0.5 left-1 text-[9px] ${done ? 'text-[#e6c76e]' : 'text-parchment/35'}`}>{n}</span>
              {nd ? <span className={done ? 'opacity-60' : ''}><RewardIcon r={{ ...nd.reward, big }} size={big ? 22 : 16} /></span> : <span className={`text-[12px] ${done ? 'text-[#c9a96e]' : 'text-parchment/15'}`}>{done ? '✓' : '·'}</span>}
              {done && nd && <span className="absolute bottom-0.5 right-1 text-[9px] text-[#c9a96e]">✓</span>}
            </button>
          );
        })}
      </div>
      <div className="mt-2 min-h-[18px] text-[11.5px]">
        {tip ? <span className="text-[#f3e8cf]">{L(`第 ${tip.n} 次:`, `#${tip.n}: `)}<b className="text-[#e6c76e]">{en ? tip.en : tip.zh}</b></span>
          : nb ? <span className="text-parchment/55">{L(`再签 ${nb.n - d.inRound} 次 → `, `${nb.n - d.inRound} more → `)}<b className="text-[#e6c76e]">{en ? nb.reward?.en : nb.reward?.zh}</b></span> : null}
      </div>
      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[10.5px] text-parchment/40">
        <span>{L('每 2 次小奖 · 每 5 次大奖', 'Small reward every 2 · big reward every 5')}</span>
        <span>{L('大奖:头像框 / 动态背景 / 免费局', 'Big: frames / backgrounds / free games')}</span>
      </div>
    </div>
  );
}

// 右上角的签到入口:没签时闪,点开弹出日历
export function CheckinButton({ en }: { en: boolean }) {
  const [d, setD] = useCheckin(); const [open, setOpen] = useState(false);
  if (!d?.ok || !d.loggedIn) return null;
  const todo = !d.checkedToday;
  return (
    <>
      <style>{`@keyframes mnPulse{0%{box-shadow:0 0 0 0 rgba(230,199,110,.7)}70%{box-shadow:0 0 0 10px rgba(230,199,110,0)}100%{box-shadow:0 0 0 0 rgba(230,199,110,0)}}@keyframes mnWig{0%,86%,100%{transform:rotate(0)}89%{transform:rotate(-12deg)}92%{transform:rotate(10deg)}95%{transform:rotate(-6deg)}}`}</style>
      <button onClick={() => setOpen(true)} aria-label={en ? 'Daily check-in' : '每日签到'}
        className={`relative h-8 pl-1.5 pr-2.5 rounded-full flex items-center gap-1 text-xs border ${todo ? 'border-[#e6c76e]/70 bg-[#e6c76e]/15 text-[#f3e8cf]' : 'border-white/10 bg-white/5 text-parchment/70'}`}
        style={todo ? { animation: 'mnPulse 1.8s ease-out infinite' } : undefined}>
        <span style={todo ? { animation: 'mnWig 2.4s ease-in-out infinite', display: 'inline-flex' } : { display: 'inline-flex' }}><ChestIcon size={20} open={!todo} /></span>
        <span className="hidden min-[380px]:inline">{todo ? (en ? 'Check in' : '签到') : `${d.inRound}/${d.roundLen}`}</span>
        {todo && <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-[#e04848] border border-ink" />}
      </button>
      {open && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[80] flex items-start sm:items-start justify-center sm:justify-end p-3 pt-[calc(env(safe-area-inset-top)+56px)]" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-black/55 backdrop-blur-[2px]" />
          <div className="relative w-full max-w-[400px] max-h-[calc(100svh-80px)] overflow-y-auto nf-in" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setOpen(false)} aria-label="close" className="absolute right-2 top-2 z-10 w-7 h-7 rounded-full bg-black/40 text-parchment/70 text-sm">✕</button>
            <CheckinCard en={en} data={d} setData={setD} />
          </div>
        </div>, document.body)}
    </>
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

export function BgPicker({ prog, en }: { prog: any; en: boolean }) {
  const L = (zh: string, e: string) => (en ? e : zh);
  const [cur, setCur] = useState<string>(() => { try { return localStorage.getItem('mn_bg') || prog?.bg || 'night'; } catch { return prog?.bg || 'night'; } });
  if (!prog?.bgs) return null;
  async function pick(id: string) {
    const r = await fetch('/api/me/bg', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ bg: id }) }).then((x) => x.json()).catch(() => null);
    if (r?.ok) { setCur(id); window.dispatchEvent(new CustomEvent('mn-bg', { detail: id })); toast(L('首页背景已换上', 'Background changed'), 'info'); }
  }
  return (
    <div className="mt-7">
      <div className="text-[11px] tracking-[.3em] text-[#c9a96e]/80 mb-2.5">{L('动态背景', 'BACKGROUNDS')}</div>
      <div className="grid grid-cols-3 gap-2.5">
        {prog.bgs.map((b: any) => (
          <button key={b.id} disabled={!b.unlocked} onClick={() => pick(b.id)} title={en ? b.den : b.dzh}
            className={`rounded-xl border p-1.5 flex flex-col items-center gap-1 ${cur === b.id ? 'border-[#e6c76e]/70 bg-[#e6c76e]/[0.06]' : 'border-white/10 bg-white/[0.02]'} ${b.unlocked ? '' : 'opacity-45'}`}>
            <span className="relative w-full h-14 rounded-lg overflow-hidden border border-white/10" style={{ background: b.swatch }}>
              <span className="absolute right-2 top-1.5 w-3 h-3 rounded-full bg-white/70" style={{ boxShadow: '0 0 8px rgba(255,255,255,.5)' }} />
              {!b.unlocked && <span className="absolute inset-0 flex items-center justify-center text-[15px]">🔒</span>}
              {cur === b.id && <span className="absolute left-1.5 bottom-1 text-[10px] text-[#e6c76e]">✓ {L('使用中', 'On')}</span>}
            </span>
            <span className="text-[12px] text-parchment/80">{en ? b.en : b.zh}</span>
            <span className="text-[10px] text-parchment/40 leading-tight text-center">{b.unlocked ? L('已解锁', 'Unlocked') : (en ? b.den : b.dzh)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// 首页问候下面的等级条:Lv + 称号 + 经验进度,点进「我的」看全部
export function LevelChip({ en }: { en: boolean }) {
  const [d, setD] = useState<any>(null);
  useEffect(() => { fetch(`/api/me/level?lang=${en ? 'en' : 'zh'}`, { cache: 'no-store' }).then((r) => r.json()).then(setD).catch(() => {}); }, [en]);
  if (!d?.ok) return null;
  const pct = Math.round((d.cur / Math.max(1, d.span)) * 100);
  return (
    <a href="/me" className="mt-3 inline-flex items-center gap-2.5 pl-1.5 pr-3 py-1.5 rounded-full border border-[#c9a96e]/30 bg-[#c9a96e]/[0.07] hover:bg-[#c9a96e]/[0.12]">
      <span className="h-6 min-w-[42px] px-2 rounded-full bg-gradient-to-b from-[#ecd08f] to-[#c9a96e] text-[#1a140a] text-[12px] font-bold flex items-center justify-center">Lv.{d.level}</span>
      <span className="text-[13px] text-[#f3e8cf]">{d.title}</span>
      <span className="w-16 h-1.5 rounded-full bg-white/[0.08] overflow-hidden"><span className="block h-full rounded-full bg-[#e6c76e]" style={{ width: pct + '%' }} /></span>
      <span className="text-[11px] text-parchment/45">{en ? 'Me ›' : '我的 ›'}</span>
    </a>
  );
}
