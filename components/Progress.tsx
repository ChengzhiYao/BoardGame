'use client';
import { BG3D } from '@/lib/bg3d';
import { createPortal } from 'react-dom';
// 成长相关的界面:带头像框的头像、等级条、每日打卡卡片、头像框选择
import { useEffect, useState } from 'react';
import { toast } from '@/components/Toast';
import { FRAMES } from '@/lib/progress';

const css = (id?: string | null) => FRAMES.find((f) => f.id === id)?.css || null;

export function FrameAvatar({ url, name, frame, size = 32 }: { url?: string | null; name: string; frame?: string | null; size?: number }) {
  const ring = css(frame); const pad = ring ? Math.max(2.5, Math.round(size / 10)) : 0;
  return (
    <span className="relative inline-flex shrink-0 rounded-full" style={{ width: size, height: size, padding: pad, background: ring || undefined, boxShadow: ring ? '0 0 0 1px rgba(0,0,0,.55), 0 0 10px 1px rgba(230,199,110,.28)' : undefined }}>
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

// 谜夜风的小台历:黑底金边,一弯月 + 衬线日期
function MoonDate({ size = 56 }: { size?: number }) {
  const now = new Date(); const en = typeof document !== 'undefined' && document.documentElement.lang?.startsWith('en');
  return (
    <span className="relative flex flex-col items-center justify-center rounded-[10px] border border-[#c9a96e]/55 bg-[#121318]" style={{ width: size, height: size * 1.08, boxShadow: 'inset 0 0 0 3px #121318, inset 0 0 0 4px rgba(201,169,110,.25)' }}>
      <svg width={size * 0.3} height={size * 0.22} viewBox="0 0 20 14" className="mt-0.5"><path d="M13 1.2a6 6 0 1 0 4.6 9.9A6.6 6.6 0 0 1 13 1.2z" fill="#e6c76e" /></svg>
      <span className="font-serif font-semibold leading-none text-[#efe6d2]" style={{ fontSize: size * 0.38 }}>{now.getDate()}</span>
      <span className="font-serif leading-none text-[#c9a96e]/75 mt-0.5" style={{ fontSize: Math.max(8, size * 0.16), letterSpacing: '.12em' }}>{en ? now.toLocaleString('en', { month: 'short' }).toUpperCase() : `${now.getMonth() + 1}月`}</span>
    </span>
  );
}
// 已签:暗红火漆印,中间一弯金月
function WaxSeal({ size = 34 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40">
      <defs><radialGradient id="mnwax" cx="38%" cy="32%" r="70%"><stop offset="0" stopColor="#b3343a" /><stop offset=".6" stopColor="#7a1a20" /><stop offset="1" stopColor="#4a0d12" /></radialGradient></defs>
      <path d="M20 2.5c3 0 3.6 2 6.2 2.6s4.6-.6 6.2 1.6.2 4.2 1.4 6.6 3.4 3 3.4 6.7-2.2 4.3-3.4 6.7.2 4.4-1.4 6.6-3.6 1-6.2 1.6S23 37.5 20 37.5s-3.6-2-6.2-2.6-4.6.6-6.2-1.6-.2-4.2-1.4-6.6S2.8 23.7 2.8 20s2.2-4.3 3.4-6.7-.2-4.4 1.4-6.6 3.6-1 6.2-1.6S17 2.5 20 2.5z" fill="url(#mnwax)" />
      <circle cx="20" cy="20" r="11" fill="none" stroke="#2e080b" strokeOpacity=".55" strokeWidth="1.2" />
      <path d="M22.5 13.5a7 7 0 1 0 4.8 11.6 7.6 7.6 0 0 1-4.8-11.6z" fill="#e6c76e" opacity=".9" />
    </svg>
  );
}
// 经验:金币
function CoinIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24"><circle cx="12" cy="12" r="9.5" fill="none" stroke="#c9a96e" strokeWidth="1.3" /><circle cx="12" cy="12" r="7" fill="#c9a96e" fillOpacity=".14" />
      <text x="12" y="15.2" textAnchor="middle" fontSize="7.5" fontWeight="700" fill="#e6c76e" fontFamily="Georgia,serif">XP</text></svg>
  );
}
// 一格的奖励:图标 + 一行字
function Reward({ r, big }: { r: any; big?: boolean }) {
  const sz = big ? 26 : 18;
  let icon: any, txt: string;
  if (!r) { icon = <CoinIcon size={sz} />; txt = '+5'; }
  else if (r.kind === 'frame') { icon = <span className="rounded-full p-[3px] block" style={{ width: sz, height: sz, background: r.css }}><span className="block w-full h-full rounded-full bg-[#14151a]" /></span>; txt = r.short; }
  else if (r.kind === 'bg') { icon = <span className="rounded-[5px] block border border-white/30" style={{ width: big ? 40 : sz * 1.4, height: big ? 26 : sz, background: r.css }} />; txt = r.short; }
  else if (r.kind === 'light' || r.kind === 'game') { icon = <TicketIcon size={sz} />; txt = r.short; }
  else { icon = r.big ? <ChestIcon size={sz} /> : <CoinIcon size={sz} />; txt = `+${r.xp}`; }
  return (
    <span className="flex flex-col items-center gap-0.5">
      <span className="h-[26px] flex items-center justify-center">{icon}</span>
      <span className={`leading-none whitespace-nowrap ${big ? 'text-[10px] text-[#f3d995] font-semibold' : 'text-[10px] text-parchment/60'}`}>{txt}</span>
    </span>
  );
}

