'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { RACES, CLASSES, BACKGROUNDS, ABILITIES, ABILITY_CN, SKILLS, STANDARD_ARRAY, SPELLS, WEAPONS, ARMORS, mod } from '@/lib/dnd/engine';
import type { ShellProps } from './RoomShell';
import { dndSfx, setDndBgm, stopDndBgm, setDndMuted } from '@/lib/audio/dndCue';

const inviteUrl = (p: ShellProps) => `${typeof window !== 'undefined' ? window.location.origin : (p.siteUrl || '')}/join/${p.inviteToken}`;

export default function DndRoom(props: ShellProps) {
  const router = useRouter();
  const supabase = useRef(createClient()).current;
  const pub: any = props.dndPublic;
  const en = (props.room.language || 'zh') === 'en';
  const isHost = props.room.host_user_id === props.userId;
  const mySeat = props.mySeat || '';
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const logRef = useRef<HTMLDivElement>(null);
  const sfxSeq = useRef<number>(props.dndPublic?.logSeq || 0);
  const [muted, setMuted] = useState(false);
  const [theme, setTheme] = useState('');
  const [action, setAction] = useState('');
  const [aim, setAim] = useState<{ mode: 'attack' | 'cast' | 'spell'; idx?: number; spellKey?: string; target: 'enemy' | 'ally' } | null>(null);
  const [resetting, setResetting] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [shop, setShop] = useState(false);

  useEffect(() => {
    const ch = supabase.channel(`dnd-${props.room.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'dnd_state', filter: `room_id=eq.${props.room.id}` }, () => router.refresh())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms', filter: `id=eq.${props.room.id}` }, () => router.refresh())
      .subscribe();
    const id = setInterval(() => { if (typeof document !== 'undefined' && !document.hidden) router.refresh(); }, 4000);
    return () => { clearInterval(id); supabase.removeChannel(ch); };
  }, [props.room.id, supabase, router]);

  useEffect(() => { logRef.current?.scrollTo({ top: logRef.current.scrollHeight }); }, [pub?.logSeq]);

  // BGM 随阶段切换；离开房间停止
  useEffect(() => {
    const ph = pub?.phase || props.room.dnd_phase || 'lobby';
    if (ph === 'combat') setDndBgm(pub?.combat?.boss ? 'boss' : 'combat');
    else if (ph === 'explore' || ph === 'creation') setDndBgm('explore');
    else stopDndBgm();
    return () => { /* keep playing across refresh */ };
  }, [pub?.phase, props.room.dnd_phase]);
  useEffect(() => () => stopDndBgm(), []);

  // 战斗音效：扫描新日志（用真实总数 logSeq）
  useEffect(() => {
    const total = pub?.logSeq ?? 0;
    const logs = pub?.log || [];
    if (total > sfxSeq.current) {
      const newCount = Math.min(total - sfxSeq.current, logs.length);
      for (const l of logs.slice(logs.length - newCount)) {
        const m = String(l?.msg || '');
        if (m.includes('💀') || m.includes('⚰️')) dndSfx('death');
        else if (m.includes('⭐')) dndSfx('level');
        else if (m.includes('✨')) dndSfx('spell');
        else if (m.includes('🗡️')) dndSfx(m.includes('未命中') ? 'miss' : 'hit');
        else if (m.includes('👹') && m.includes('命中') && !m.includes('未命中')) dndSfx('hurt');
      }
    }
    sfxSeq.current = total;
  }, [pub?.logSeq]);


  async function call(url: string, body: any) {
    if (inFlight.current) return null;
    inFlight.current = true; setBusy(true);
    try {
      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { alert(d?.error || (en ? 'Error' : '出错了')); return null; }
      router.refresh(); return d;
    } catch (e: any) { alert((en ? 'Failed: ' : '失败：') + e.message); return null; }
    finally { inFlight.current = false; setBusy(false); }
  }

  function dispatchAim(monsterId: string) {
    if (!aim) return;
    const body: any = { roomId: props.room.id, targetId: monsterId };
    if (aim.mode === 'attack') { body.action = 'attack'; body.weaponIdx = aim.idx; }
    else if (aim.mode === 'cast') { body.action = 'cast'; body.cantripIdx = aim.idx; }
    else if (aim.mode === 'spell') { body.action = 'spell'; body.spellKey = aim.spellKey; }
    call('/api/dnd/combat', body); setAim(null);
  }
  async function replay() {
    setResetting(true);
    try { const res = await fetch('/api/rooms/replay', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ roomId: props.room.id }) });
      const d = await res.json().catch(() => ({})); if (!res.ok) { alert(d.error || (en ? 'Error' : '出错了')); setResetting(false); return; }
      if (typeof window !== 'undefined') window.location.reload();
    } catch (e: any) { alert((en ? 'Failed: ' : '失败：') + e.message); setResetting(false); }
  }

  const phase: string = pub?.phase || props.room.dnd_phase || 'lobby';
  const myChar = pub?.chars?.[mySeat];
  const combat = pub?.combat;
  const myTurn = combat?.active && combat.current === mySeat;

  // ---------------- LOBBY ----------------
  if (!pub || phase === 'lobby' || phase === 'locking') {
    const generating = props.room.dnd_phase === 'locking' || props.room.modules_generating;
    return (
      <main className="min-h-[100svh] flex flex-col items-center justify-center gap-5 px-6 text-center">
        <h1 className="text-3xl font-serif text-parchment">⚔️ {en ? 'Dungeons & Dragons' : '龙与地下城'}</h1>
        <p className="text-parchment/60 max-w-md">{en ? 'An AI Dungeon Master runs an original quest. Build a hero, roll the dice, survive.' : 'AI 地下城主带你跑一场原创冒险——建个英雄，掷骰子，活下去。'}</p>
        {isHost ? (
          <div className="flex flex-col items-center gap-3 w-full max-w-sm">
            <input value={theme} onChange={(e) => setTheme(e.target.value)} placeholder={en ? 'Theme (optional): haunted crypt, sky pirates…' : '题材（可选）：闹鬼地穴、天空海盗…'}
              className="w-full px-4 py-3 rounded bg-fog border border-eldritch/40 text-parchment placeholder:text-parchment/30 outline-none" />
            <button onClick={() => call('/api/dnd/start', { roomId: props.room.id, theme })} disabled={busy || generating}
              className="px-6 py-3 rounded bg-blood/80 hover:bg-blood text-parchment border border-blood disabled:opacity-50">
              {generating ? (en ? 'The DM is preparing…' : '地下城主正在备场…') : (en ? 'Begin the quest →' : '开启冒险 →')}
            </button>
          </div>
        ) : <p className="text-parchment/50">{generating ? (en ? 'The DM is preparing…' : '地下城主正在备场…') : (en ? 'Waiting for the host to begin…' : '等待房主开场…')}</p>}
        <div className="flex flex-col items-center gap-2 w-full max-w-sm">
          <code className="text-xs px-3 py-2 rounded bg-fog border border-eldritch/30 text-eldritch break-all w-full">{inviteUrl(props)}</code>
          <button onClick={() => navigator.clipboard.writeText(inviteUrl(props))} className="px-4 py-1.5 rounded bg-eldritch/50 text-parchment text-sm">{en ? 'Copy invite' : '复制邀请链接'}</button>
        </div>
      </main>
    );
  }

  // ---------------- shared frame ----------------
  const HeaderBar = (
    <>
    <div className="px-4 py-2 border-b border-eldritch/20 bg-ink/40 flex items-center justify-between gap-2 text-left">
      <div className="min-w-0">
        <div className="text-xs text-eldritch truncate">📜 {pub.quest || (en ? 'Adventure' : '冒险')}</div>
        <div className="text-[11px] text-parchment/50 truncate">{pub.scene}</div>
      </div>
      {myChar && <button onClick={() => setSheet(true)} className="text-[12px] text-parchment/50 hover:text-parchment shrink-0 mr-1">📋</button>}
      <button onClick={() => { const nm = !muted; setMuted(nm); setDndMuted(nm); if (!nm) { const ph = pub?.phase || 'explore'; setDndBgm(ph === 'combat' ? (pub?.combat?.boss ? 'boss' : 'combat') : 'explore'); } }} className="text-[12px] text-parchment/40 hover:text-parchment shrink-0 mr-2">{muted ? '🔇' : '🔊'}</button>
      <span className="text-[11px] text-parchment/50 shrink-0">{phase === 'combat' ? (en ? `⚔️ Combat · R${combat?.round}` : `⚔️ 战斗 · 第${combat?.round}轮`) : phase === 'creation' ? (en ? '🛠️ Create' : '🛠️ 建卡') : phase === 'explore' ? (en ? '🗺️ Explore' : '🗺️ 探索') : ''}</span>
    </div>
    {sheet && myChar && <CharSheet c={myChar} en={en} onClose={() => setSheet(false)} />}
    </>
  );

  const Party = (
    <div className="flex gap-2 overflow-x-auto px-3 py-2 border-b border-eldritch/15">
      {pub.seats.map((seat: string) => {
        const c = pub.chars?.[seat]; if (!c) return <div key={seat} className="shrink-0 text-[11px] text-parchment/30 px-2 py-1 rounded border border-dashed border-parchment/15">{seat}·{en ? 'creating…' : '建卡中'}</div>;
        const pct = Math.max(0, Math.round((c.hp / c.hpMax) * 100));
        const turnNow = combat?.active && combat.current === seat;
        return (
          <div key={seat} className={`shrink-0 w-32 rounded-lg border px-2 py-1.5 ${turnNow ? 'border-blood bg-blood/15' : 'border-eldritch/25 bg-fog/60'} ${!c.alive ? 'opacity-40' : ''}`}>
            <div className="flex items-center justify-between"><span className="text-xs text-parchment truncate">{seat === mySeat ? '★ ' : ''}{c.name}</span><span className="text-[10px] text-parchment/50">AC{c.ac}</span></div>
            <div className="text-[10px] text-parchment/45 truncate">{RACES[c.race]?.cn}{CLASSES[c.cls]?.cn} Lv{c.level}</div>
            <div className="h-1.5 rounded bg-ink mt-1 overflow-hidden"><div className={`h-full ${pct > 50 ? 'bg-green-600' : pct > 25 ? 'bg-amber-500' : 'bg-blood'}`} style={{ width: `${pct}%` }} /></div>
            <div className="text-[10px] text-parchment/50 mt-0.5">HP {c.hp}/{c.hpMax}{c.rage ? ' · 🪓' : ''}{(c.statuses || []).length ? ` · ${c.statuses.map((x: any) => x.name).join('/')}` : ''}{c.conditions?.length ? ` · ${c.conditions.join('/')}` : ''}</div>
          </div>
        );
      })}
    </div>
  );

  const Log = (
    <div ref={logRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-1.5">
      {(pub.log || []).map((l: any, i: number) => (
        <div key={i} className={`text-sm leading-snug ${l.kind === 'dm' ? 'text-parchment/90' : l.kind === 'roll' ? 'text-eldritch' : l.kind === 'act' ? 'text-amber-200/80' : ['kill', 'win', 'level', 'up'].includes(l.kind) ? 'text-green-400' : ['down', 'death', 'loss'].includes(l.kind) ? 'text-blood' : l.kind === 'attack' || l.kind === 'spell' || l.kind === 'combat' ? 'text-parchment/70' : 'text-parchment/55'}`}>{l.msg}</div>
      ))}
    </div>
  );

  // ---------------- CREATION ----------------
  if (phase === 'creation') {
    return (
      <main className="h-[100svh] flex flex-col">
        {HeaderBar}{Party}
        <div className="flex-1 overflow-y-auto">
          {Log}
          {!myChar ? <CharBuilder en={en} onSubmit={(b) => call('/api/dnd/character', { roomId: props.room.id, ...b })} busy={busy} /> :
            <div className="text-center text-sm text-parchment/60 py-4">{en ? 'Your hero is ready. Waiting for the party…' : '你的英雄已就绪，等待队伍集结……'}</div>}
        </div>
        {isHost && <div className="border-t border-eldritch/20 p-3" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
          <button onClick={() => call('/api/dnd/begin', { roomId: props.room.id })} disabled={busy} className="w-full py-2.5 rounded bg-blood/80 hover:bg-blood text-parchment border border-blood disabled:opacity-50">{en ? 'Begin the adventure →' : '开始冒险 →'}</button>
        </div>}
      </main>
    );
  }

  // ---------------- EXPLORE / COMBAT / ENDED ----------------
  const aliveMonsters = (combat?.monsters || []).filter((m: any) => m.alive);
  return (
    <main className="h-[100svh] flex flex-col">
      {HeaderBar}{Party}{Log}

      {phase === 'combat' && combat?.active && (
        <div className="border-t border-eldritch/20 px-3 py-2 space-y-2" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
          <div className="flex gap-1.5 overflow-x-auto">
            {combat.order.map((o: any) => <span key={o.ref} className={`shrink-0 text-[11px] px-2 py-0.5 rounded-full border ${o.ref === combat.current ? 'bg-blood/30 border-blood text-parchment' : 'border-eldritch/25 text-parchment/50'}`}>{o.init} {pub.chars?.[o.ref]?.name || combat.monsters.find((m: any) => m.id === o.ref)?.name}</span>)}
          </div>
          {combat.env && <div className="text-[11px] text-parchment/45 text-center">🌫️ {combat.env}</div>}
          <div className="flex gap-2 overflow-x-auto">
            {aliveMonsters.map((m: any) => { const targetable = aim?.target === 'enemy' && myTurn; return (
              <button key={m.id} disabled={!targetable || busy} onClick={() => dispatchAim(m.id)}
                className={`shrink-0 rounded-lg border px-2 py-1 text-left ${targetable ? 'border-blood bg-blood/15 animate-pulse' : 'border-eldritch/25 bg-fog/50'}`}>
                <div className="text-xs text-parchment">👹 {m.name}</div>
                <div className="text-[10px] text-parchment/50">HP {m.hp}/{m.hpMax} · AC{m.ac}</div>
              </button>
            ); })}
          </div>
          {myTurn ? (
            myChar?.hp > 0 ? (
              <div className="space-y-1.5">
                {aim && <div className="text-[11px] text-blood text-center">{aim.target === 'ally' ? (en ? 'Pick an ally to heal ↑' : '点上方队友 ↑') : (en ? 'Pick an enemy ↑' : '点上方敌人 ↑')} <button onClick={() => setAim(null)} className="underline ml-1">{en ? 'cancel' : '取消'}</button></div>}
                {aim?.target === 'ally' && (
                  <div className="flex gap-1.5 flex-wrap justify-center">
                    {pub.seats.map((seat: string) => { const ac = pub.chars?.[seat]; if (!ac || !ac.alive) return null; return <button key={seat} onClick={() => { call('/api/dnd/combat', { roomId: props.room.id, action: 'spell', spellKey: aim.spellKey, targetId: seat }); setAim(null); }} disabled={busy} className="px-2.5 py-1.5 rounded bg-green-900/40 border border-green-700/50 text-parchment text-sm">💚 {ac.name} <span className="text-[10px] text-parchment/50">{ac.hp}/{ac.hpMax}</span></button>; })}
                  </div>
                )}
                <div className="flex gap-1.5 flex-wrap">
                  {(myChar.attacks || []).map((a: any, i: number) => <button key={'w' + i} onClick={() => setAim({ mode: 'attack', idx: i, target: 'enemy' })} disabled={busy} className="px-2.5 py-1.5 rounded bg-fog border border-eldritch/40 text-parchment text-sm">🗡️ {a.name}</button>)}
                  {(myChar.cantrips || []).map((a: any, i: number) => <button key={'c' + i} onClick={() => setAim({ mode: 'cast', idx: i, target: 'enemy' })} disabled={busy} className="px-2.5 py-1.5 rounded bg-eldritch/30 border border-eldritch/40 text-parchment text-sm">✨ {a.name}</button>)}
                  {(myChar.knownSpells || []).map((k: string) => { const sp = SPELLS[k]; if (!sp) return null; const slots = myChar.spellSlots?.[sp.level] || 0; return <button key={'s' + k} disabled={busy || slots <= 0} onClick={() => setAim({ mode: 'spell', spellKey: k, target: sp.target })} className="px-2.5 py-1.5 rounded bg-purple-900/40 border border-purple-600/50 text-parchment text-sm disabled:opacity-40">🔮 {sp.cn}<span className="text-[10px] text-parchment/50"> {slots}</span></button>; })}
                  {myChar.cls === 'barbarian' && !myChar.rage && <button onClick={() => call('/api/dnd/combat', { roomId: props.room.id, action: 'rage' })} disabled={busy} className="px-2.5 py-1.5 rounded bg-orange-900/40 border border-orange-600/50 text-parchment text-sm">🪓 {en ? 'Rage' : '狂暴'}</button>}
                  {myChar.cls === 'fighter' && !myChar.secondWindUsed && <button onClick={() => call('/api/dnd/combat', { roomId: props.room.id, action: 'secondwind' })} disabled={busy} className="px-2.5 py-1.5 rounded bg-amber-900/40 border border-amber-600/50 text-parchment text-sm">💨 {en ? 'Second Wind' : '二次呼吸'}</button>}
                  {myChar.potions > 0 && <button onClick={() => call('/api/dnd/combat', { roomId: props.room.id, action: 'potion' })} disabled={busy} className="px-2.5 py-1.5 rounded bg-red-900/40 border border-red-700/50 text-parchment text-sm">🧪 {en ? 'Potion' : '药水'} {myChar.potions}</button>}
                  <button onClick={() => call('/api/dnd/combat', { roomId: props.room.id, action: 'dodge' })} disabled={busy} className="px-2.5 py-1.5 rounded bg-fog border border-parchment/25 text-parchment/70 text-sm">🛡️ {en ? 'Dodge' : '闪避'}</button>
                  <button onClick={() => { if (confirm(en ? 'Flee the battle?' : '撤退脱离战斗？')) call('/api/dnd/combat', { roomId: props.room.id, action: 'flee' }); }} disabled={busy} className="px-2.5 py-1.5 rounded bg-fog border border-parchment/20 text-parchment/50 text-sm">🏃 {en ? 'Flee' : '撤退'}</button>
                </div>
              </div>
            ) : <button onClick={() => call('/api/dnd/combat', { roomId: props.room.id, action: 'death' })} disabled={busy} className="w-full py-2 rounded bg-blood/40 border border-blood text-parchment text-sm">🩸 {en ? 'Roll death save' : '掷死亡豁免'}</button>
          ) : <div className="text-center text-xs text-parchment/45">{en ? `Waiting for ${pub.chars?.[combat.current]?.name || combat.monsters.find((m: any) => m.id === combat.current)?.name || '…'}` : `等待 ${pub.chars?.[combat.current]?.name || combat.monsters.find((m: any) => m.id === combat.current)?.name || '…'} 行动`}</div>}
        </div>
      )}

      {phase === 'ended' && (
        <div className="border-t border-eldritch/20 px-4 py-4 text-center space-y-3" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
          <div className="text-sm text-parchment/70">{en ? 'The adventure has ended.' : '本场冒险已落幕。'}</div>
          {isHost && <button onClick={replay} disabled={resetting} className="px-5 py-2 rounded bg-blood/80 hover:bg-blood text-parchment border border-blood text-sm disabled:opacity-50">{resetting ? (en ? 'Resetting…' : '重置中…') : (en ? '↻ New adventure' : '↻ 再来一局')}</button>}
        </div>
      )}

      {phase === 'explore' && (
        <div className="border-t border-eldritch/20 px-3 py-2 space-y-2" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
          {!myChar ? <CharBuilder en={en} onSubmit={(b) => call('/api/dnd/character', { roomId: props.room.id, ...b })} busy={busy} /> : (
            <>
              <div className="flex gap-2">
                <input value={action} onChange={(e) => setAction(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && action.trim()) { call('/api/dnd/act', { roomId: props.room.id, action }); setAction(''); } }}
                  placeholder={en ? 'Describe your action…' : '描述你的行动……'} className="flex-1 px-3 py-2 rounded bg-fog border border-eldritch/30 text-parchment placeholder:text-parchment/30 outline-none text-sm" />
                <button onClick={() => { if (action.trim()) { call('/api/dnd/act', { roomId: props.room.id, action }); setAction(''); } }} disabled={busy} className="px-4 py-2 rounded bg-eldritch/60 hover:bg-eldritch text-parchment text-sm disabled:opacity-50">{busy ? '…' : (en ? 'Act' : '行动')}</button>
              </div>
              <div className="flex gap-2 justify-center flex-wrap">
                {myChar.potions > 0 && <button onClick={() => call('/api/dnd/item', { roomId: props.room.id })} disabled={busy} className="px-3 py-1 rounded bg-red-900/40 border border-red-700/50 text-parchment/80 text-xs">🧪 {en ? 'Potion' : '药水'} {myChar.potions}</button>}
                <button onClick={() => call('/api/dnd/item', { roomId: props.room.id, action: 'buy' })} disabled={busy || (myChar.gold || 0) < 25} className="px-3 py-1 rounded bg-fog border border-eldritch/25 text-parchment/70 text-xs disabled:opacity-40">🧪 {en ? 'Buy potion (25g)' : '买药水(25金)'}</button>
                <button onClick={() => setShop((v) => !v)} className="px-3 py-1 rounded bg-fog border border-eldritch/25 text-parchment/70 text-xs">🛒 {en ? 'Shop' : '商店'} · {myChar.gold || 0}💰</button>
                {isHost && <>
                  <button onClick={() => call('/api/dnd/rest', { roomId: props.room.id, kind: 'short' })} disabled={busy} className="px-3 py-1 rounded bg-fog border border-eldritch/25 text-parchment/70 text-xs">🏕️ {en ? 'Short rest' : '短休'}</button>
                  <button onClick={() => call('/api/dnd/rest', { roomId: props.room.id, kind: 'long' })} disabled={busy} className="px-3 py-1 rounded bg-fog border border-eldritch/25 text-parchment/70 text-xs">🌙 {en ? 'Long rest' : '长休'}</button>
                  <button onClick={() => { if (confirm(en ? 'End the adventure?' : '结束本场冒险？')) call('/api/dnd/end', { roomId: props.room.id }); }} disabled={busy} className="px-3 py-1 rounded bg-fog border border-parchment/20 text-parchment/50 text-xs">🏁 {en ? 'End' : '结束冒险'}</button>
                </>}
              </div>
              {shop && (
                <div className="rounded-lg bg-ink/40 border border-eldritch/20 p-2 space-y-1.5 text-[11px]">
                  <div className="text-parchment/50">{en ? 'Weapons' : '武器'}</div>
                  <div className="flex gap-1.5 flex-wrap">
                    {Object.entries(WEAPONS).map(([k, w]: any) => { const owned = (myChar.attacks || []).some((a: any) => a.name === w.cn); return <button key={k} disabled={busy || owned || (myChar.gold || 0) < w.cost} onClick={() => call('/api/dnd/item', { roomId: props.room.id, action: 'buygear', kind: 'weapon', key: k })} className="px-2 py-1 rounded bg-fog border border-eldritch/30 text-parchment/80 disabled:opacity-40">{w.cn} {w.damage}·{w.cost}💰{owned ? '✓' : ''}</button>; })}
                  </div>
                  <div className="text-parchment/50">{en ? 'Armor & Shield' : '护甲与盾'}</div>
                  <div className="flex gap-1.5 flex-wrap">
                    {Object.entries(ARMORS).map(([k, a]: any) => <button key={k} disabled={busy || (myChar.armorBonus || 0) >= a.bonus || (myChar.gold || 0) < a.cost} onClick={() => call('/api/dnd/item', { roomId: props.room.id, action: 'buygear', kind: 'armor', key: k })} className="px-2 py-1 rounded bg-fog border border-eldritch/30 text-parchment/80 disabled:opacity-40">{a.cn} +{a.bonus}AC·{a.cost}💰</button>)}
                    <button disabled={busy || myChar.shield || (myChar.gold || 0) < 15} onClick={() => call('/api/dnd/item', { roomId: props.room.id, action: 'buygear', kind: 'shield' })} className="px-2 py-1 rounded bg-fog border border-eldritch/30 text-parchment/80 disabled:opacity-40">{en ? 'Shield' : '盾牌'} +2AC·15💰{myChar.shield ? '✓' : ''}</button>
                  </div>
                </div>
              )}
              {(pub.seats || []).some((seat: string) => pub.chars?.[seat]?.alive === false) && (
                <div className="flex gap-1.5 flex-wrap justify-center">
                  {pub.seats.filter((seat: string) => pub.chars?.[seat]?.alive === false).map((seat: string) => <button key={seat} disabled={busy || (myChar.gold || 0) < 100} onClick={() => call('/api/dnd/item', { roomId: props.room.id, action: 'revive', targetSeat: seat })} className="px-3 py-1 rounded bg-fog border border-eldritch/25 text-parchment/70 text-xs disabled:opacity-40">⛪ {en ? 'Revive' : '复活'} {pub.chars[seat].name} (100💰)</button>)}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </main>
  );
}

function CharBuilder({ en, onSubmit, busy }: { en: boolean; onSubmit: (b: any) => void; busy: boolean }) {
  const [name, setName] = useState('');
  const [race, setRace] = useState('human');
  const [cls, setCls] = useState('fighter');
  const [background, setBackground] = useState('soldier');
  const [scores, setScores] = useState<Record<string, number>>(() => ({ str: STANDARD_ARRAY[0], dex: STANDARD_ARRAY[1], con: STANDARD_ARRAY[2], int: STANDARD_ARRAY[3], wis: STANDARD_ARRAY[4], cha: STANDARD_ARRAY[5] }));
  function roll() { const r = () => { const d = [0, 0, 0, 0].map(() => 1 + Math.floor(Math.random() * 6)).sort((a, b) => b - a); return d[0] + d[1] + d[2]; }; const n: any = {}; for (const a of ABILITIES) n[a] = r(); setScores(n); }
  return (
    <div className="px-4 py-3 space-y-2 max-w-md mx-auto">
      <div className="text-sm text-eldritch text-center">🛠️ {en ? 'Create your hero' : '创建你的英雄'}</div>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder={en ? 'Hero name' : '角色名'} className="w-full px-3 py-2 rounded bg-fog border border-eldritch/30 text-parchment placeholder:text-parchment/30 outline-none text-sm" />
      <div className="grid grid-cols-3 gap-2">
        <Sel label={en ? 'Race' : '种族'} value={race} onChange={setRace} opts={Object.entries(RACES).map(([k, v]) => [k, v.cn])} />
        <Sel label={en ? 'Class' : '职业'} value={cls} onChange={setCls} opts={Object.entries(CLASSES).map(([k, v]) => [k, v.cn])} />
        <Sel label={en ? 'Background' : '背景'} value={background} onChange={setBackground} opts={Object.entries(BACKGROUNDS).map(([k, v]) => [k, v.cn])} />
      </div>
      <div className="grid grid-cols-6 gap-1">
        {ABILITIES.map((a) => (
          <div key={a} className="text-center">
            <div className="text-[10px] text-parchment/50">{ABILITY_CN[a]}</div>
            <input type="number" value={scores[a]} onChange={(e) => setScores((s) => ({ ...s, [a]: Math.max(3, Math.min(18, Number(e.target.value) || 10)) }))} className="w-full px-1 py-1 rounded bg-fog border border-eldritch/30 text-parchment text-sm text-center" />
            <div className="text-[10px] text-eldritch">{mod(scores[a]) >= 0 ? '+' : ''}{mod(scores[a])}</div>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <button onClick={roll} className="px-3 py-1.5 rounded bg-fog border border-eldritch/30 text-parchment/70 text-xs">🎲 {en ? 'Roll 4d6' : '随机骰点'}</button>
        <button onClick={() => { const a = ABILITIES; const n: any = {}; a.forEach((k, i) => n[k] = STANDARD_ARRAY[i]); setScores(n); }} className="px-3 py-1.5 rounded bg-fog border border-eldritch/30 text-parchment/70 text-xs">{en ? 'Standard array' : '标准数组'}</button>
      </div>
      <button onClick={() => onSubmit({ name, race, cls, background, scores })} disabled={busy || !name.trim()} className="w-full py-2 rounded bg-blood/80 hover:bg-blood text-parchment border border-blood text-sm disabled:opacity-50">{en ? 'Confirm hero' : '确认角色'}</button>
    </div>
  );
}

function Sel({ label, value, onChange, opts }: { label: string; value: string; onChange: (v: string) => void; opts: [string, string][] }) {
  return (
    <label className="text-[11px] text-parchment/50">{label}
      <select value={value} onChange={(e) => onChange(e.target.value)} className="w-full mt-0.5 px-1.5 py-1.5 rounded bg-fog border border-eldritch/30 text-parchment text-sm">
        {opts.map(([k, cn]) => <option key={k} value={k}>{cn}</option>)}
      </select>
    </label>
  );
}

function CharSheet({ c, en, onClose }: { c: any; en: boolean; onClose: () => void }) {
  const sgn = (n: number) => (n >= 0 ? '+' : '') + n;
  const isCaster = (c.knownSpells || []).length > 0 || (c.cantrips || []).length > 0;
  const slotStr = Object.keys(c.spellSlotsMax || {}).sort().map((lv) => `${lv}环 ${c.spellSlots?.[lv] || 0}/${c.spellSlotsMax[lv]}`).join('  ');
  return (
    <div className="fixed inset-0 z-[80] bg-black/80 backdrop-blur-sm flex items-center justify-center p-3" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md max-h-[88vh] overflow-y-auto rounded-xl bg-fog border border-eldritch/40 p-4 text-left space-y-3">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-lg text-parchment font-serif">{c.name}</div>
            <div className="text-xs text-parchment/60">{RACES[c.race]?.cn}{CLASSES[c.cls]?.cn} · Lv{c.level} · XP {c.xp}</div>
          </div>
          <button onClick={onClose} className="text-parchment/50 hover:text-parchment text-lg leading-none">✕</button>
        </div>
        <div className="grid grid-cols-4 gap-2 text-center">
          <Stat l="HP" v={`${c.hp}/${c.hpMax}`} /><Stat l="AC" v={c.ac} /><Stat l={en ? 'Speed' : '速度'} v={c.speed} /><Stat l={en ? 'Prof' : '熟练'} v={sgn(c.profBonus)} />
        </div>
        <div className="grid grid-cols-6 gap-1 text-center">
          {ABILITIES.map((a) => (
            <div key={a} className="rounded bg-ink/40 py-1"><div className="text-[10px] text-parchment/50">{ABILITY_CN[a]}</div><div className="text-sm text-parchment">{c.scores[a]}</div><div className="text-[10px] text-eldritch">{sgn(mod(c.scores[a]))}</div></div>
          ))}
        </div>
        <div className="text-xs text-parchment/70"><span className="text-parchment/40">{en ? 'Saves' : '豁免'}：</span>{ABILITIES.filter((a) => c.saveProf?.includes(a)).map((a) => `${ABILITY_CN[a]} ${sgn(mod(c.scores[a]) + c.profBonus)}`).join('  ') || '—'}</div>
        <div className="text-xs text-parchment/70"><span className="text-parchment/40">{en ? 'Skills' : '熟练技能'}：</span>{(c.skills || []).map((k: string) => SKILLS[k] ? `${SKILLS[k].cn} ${sgn(mod(c.scores[SKILLS[k].ability]) + c.profBonus)}` : k).join('  ') || '—'}</div>
        <div className="text-xs text-parchment/70"><span className="text-parchment/40">{en ? 'Attacks' : '攻击'}：</span>{(c.attacks || []).map((a: any) => `${a.name}(${sgn(mod(c.scores[a.ability]) + c.profBonus)}, ${a.damage}${mod(c.scores[a.ability]) >= 0 ? '+' : ''}${mod(c.scores[a.ability])})`).join('  ')}</div>
        {isCaster && (
          <div className="text-xs text-parchment/70 space-y-0.5">
            <div><span className="text-parchment/40">{en ? 'Spell DC/Atk' : '法术 DC/命中'}：</span>{c.spellDc} / {sgn(c.spellAtk)}　{slotStr && <span className="text-parchment/40">· {en ? 'Slots' : '法术位'} {slotStr}</span>}</div>
            {(c.cantrips || []).length > 0 && <div><span className="text-parchment/40">{en ? 'Cantrips' : '戏法'}：</span>{c.cantrips.map((x: any) => x.name).join('、')}</div>}
            {(c.knownSpells || []).length > 0 && <div><span className="text-parchment/40">{en ? 'Spells' : '法术'}：</span>{c.knownSpells.map((k: string) => SPELLS[k]?.cn || k).join('、')}</div>}
          </div>
        )}
        <div className="text-xs text-parchment/70"><span className="text-parchment/40">{en ? 'Pack' : '随身'}：</span>🧪 {en ? 'Potion' : '药水'} ×{c.potions} · 💰 {c.gold}{(c.statuses || []).length ? ` · ${c.statuses.map((x: any) => x.name).join('/')}` : ''}{c.conditions?.length ? ` · ${c.conditions.join('/')}` : ''}{c.rage ? ' · 🪓狂暴' : ''}</div>
        <div className="text-[11px] text-parchment/45 leading-snug">{CLASSES[c.cls]?.features}</div>
      </div>
    </div>
  );
}

function Stat({ l, v }: { l: string; v: any }) {
  return <div className="rounded bg-ink/40 py-1"><div className="text-[10px] text-parchment/50">{l}</div><div className="text-sm text-parchment">{v}</div></div>;
}
