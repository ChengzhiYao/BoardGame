'use client';
// 克苏鲁快速开局 · 第二步：选一个现成的人物入戏（属性、技能都在后台自动配好）。老玩家可以点链接自己捏角色。
import { useEffect, useState } from 'react';
import type { ShellProps } from './RoomShell';

const SK_EN: Record<string, string> = { 会计: 'Accounting', 考古学: 'Archaeology', 攀爬: 'Climb', 计算机使用: 'Computers', 乔装: 'Disguise', 驾驶汽车: 'Drive', 话术: 'Fast Talk', 斗殴: 'Brawl', 手枪: 'Handgun', 急救: 'First Aid', 历史: 'History', 恐吓: 'Intimidate', 图书馆使用: 'Library Use', 聆听: 'Listen', 锁匠: 'Locksmith', 机械维修: 'Mech. Repair', 医学: 'Medicine', 博物学: 'Natural World', 导航: 'Navigate', 神秘学: 'Occult', 说服: 'Persuade', 心理学: 'Psychology', 侦查: 'Spot Hidden', 潜行: 'Stealth', 游泳: 'Swim', 追踪: 'Track', 闪避: 'Dodge' };

export default function QuickCast(props: ShellProps & { onAdvanced: () => void }) {
  const en = props.room.language === 'en';
  const [cast, setCast] = useState<any[] | null>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState<number | null>(null);
  const mine = (props.initialCharacters || []).find((c: any) => c.player_id === props.myPlayerId);
  const takenBy = (name: string) => (props.initialCharacters || []).find((c: any) => c.name === name && c.player_id !== props.myPlayerId);
  const picked = !!(mine && mine.confirmed);

  async function load() {
    setErr('');
    try {
      const r = await fetch('/api/coc/cast', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ roomId: props.room.id }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'error');
      setCast(d.cast || []);
      if ((d.cast || []).some((c: any) => !c.avatar)) portraits();
    } catch (e: any) { setErr(e.message); }
  }
  async function portraits(tries = 0) {
    try {
      const r = await fetch('/api/coc/portraits', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ roomId: props.room.id }) });
      const d = await r.json();
      if (Array.isArray(d.cast) && d.cast.length) setCast(d.cast);
      if (d.pending && tries < 6) setTimeout(() => portraits(tries + 1), 8000);
    } catch {}
  }
  useEffect(() => { if (!picked) load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function pick(i: number) {
    setBusy(i); setErr('');
    try {
      const r = await fetch('/api/coc/pick', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ roomId: props.room.id, idx: i }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'error');
      setTimeout(() => window.location.reload(), 400); // 开场或等队友，交给页面刷新
    } catch (e: any) { setErr(e.message); setBusy(null); }
  }

  const Over = ({ t }: { t: string }) => <div className="text-[10.5px] tracking-[.4em] pl-[.4em] uppercase text-[#c9a96e]/75">{t}</div>;

  if (picked) {
    const total = props.initialPlayers.length;
    const ready = (props.initialCharacters || []).filter((c: any) => c.confirmed).length;
    return (
      <div className="w-full max-w-md mx-auto flex flex-col items-center text-center gap-4 pt-10">
        <Over t={en ? 'You are' : '今晚你是'} />
        <h1 className="font-serif font-semibold text-[28px] text-[#efe6d2]">{mine.name}</h1>
        <p className="text-[13px] text-parchment/55">{mine.occupation}{mine.age ? ` · ${mine.age}` : ''}</p>
        <div className="mt-4 flex items-center gap-3 text-[13px] text-parchment/60">
          <span className="w-4 h-4 rounded-full border-2 border-[#c9a96e]/25 border-t-[#c9a96e] animate-spin" />
          {en ? `Waiting for the others to choose (${ready}/${total})` : `等队友选好人物（${ready}/${total}）`}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col gap-5 pt-2">
      <div className="text-center px-4">
        <Over t={en ? 'Step 2 · Who are you tonight' : '第二步 · 今晚你是谁'} />
        <h1 className="mt-2 font-serif font-semibold text-[25px] sm:text-[30px] text-[#efe6d2]">{en ? 'Choose someone to become' : '选一个人，走进去'}</h1>
        <p className="mt-1.5 text-[12.5px] text-parchment/45">{en ? 'Stats and skills are set for you. Just pick.' : '属性和技能都配好了，点一个就开场'}</p>
      </div>

      {!cast && !err && (
        <div className="w-full flex gap-3.5 overflow-hidden px-[9vw] sm:justify-center">
          {[0, 1, 2].map((k) => <div key={k} className="shrink-0 w-[78vw] max-w-[300px] h-[360px] rounded-2xl border border-[#d8c7a8]/[0.1] bg-gradient-to-b from-white/[0.04] to-transparent animate-pulse" style={{ animationDelay: `${k * 200}ms` }} />)}
        </div>
      )}
      {err && <div className="text-center space-y-2"><p className="text-[#e06060] text-sm">{err}</p><button onClick={load} className="text-[13px] text-[#c9a96e] border-b border-[#c9a96e]/40">{en ? 'Try again' : '再试一次'}</button></div>}

      {cast && (
        <div className="flex gap-3.5 overflow-x-auto snap-x snap-mandatory px-[9vw] sm:px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:justify-center sm:flex-wrap sm:overflow-visible">
          {cast.map((c, i) => {
            const taken = takenBy(c.name);
            return (
              <div key={i} className={`snap-center shrink-0 w-[82vw] max-w-[320px] sm:w-[290px] rounded-2xl border bg-gradient-to-b from-[#17181d]/95 to-[#0b0c0f]/95 backdrop-blur-md p-5 flex flex-col text-left ${taken ? 'border-[#d8c7a8]/[0.06] opacity-45' : 'border-[#d8c7a8]/[0.14]'}`}>
                <div className="flex items-center gap-3.5">
                  <span className="relative w-16 h-16 rounded-full overflow-hidden border border-[#c9a96e]/40 bg-[#c9a96e]/[0.07] shrink-0">
                    {c.avatar
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img src={c.avatar} alt="" className="w-full h-full object-cover nf-in" />
                      : <span className="absolute inset-0 flex items-end justify-center animate-pulse"><svg width="46" height="46" viewBox="0 0 24 24" fill="rgba(216,199,168,.18)"><circle cx="12" cy="9" r="4.2" /><path d="M3.5 22c.8-4.6 4.3-7.2 8.5-7.2s7.7 2.6 8.5 7.2z" /></svg></span>}
                  </span>
                  <div className="min-w-0">
                    <div className="font-serif font-semibold text-[21px] leading-tight text-[#efe6d2] truncate">{c.name}</div>
                    <div className="text-[12.5px] text-parchment/50 mt-0.5 truncate">{c.occupation}{c.age ? ` · ${c.age}` : ''}</div>
                  </div>
                </div>
                <p className="mt-4 font-serif text-[15px] leading-[1.75] text-parchment/85">{c.tagline}</p>
                <div className="mt-4 space-y-2 text-[12.5px]">
                  {c.signature && <div className="flex items-baseline gap-2"><span className="text-[#c9a96e]/80 shrink-0 w-10">{en ? 'Best' : '拿手'}</span><span className="text-parchment/80">{en ? (SK_EN[c.signature] || c.signature) : c.signature}</span></div>}
                  {c.weakness && <div className="flex items-baseline gap-2"><span className="text-[#c0453f]/80 shrink-0 w-10">{en ? 'Flaw' : '弱点'}</span><span className="text-parchment/65">{c.weakness}</span></div>}
                  {Array.isArray(c.inventory) && c.inventory.length > 0 && <div className="flex items-baseline gap-2"><span className="text-parchment/40 shrink-0 w-10">{en ? 'Carries' : '随身'}</span><span className="text-parchment/60">{c.inventory.join(en ? ', ' : '、')}</span></div>}
                </div>
                <button onClick={() => pick(i)} disabled={busy !== null || !!taken} className="mt-auto pt-0">
                  <span className={`mt-5 block w-full py-3 rounded-xl font-serif tracking-[.15em] border ${taken ? 'border-[#d8c7a8]/10 text-parchment/40' : 'bg-[#7d1d1d] hover:bg-[#8e2323] border-[#a83232]/60 text-[#f2ead9]'}`}>
                    {taken ? (en ? 'Taken by a teammate' : '队友已选') : busy === i ? (en ? 'Becoming…' : '正在入戏…') : (en ? 'Be this person' : '就是我')}
                  </span>
                </button>
              </div>
            );
          })}
        </div>
      )}

      <div className="text-center">
        <button onClick={props.onAdvanced} className="text-[12px] text-parchment/40 hover:text-parchment/70">{en ? 'Veteran? Build your own investigator →' : '我是老玩家，自己捏角色 →'}</button>
      </div>
    </div>
  );
}