function useCheckin() {
  const [d, setD] = useState<any>(null);
  useEffect(() => { fetch(`/api/checkin?day=${localDay()}`, { cache: 'no-store' }).then((r) => r.json()).then(setD).catch(() => setD(null)); }, []);
  return [d, setD] as const;
}

// 签到板:30 格,每格「第 N 天」+ 奖励,签过的盖「已签」章;每 5 格是大奖
export function CheckinCard({ en, onDone, data, setData }: { en: boolean; onDone?: () => void; data?: any; setData?: (x: any) => void }) {
  const L = (zh: string, e: string) => (en ? e : zh);
  const own = useCheckin(); const d = data !== undefined ? data : own[0]; const setD = setData || own[1];
  const [busy, setBusy] = useState(false); const [pop, setPop] = useState<any>(null);
  if (!d?.ok || !d.loggedIn) return null;
  async function go() {
    setBusy(true);
    try {
      const r = await fetch('/api/checkin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ day: localDay() }) }).then((x) => x.json());
      if (r.ok) {
        setD({ ...d, ...r, checkedToday: true });
        setPop(r.got || { kind: 'xp', xp: 5, zh: '经验 +5', en: '+5 XP' }); setTimeout(() => setPop(null), 3500);
        window.dispatchEvent(new Event('mn-checkin'));
        onDone?.();
      }
    } catch {}
    setBusy(false);
  }
  const map: Record<number, any> = {}; for (const nd of d.nodes || []) map[nd.n] = nd;
  const short = (r: any) => !r ? null : { ...r, short: r.kind === 'frame' ? L('头像框', 'Frame') : r.kind === 'bg' ? (en ? 'Backdrop' : (r.name || '背景')) : r.kind === 'light' ? L(`海龟汤×${r.count}`, `Soup×${r.count}`) : r.kind === 'game' ? L('豪华局', 'Premium') : '' };
  const todayN = d.checkedToday ? d.inRound : d.inRound + 1;
  const nb = d.nextBig; const now = new Date();
  return (
    <div className="relative w-full overflow-hidden rounded-2xl border border-[#c9a96e]/25 bg-[#0e0f13] shadow-[0_30px_80px_-20px_rgba(0,0,0,.9)]" style={{ backgroundImage: 'radial-gradient(120% 60% at 50% 0%, rgba(201,169,110,.10), transparent 60%)' }}>
      <style>{`@keyframes mnStamp{0%{transform:scale(2.2) rotate(-20deg);opacity:0}60%{transform:scale(.9) rotate(-14deg);opacity:1}100%{transform:scale(1) rotate(-14deg);opacity:1}}@keyframes mnGlow{0%,100%{box-shadow:0 0 0 1px rgba(230,199,110,.5),0 0 8px 1px rgba(230,199,110,.25)}50%{box-shadow:0 0 0 1px rgba(230,199,110,.9),0 0 16px 4px rgba(230,199,110,.5)}}`}</style>
      {/* 抬头:像台历的红头 */}
      <div className="px-4 pt-4 pb-3.5 flex items-center gap-3 border-b border-[#c9a96e]/15">
        <MoonDate size={48} />
        <div className="flex-1 min-w-0">
          <div className="font-serif text-[18px] tracking-wide text-[#efe6d2]">{L('夜签', 'Nightly sign-in')}</div>
          <div className="text-[11.5px] text-parchment/50">{L(`本轮已签 ${d.inRound} / ${d.roundLen} 夜`, `${d.inRound} / ${d.roundLen} nights this round`)}{d.streak > 1 ? L(` · 连续 ${d.streak} 夜`, ` · ${d.streak}-day streak`) : ''}</div>
        </div>
        <button onClick={go} disabled={busy || d.checkedToday} className="shrink-0 h-10 px-5 rounded-full text-[14px] font-semibold bg-gradient-to-b from-[#ecd08f] to-[#c9a96e] text-[#1a140a] shadow-[0_4px_16px_-4px_rgba(201,169,110,.6)] disabled:from-transparent disabled:to-transparent disabled:border disabled:border-[#c9a96e]/30 disabled:text-[#c9a96e]/70 disabled:shadow-none active:scale-95 transition">
          {d.checkedToday ? L('今夜已签', 'Signed') : busy ? '…' : L('落印', 'Sign')}
        </button>
      </div>

      <div className="px-3 pt-3 pb-3.5">
        {pop && (
          <div className="mb-2.5 rounded-lg border border-[#c9a96e]/40 bg-[#1a1610] px-3 py-2 text-[13px] text-[#f3e8cf] text-center">
            {L('已落印 · 获得 ', 'Signed · got ')}<b className="text-[#e6c76e]">{en ? pop.en : pop.zh}</b>{pop.kind === 'frame' || pop.kind === 'bg' ? L(' · 去「我的」换上', ' · equip it in Me') : ''}
          </div>
        )}
        <div className="grid grid-cols-5 gap-1.5">
          {Array.from({ length: d.roundLen || 30 }).map((_, i) => {
            const n = i + 1; const nd = map[n]; const big = !!nd?.big; const done = n <= d.inRound; const isToday = n === todayN;
            return (
              <div key={n} title={nd?.reward ? (en ? nd.reward.en : nd.reward.zh) : L('经验 +5', '+5 XP')}
                className={`relative rounded-[6px] border pt-1 pb-1.5 flex flex-col items-center gap-0.5 overflow-hidden ${big ? 'bg-[#1a1610] border-[#c9a96e]/50 shadow-[inset_0_0_0_3px_#1a1610,inset_0_0_0_4px_rgba(201,169,110,.22)]' : 'bg-[#15161b] border-white/[0.06]'} ${isToday && !done ? 'border-[#e6c76e]' : ''}`}
                style={isToday && !done ? { animation: 'mnGlow 1.8s ease-in-out infinite' } : undefined}>
                <span className={`font-serif text-[9.5px] leading-none ${isToday ? 'text-[#e6c76e]' : big ? 'text-[#c9a96e]/80' : 'text-parchment/35'}`}>{isToday ? L('今夜', 'Tonight') : L(`第${n}夜`, `Night ${n}`)}</span>
                <span className={done ? 'opacity-25' : ''}><Reward r={short(nd?.reward)} big={big} /></span>
                {done && (
                  <span className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <span style={{ animation: n === d.inRound && pop ? 'mnStamp .5s ease-out' : undefined, transform: 'rotate(-14deg)', display: 'inline-flex' }}><WaxSeal size={34} /></span>
                  </span>
                )}
              </div>
            );
          })}
        </div>
        <div className="mt-2.5 text-[11.5px] text-parchment/55 text-center">
          {nb ? <>{L(`再签 ${nb.n - d.inRound} 夜可得:`, `${nb.n - d.inRound} more nights: `)}<b className="text-[#e6c76e]">{en ? nb.reward?.en : nb.reward?.zh}</b></> : L('本轮大奖已全部领取', 'All big rewards claimed this round')}
        </div>
        <div className="mt-1 text-[10.5px] text-parchment/35 text-center">{L('金框是大奖 · 漏签不清零 · 签满 30 夜开下一轮', 'Gold frame = big reward · missed nights don’t reset · new round after 30')}</div>
      </div>
    </div>
  );
}

// 问候右边的签到入口:一页小台历(月份 + 今天日期),没签时会跳、带红点,点开是签到板
export function CheckinButton({ en }: { en: boolean }) {
  const [d, setD] = useCheckin(); const [open, setOpen] = useState(false);
  if (!d?.ok || !d.loggedIn) return null;
  const todo = !d.checkedToday; const now = new Date();
  return (
    <>
      <style>{`@keyframes mnPulse{0%{box-shadow:0 0 0 0 rgba(230,199,110,.65)}70%{box-shadow:0 0 0 12px rgba(230,199,110,0)}100%{box-shadow:0 0 0 0 rgba(230,199,110,0)}}@keyframes mnBob{0%,100%{transform:translateY(0)}50%{transform:translateY(-3px)}}`}</style>
      <button onClick={() => setOpen(true)} aria-label={en ? 'Daily check-in' : '每日签到'} className="relative flex flex-col items-center gap-1" style={todo ? { animation: 'mnBob 1.6s ease-in-out infinite' } : undefined}>
        <span className="relative" style={todo ? { animation: 'mnPulse 2s ease-out infinite', borderRadius: 12 } : { opacity: 0.8 }}>
          <MoonDate size={56} />
          {!todo && <span className="absolute -right-2 -bottom-2" style={{ transform: 'rotate(-14deg)' }}><WaxSeal size={26} /></span>}
        </span>
        <span className={`text-[11.5px] ${todo ? 'text-[#e6c76e] font-semibold' : 'text-parchment/55'}`}>{todo ? (en ? 'Sign in' : '夜签') : `${d.inRound}/${d.roundLen}`}</span>
        {todo && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-[#c9a96e] shadow-[0_0_8px_2px_rgba(230,199,110,.7)]" />}
      </button>
      {open && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-black/65 backdrop-blur-[2px]" />
          <div className="relative w-full sm:max-w-[420px] max-h-[92svh] overflow-y-auto p-3 pb-[calc(env(safe-area-inset-bottom)+12px)] nf-in" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setOpen(false)} aria-label="close" className="absolute right-5 top-5 z-10 w-7 h-7 rounded-full bg-black/40 text-[#f8eedb]/80 text-sm">✕</button>
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
        {/* 只列首页真的会换的:默认场景 + 已做好 3D 场景的背景 */}
        {prog.bgs.filter((b: any) => b.id === 'night' || BG3D[b.id]).map((b: any) => (
          <button key={b.id} disabled={!b.unlocked} onClick={() => pick(b.id)} title={en ? b.den : b.dzh}
            className={`rounded-xl border p-1.5 flex flex-col items-center gap-1 ${cur === b.id ? 'border-[#e6c76e]/70 bg-[#e6c76e]/[0.06]' : 'border-white/10 bg-white/[0.02]'} ${b.unlocked ? '' : 'opacity-45'}`}>
            <span className="relative w-full h-14 rounded-lg overflow-hidden border border-white/10" style={{ background: b.swatch }}>
              {!String(b.swatch).includes('url(') && <span className="absolute right-2 top-1.5 w-3 h-3 rounded-full bg-white/70" style={{ boxShadow: '0 0 8px rgba(255,255,255,.5)' }} />}
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
