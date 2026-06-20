'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { RACES, CLASSES, BACKGROUNDS, ABILITIES, ABILITY_CN, SKILLS, STANDARD_ARRAY, SPELLS, WEAPONS, ARMORS, mod } from '@/lib/dnd/engine';
import type { ShellProps } from './RoomShell';
import { dndSfx } from '@/lib/audio/dndCue';
import AudioManager from './AudioManager';

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
  const [theme, setTheme] = useState('');
  const [customQuest, setCustomQuest] = useState('');
  const [action, setAction] = useState('');
  const [aim, setAim] = useState<{ mode: 'attack' | 'cast' | 'spell'; idx?: number; spellKey?: string; target: 'enemy' | 'ally' } | null>(null);
  const [resetting, setResetting] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [shop, setShop] = useState(false);
  const [mtab, setMtab] = useState<'story' | 'party' | 'pack' | 'world'>('story');
  const [leftView, setLeftView] = useState<'party' | 'pack'>('party');

  useEffect(() => {
    const ch = supabase.channel(`dnd-${props.room.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'dnd_state', filter: `room_id=eq.${props.room.id}` }, () => router.refresh())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms', filter: `id=eq.${props.room.id}` }, () => router.refresh())
      .subscribe();
    const id = setInterval(() => { if (typeof document !== 'undefined' && !document.hidden) router.refresh(); }, 4000);
    return () => { clearInterval(id); supabase.removeChannel(ch); };
  }, [props.room.id, supabase, router]);

  useEffect(() => { logRef.current?.scrollTo({ top: logRef.current.scrollHeight }); }, [pub?.logSeq]);

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
  function startWith(q: any, customText?: string) {
    const theme2 = q ? `《${q.title}》｜${q.setting}｜钩子：${q.hook}｜威胁：${q.threat}｜基调：${q.tone}` : String(customText || '').trim();
    call('/api/dnd/start', { roomId: props.room.id, theme: theme2 });
  }
  async function createChar(b: any) {
    const d = await call('/api/dnd/character', { roomId: props.room.id, ...b });
    if (d) fetch('/api/dnd/portrait', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ roomId: props.room.id }) }).then(() => router.refresh()).catch(() => {});
  }

  const phase: string = pub?.phase || props.room.dnd_phase || 'lobby';
  const myChar = pub?.chars?.[mySeat];
  const combat = pub?.combat;
  const myTurn = combat?.active && combat.current === mySeat;
  const dndAudioState = phase === 'combat' ? (combat?.boss ? 'DND_BOSS' : 'DND_COMBAT') : phase === 'ended' ? 'GOOD_ENDING' : 'DND_EXPLORE';

  // ---------------- LOBBY / 选择冒险 ----------------
  if (!pub) {
    const phaseR = props.room.dnd_phase || 'lobby';
    const opts: any[] = Array.isArray(props.room.dnd_options) ? props.room.dnd_options : [];
    const generating = props.room.modules_generating || phaseR === 'locking';

    if (phaseR === 'select' && opts.length && !generating) {
      return (
        <main className="min-h-[100svh] flex flex-col items-center gap-4 px-5 py-8 text-center overflow-y-auto">
          <h1 className="text-2xl font-serif text-parchment">⚔️ {en ? 'Choose your adventure' : '选择一场冒险'}</h1>
          {!isHost && <p className="text-parchment/50 text-sm">{en ? 'The host is choosing…' : '由房主挑选（你可以围观）'}</p>}
          <div className="grid sm:grid-cols-3 gap-3 w-full max-w-4xl">
            {opts.map((q: any) => (
              <div key={q.id} className="rounded-xl bg-fog/70 border border-eldritch/30 p-3 text-left flex flex-col gap-1.5">
                <div className="text-parchment font-serif text-sm">{q.title}</div>
                <div className="text-[11px] text-eldritch/80">{q.tone}{q.length ? ' · ' + q.length : ''}</div>
                <div className="text-[12px] text-parchment/70">{q.setting}</div>
                <div className="text-[12px] text-parchment/55">🪝 {q.hook}</div>
                <div className="text-[12px] text-blood/80">☠ {q.threat}</div>
                {isHost && <button onClick={() => startWith(q)} disabled={busy} className="mt-1 py-1.5 rounded bg-blood/80 hover:bg-blood text-parchment text-sm border border-blood disabled:opacity-50">{en ? 'Pick this →' : '选这个 →'}</button>}
              </div>
            ))}
          </div>
          {isHost && (
            <div className="w-full max-w-md rounded-xl bg-fog/50 border border-eldritch/25 p-3 text-left flex flex-col gap-2">
              <div className="text-sm text-parchment/80">🛠️ {en ? 'Or build a custom adventure' : '或自定义一场（详细设定）'}</div>
              <textarea value={customQuest} onChange={(e) => setCustomQuest(e.target.value)} rows={3} placeholder={en ? 'World, races/monsters, villain, tone, goal…' : '世界观、种族/魔族、反派、基调、目标……写得越细越好'} className="w-full px-3 py-2 rounded bg-fog border border-eldritch/30 text-parchment placeholder:text-parchment/30 outline-none text-sm" />
              <button onClick={() => { if (customQuest.trim()) startWith(null, customQuest); }} disabled={busy || !customQuest.trim()} className="py-1.5 rounded bg-eldritch/60 hover:bg-eldritch text-parchment text-sm disabled:opacity-50">{en ? 'Start custom →' : '用这个开始 →'}</button>
              <button onClick={() => call('/api/dnd/quests', { roomId: props.room.id, custom: theme })} disabled={busy} className="text-xs text-parchment/45 hover:text-parchment self-start">↻ {en ? 'Reroll options' : '换一批选项'}</button>
            </div>
          )}
        </main>
      );
    }

    if (generating) {
      return <main className="min-h-[100svh] flex items-center justify-center px-6 text-center"><p className="text-parchment/60">{en ? 'The DM is preparing…' : '地下城主正在备场……'}</p></main>;
    }

    return (
      <main className="min-h-[100svh] flex flex-col items-center justify-center gap-5 px-6 text-center">
        <h1 className="text-3xl font-serif text-parchment">⚔️ {en ? 'Dungeons & Dragons' : '龙与地下城'}</h1>
        <p className="text-parchment/60 max-w-md">{en ? 'An AI Dungeon Master runs an original quest. Build a hero, roll the dice, survive.' : 'AI 地下城主带你跑一场原创冒险——建个英雄，掷骰子，活下去。'}</p>
        {isHost ? (
          <div className="flex flex-col items-center gap-3 w-full max-w-sm">
            <input value={theme} onChange={(e) => setTheme(e.target.value)} placeholder={en ? 'Direction (optional): world, monsters, villain…' : '方向（可选）：世界观 / 魔族 / 反派 / 基调…'} className="w-full px-4 py-3 rounded bg-fog border border-eldritch/40 text-parchment placeholder:text-parchment/30 outline-none" />
            <button onClick={() => call('/api/dnd/quests', { roomId: props.room.id, custom: theme })} disabled={busy} className="px-6 py-3 rounded bg-blood/80 hover:bg-blood text-parchment border border-blood disabled:opacity-50">{en ? 'Generate 3 adventures →' : '生成 3 个冒险 →'}</button>
          </div>
        ) : <p className="text-parchment/50">{en ? 'Waiting for the host…' : '等待房主开场…'}</p>}
        <div className="flex flex-col items-center gap-2 w-full max-w-sm">
          <code className="text-xs px-3 py-2 rounded bg-fog border border-eldritch/30 text-eldritch break-all w-full">{inviteUrl(props)}</code>
          <button onClick={() => navigator.clipboard.writeText(inviteUrl(props))} className="px-4 py-1.5 rounded bg-eldritch/50 text-parchment text-sm">{en ? 'Copy invite' : '复制邀请链接'}</button>
        </div>
      </main>
    );
  }

  // ---------------- DASHBOARD ----------------
  const aliveMonsters = (combat?.monsters || []).filter((m: any) => m.alive);
  const foeName = (ref: string) => pub.chars?.[ref]?.name || combat?.monsters.find((m: any) => m.id === ref)?.name || '…';
  function submitExplore(kind: 'talk' | 'act') {
    const a = action.trim(); if (!a) return;
    call('/api/dnd/act', { roomId: props.room.id, action: kind === 'talk' ? `（说）${a}` : a });
    setAction('');
  }

  const spellEffect = (sp: any) => sp ? (sp.kind === 'heal' ? (en ? `Heal ${sp.dice}+mod` : `治疗 ${sp.dice}+调整值`) : sp.kind === 'status' ? (en ? `Save or ${sp.status}` : `豁免失败则【${sp.status}】`) : sp.kind === 'missile' ? (en ? `3 darts ${sp.dice} each, auto-hit` : `三发各 ${sp.dice}，自动命中`) : (en ? `${sp.dice} ${sp.save ? 'save half' : 'on hit'}` : `${sp.dice}${sp.save ? '，豁免半伤' : '，命中伤害'}`)) : '';
  const aimDesc = !aim ? '' : aim.mode === 'attack' ? `${myChar?.attacks?.[aim.idx!]?.name}：${myChar?.attacks?.[aim.idx!]?.damage} ${myChar?.attacks?.[aim.idx!]?.type}${en ? '' : '伤害'}` : aim.mode === 'cast' ? `${myChar?.cantrips?.[aim.idx!]?.name}：${myChar?.cantrips?.[aim.idx!]?.damage} ${myChar?.cantrips?.[aim.idx!]?.type}` : aim.mode === 'spell' ? `${SPELLS[aim.spellKey!]?.cn}（${SPELLS[aim.spellKey!]?.level}${en ? '-lvl' : '环'}）：${spellEffect(SPELLS[aim.spellKey!])}` : '';
  const combatControls = (
    <div className="space-y-1.5">
      <div className="text-[11px] text-parchment/40 text-center">{en ? '💡 Pick a weapon/spell then tap a target; or dodge / flee / drink a potion.' : '💡 先点武器或法术，再点目标进攻；也可以闪避 / 撤退 / 喝药水。'}</div>
      {aim && <div className="text-center space-y-0.5"><div className="text-[11px] text-eldritch">{aimDesc}</div><div className="text-[11px] text-blood">{aim.target === 'ally' ? (en ? 'Pick an ally below ↓' : '点下方队友 ↓') : (en ? 'Pick an enemy below ↓' : '点下方敌人 ↓')} <button onClick={() => setAim(null)} className="underline ml-1">{en ? 'cancel' : '取消'}</button></div></div>}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {aliveMonsters.map((m: any) => { const targetable = aim?.target === 'enemy'; return (
          <button key={m.id} disabled={!targetable || busy} onClick={() => dispatchAim(m.id)} className={`shrink-0 rounded-lg border px-2 py-1 text-left ${targetable ? 'border-blood bg-blood/15 animate-pulse' : 'border-eldritch/25 bg-fog/50'}`}>
            <div className="text-xs text-parchment">👿 {m.name}</div><div className="text-[10px] text-parchment/50">HP {m.hp}/{m.hpMax}·AC{m.ac}</div></button>); })}
        {aim?.target === 'ally' && pub.seats.map((seat: string) => { const ac = pub.chars?.[seat]; if (!ac || !ac.alive) return null; return <button key={seat} onClick={() => { call('/api/dnd/combat', { roomId: props.room.id, action: 'spell', spellKey: aim.spellKey, targetId: seat }); setAim(null); }} disabled={busy} className="shrink-0 px-2.5 py-1.5 rounded bg-green-900/40 border border-green-700/50 text-parchment text-sm">💚 {ac.name} <span className="text-[10px] text-parchment/50">{ac.hp}/{ac.hpMax}</span></button>; })}
      </div>
      <div className="flex gap-1.5 flex-wrap">
        {myChar.attacks?.[myChar.equipped || 0] && <button title={`${myChar.attacks[myChar.equipped || 0].damage} ${myChar.attacks[myChar.equipped || 0].type}`} onClick={() => setAim({ mode: 'attack', idx: myChar.equipped || 0, target: 'enemy' })} disabled={busy} className="px-2.5 py-1.5 rounded bg-fog border border-eldritch/40 text-parchment text-sm">🗡️ {myChar.attacks[myChar.equipped || 0].name}</button>}
        {(myChar.attacks || []).length > 1 && <button title={en ? 'Switch weapon (free)' : '切换持握武器（自由动作）'} onClick={() => call('/api/dnd/item', { roomId: props.room.id, action: 'equip', weaponIdx: ((myChar.equipped || 0) + 1) % myChar.attacks.length })} disabled={busy} className="px-2.5 py-1.5 rounded bg-fog border border-parchment/25 text-parchment/70 text-sm">🔄 {en ? 'Swap' : '换武器'}</button>}
        {(myChar.cantrips || []).map((a: any, i: number) => <button key={'c' + i} title={`${en ? 'Cantrip' : '戏法'} · ${a.damage} ${a.type}`} onClick={() => setAim({ mode: 'cast', idx: i, target: 'enemy' })} disabled={busy} className="px-2.5 py-1.5 rounded bg-eldritch/30 border border-eldritch/40 text-parchment text-sm">✨ {a.name}</button>)}
        {(myChar.knownSpells || []).map((k: string) => { const sp = SPELLS[k]; if (!sp) return null; const slots = myChar.spellSlots?.[sp.level] || 0; return <button key={'s' + k} title={`${sp.level}${en ? '-lvl' : '环'} · ${spellEffect(sp)}`} disabled={busy || slots <= 0} onClick={() => setAim({ mode: 'spell', spellKey: k, target: sp.target })} className="px-2.5 py-1.5 rounded bg-purple-900/40 border border-purple-600/50 text-parchment text-sm disabled:opacity-40">🔮 {sp.cn}<span className="text-[10px] text-parchment/50"> {slots}</span></button>; })}
        {myChar.cls === 'barbarian' && !myChar.rage && <button onClick={() => call('/api/dnd/combat', { roomId: props.room.id, action: 'rage' })} disabled={busy} className="px-2.5 py-1.5 rounded bg-orange-900/40 border border-orange-600/50 text-parchment text-sm">🪓 {en ? 'Rage' : '狂暴'}</button>}
        {myChar.cls === 'fighter' && !myChar.secondWindUsed && <button onClick={() => call('/api/dnd/combat', { roomId: props.room.id, action: 'secondwind' })} disabled={busy} className="px-2.5 py-1.5 rounded bg-amber-900/40 border border-amber-600/50 text-parchment text-sm">💨 {en ? 'Second Wind' : '二次呼吸'}</button>}
        {myChar.potions > 0 && <button onClick={() => call('/api/dnd/combat', { roomId: props.room.id, action: 'potion' })} disabled={busy} className="px-2.5 py-1.5 rounded bg-red-900/40 border border-red-700/50 text-parchment text-sm">🧪 {en ? 'Potion' : '药水'} {myChar.potions}</button>}
        <button onClick={() => call('/api/dnd/combat', { roomId: props.room.id, action: 'dodge' })} disabled={busy} className="px-2.5 py-1.5 rounded bg-fog border border-parchment/25 text-parchment/70 text-sm">🛡️ {en ? 'Dodge' : '闪避'}</button>
        <button onClick={() => { if (confirm(en ? 'Flee the battle?' : '撤退脱离战斗？')) call('/api/dnd/combat', { roomId: props.room.id, action: 'flee' }); }} disabled={busy} className="px-2.5 py-1.5 rounded bg-fog border border-parchment/20 text-parchment/50 text-sm">🏃 {en ? 'Flee' : '撤退'}</button>
      </div>
    </div>
  );

  const bottomBar = (
    <div className="border-t border-eldritch/20 px-3 sm:px-4 py-3 space-y-2 shrink-0" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
      {phase === 'creation' && (!myChar
        ? <CharBuilder en={en} onSubmit={createChar} busy={busy} />
        : <div className="text-center space-y-2"><div className="text-sm text-parchment/60">{en ? 'Your hero is ready. Waiting for the party…' : '你的英雄已就绪，等待队伍集结……'}</div>{isHost && <button onClick={() => call('/api/dnd/begin', { roomId: props.room.id })} disabled={busy} className="w-full py-2.5 rounded bg-blood/80 hover:bg-blood text-parchment border border-blood disabled:opacity-50">{en ? 'Begin the adventure →' : '开始冒险 →'}</button>}</div>)}

      {phase === 'combat' && combat?.active && (myTurn
        ? (myChar?.hp > 0 ? combatControls : <button onClick={() => call('/api/dnd/combat', { roomId: props.room.id, action: 'death' })} disabled={busy} className="w-full py-2 rounded bg-blood/40 border border-blood text-parchment text-sm">🩸 {en ? 'Roll death save' : '掷死亡豁免'}</button>)
        : <div className="text-center text-xs text-parchment/45 py-2">{en ? `Waiting for ${foeName(combat.current)}…` : `等待 ${foeName(combat.current)} 行动…`}</div>)}

      {phase === 'explore' && (!myChar
        ? <CharBuilder en={en} onSubmit={createChar} busy={busy} />
        : <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs px-2 py-1 rounded bg-eldritch/30 text-parchment shrink-0">{en ? 'You' : '你'} · {mySeat}</span>
              <input value={action} onChange={(e) => setAction(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submitExplore('act')} placeholder={en ? 'Describe an action / speak…' : '描述行动 / 说话……'} className="flex-1 min-w-0 px-4 py-2 rounded bg-fog border border-eldritch/30 text-parchment placeholder:text-parchment/30 outline-none focus:border-eldritch text-sm" />
            </div>
            <div className="flex gap-2">
              <button onClick={() => submitExplore('talk')} disabled={busy || !action.trim()} className="flex-1 px-3 py-2 rounded bg-fog border border-eldritch/40 text-parchment text-sm hover:bg-eldritch/20 disabled:opacity-50">{en ? 'Speak' : '对话'}</button>
              <button onClick={() => submitExplore('act')} disabled={busy || !action.trim()} className="flex-1 px-4 py-2 rounded bg-blood/80 hover:bg-blood text-parchment border border-blood disabled:opacity-50">{busy ? '…' : (en ? 'Submit action' : '提交行动')}</button>
            </div>
            <div className="text-[11px] text-parchment/40 text-center">{pub.safe ? (en ? '💡 Safe here — restock, shop and rest on the right. Or investigate, talk, move…' : '💡 这里安全——可在右侧补给/购物/休整；也可搜查、交谈、移动…') : (en ? '💡 Describe anything: search, talk, sneak, fight, flee… or pick an option above.' : '💡 描述任何行动：搜查、交谈、潜行、战斗、逃跑…或点上方选项。')}</div>
          </div>)}

      {phase === 'ended' && <div className="text-center space-y-2"><div className="text-sm text-parchment/70">{en ? 'The adventure has ended.' : '本场冒险已落幕。'}</div>{isHost && <button onClick={replay} disabled={resetting} className="px-5 py-2 rounded bg-blood/80 hover:bg-blood text-parchment border border-blood text-sm disabled:opacity-50">{resetting ? (en ? 'Resetting…' : '重置中…') : (en ? '↻ New adventure' : '↻ 再来一局')}</button>}</div>}
    </div>
  );

  return (
    <main className="h-[100svh] flex flex-col overflow-hidden">
      <DndStepper phase={phase} en={en} />
      <div className="flex items-center justify-between gap-2 px-4 py-1.5 text-xs border-b border-eldritch/10">
        <div className="min-w-0 truncate text-eldritch">📜 {pub.quest || (en ? 'Adventure' : '冒险')}</div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={pub.safe ? 'text-green-400' : 'text-amber-400'}>{pub.safe ? (en ? '🏕️ Safe' : '🏕️ 安全') : (en ? '⚠️ Danger' : '⚠️ 危险')}{pub.scene ? <span className="text-parchment/50"> · {pub.scene}</span> : null}</span>
          {myChar && <button onClick={() => setSheet(true)} className="text-xs px-2 py-1 rounded bg-eldritch/30 text-parchment">{en ? 'Sheet' : '角色卡'}</button>}
        </div>
      </div>

      <div className="lg:hidden flex border-b border-eldritch/15 text-sm">
        {(['story', 'party', 'pack', 'world'] as const).map((k) => <button key={k} onClick={() => { setMtab(k); if (k === 'party' || k === 'pack') setLeftView(k); }} className={`flex-1 py-2.5 ${mtab === k ? 'bg-blood/25 text-parchment border-b-2 border-blood' : 'text-parchment/50'}`}>{k === 'story' ? (en ? 'Story' : '剧情') : k === 'party' ? (en ? 'Party' : '队伍') : k === 'pack' ? (en ? 'Pack' : '背包') : (en ? 'World' : '场景')}</button>)}
      </div>

      <div className="flex-1 min-h-0 flex flex-col lg:grid lg:grid-cols-[260px_1fr_300px] overflow-hidden">
        <aside className={`border-r border-eldritch/15 p-3 space-y-3 overflow-y-auto min-h-0 lg:block ${mtab === 'party' || mtab === 'pack' ? 'block flex-1' : 'hidden'}`}>
          <div className="flex gap-1 text-xs">
            {(['party', 'pack'] as const).map((v) => <button key={v} onClick={() => setLeftView(v)} className={`flex-1 py-1 rounded ${leftView === v ? 'bg-eldritch/40 text-parchment' : 'bg-fog/60 text-parchment/50'}`}>{v === 'party' ? (en ? 'Party' : '队伍') : (en ? 'Backpack' : '背包')}</button>)}
          </div>
          {leftView === 'party'
            ? pub.seats.map((seat: string) => <DndCharCard key={seat} seat={seat} c={pub.chars?.[seat]} me={seat === mySeat} turnNow={!!(combat?.active && combat.current === seat)} en={en} />)
            : <Backpack c={myChar} en={en} busy={busy} onUsePotion={!combat?.active && myChar?.potions > 0 ? () => call('/api/dnd/item', { roomId: props.room.id }) : null} onEquip={(idx: number) => call('/api/dnd/item', { roomId: props.room.id, action: 'equip', weaponIdx: idx })} />}
        </aside>

        <section className={`flex-col overflow-hidden min-h-0 lg:flex ${mtab === 'story' ? 'flex flex-1' : 'hidden'}`}>
          <div ref={logRef} className="flex-1 min-h-0 overflow-y-auto px-3 sm:px-4 py-4 space-y-2.5">
            {(pub.log || []).map((l: any, i: number) => <LogLine key={i} l={l} myName={myChar?.name} en={en} />)}
            {phase === 'explore' && myChar && Array.isArray(pub.options) && pub.options.length > 0 && <DndGuide scene={pub.scene} quest={pub.quest} options={pub.options} mySeat={mySeat} en={en} disabled={busy} onPick={(o: string) => call('/api/dnd/act', { roomId: props.room.id, action: o })} />}
          </div>
          {bottomBar}
        </section>

        <aside className={`border-l border-eldritch/15 p-3 space-y-3 overflow-y-auto min-h-0 lg:block ${mtab === 'world' ? 'block flex-1' : 'hidden'}`}>
          <Panel title={en ? 'Scene' : '场景'}>
            <div className="text-sm text-parchment/80">{pub.scene || '—'}</div>
            <div className={`text-xs mt-1 ${pub.safe ? 'text-green-400' : 'text-amber-400'}`}>{pub.safe ? (en ? '🏕️ Safe haven' : '🏕️ 安全区域') : (en ? '⚠️ Dangerous' : '⚠️ 危险区域')}</div>
            {combat?.env && <div className="text-xs text-parchment/50 mt-1">🌫️ {combat.env}</div>}
          </Panel>
          <Panel title={en ? 'Quest' : '任务'}><div className="text-sm text-parchment/75">{pub.quest || '—'}</div></Panel>
          {phase === 'combat' && combat && (
            <Panel title={en ? 'Initiative & Foes' : '先攻 / 敌人'}>
              <div className="flex flex-wrap gap-1 mb-2">{combat.order.map((o: any) => <span key={o.ref} className={`text-[11px] px-2 py-0.5 rounded-full border ${o.ref === combat.current ? 'bg-blood/30 border-blood text-parchment' : 'border-eldritch/25 text-parchment/50'}`}>{o.init} {foeName(o.ref)}</span>)}</div>
              <div className="space-y-1.5">{aliveMonsters.map((m: any) => <div key={m.id} className="rounded-lg border border-eldritch/25 bg-fog/50 px-2 py-1"><div className="text-xs text-parchment flex justify-between">👿 {m.name}<span className="text-[10px] text-parchment/50">AC{m.ac}</span></div><div className="h-1.5 rounded bg-ink mt-0.5 overflow-hidden"><div className="h-full bg-blood" style={{ width: `${Math.max(0, Math.round((m.hp / m.hpMax) * 100))}%` }} /></div><div className="text-[10px] text-parchment/50">HP {m.hp}/{m.hpMax}{(m.statuses || []).length ? ` · ${m.statuses.map((x: any) => x.name).join('/')}` : ''}</div></div>)}</div>
            </Panel>
          )}
          {phase === 'explore' && myChar && pub.safe && (
            <Panel title={en ? 'Town / Supplies' : '城镇 · 补给'}>
              <div className="flex flex-wrap gap-1.5">
                <button onClick={() => call('/api/dnd/item', { roomId: props.room.id, action: 'buy' })} disabled={busy || (myChar.gold || 0) < 25} className="px-2 py-1 rounded bg-fog border border-eldritch/25 text-parchment/80 text-xs disabled:opacity-40">🧪 {en ? 'Buy potion 25g' : '买药水 25金'}</button>
                <button onClick={() => setShop((v) => !v)} className="px-2 py-1 rounded bg-fog border border-eldritch/25 text-parchment/80 text-xs">🛒 {en ? 'Shop' : '商店'}</button>
                {isHost && <>
                  <button onClick={() => call('/api/dnd/rest', { roomId: props.room.id, kind: 'short' })} disabled={busy} className="px-2 py-1 rounded bg-fog border border-eldritch/25 text-parchment/80 text-xs">🏕️ {en ? 'Short rest' : '短休'}</button>
                  <button onClick={() => call('/api/dnd/rest', { roomId: props.room.id, kind: 'long' })} disabled={busy} className="px-2 py-1 rounded bg-fog border border-eldritch/25 text-parchment/80 text-xs">🌙 {en ? 'Long rest' : '长休'}</button>
                </>}
              </div>
              {shop && (
                <div className="mt-2 space-y-1.5 text-[11px]">
                  <div className="text-parchment/50">{en ? 'Weapons' : '武器'}</div>
                  <div className="flex gap-1.5 flex-wrap">{Object.entries(WEAPONS).map(([k, w]: any) => { const owned = (myChar.attacks || []).some((a: any) => a.name === w.cn); return <button key={k} disabled={busy || owned || (myChar.gold || 0) < w.cost} onClick={() => call('/api/dnd/item', { roomId: props.room.id, action: 'buygear', kind: 'weapon', key: k })} className="px-2 py-1 rounded bg-fog border border-eldritch/30 text-parchment/80 disabled:opacity-40">{w.cn} {w.damage}·{w.cost}💰{owned ? '✓' : ''}</button>; })}</div>
                  <div className="text-parchment/50">{en ? 'Armor & Shield' : '护甲与盾'}</div>
                  <div className="flex gap-1.5 flex-wrap">{Object.entries(ARMORS).map(([k, a]: any) => <button key={k} disabled={busy || (myChar.armorBonus || 0) >= a.bonus || (myChar.gold || 0) < a.cost} onClick={() => call('/api/dnd/item', { roomId: props.room.id, action: 'buygear', kind: 'armor', key: k })} className="px-2 py-1 rounded bg-fog border border-eldritch/30 text-parchment/80 disabled:opacity-40">{a.cn} +{a.bonus}AC·{a.cost}💰</button>)}<button disabled={busy || myChar.shield || (myChar.gold || 0) < 15} onClick={() => call('/api/dnd/item', { roomId: props.room.id, action: 'buygear', kind: 'shield' })} className="px-2 py-1 rounded bg-fog border border-eldritch/30 text-parchment/80 disabled:opacity-40">{en ? 'Shield' : '盾牌'} +2AC·15💰{myChar.shield ? '✓' : ''}</button></div>
                </div>
              )}
              {(pub.seats || []).some((seat: string) => pub.chars?.[seat]?.alive === false) && <div className="flex flex-wrap gap-1.5 mt-2">{pub.seats.filter((seat: string) => pub.chars?.[seat]?.alive === false).map((seat: string) => <button key={seat} disabled={busy || (myChar.gold || 0) < 100} onClick={() => call('/api/dnd/item', { roomId: props.room.id, action: 'revive', targetSeat: seat })} className="px-2 py-1 rounded bg-fog border border-eldritch/25 text-parchment/80 text-xs disabled:opacity-40">⛪ {en ? 'Revive' : '复活'} {pub.chars[seat].name} 100💰</button>)}</div>}
            </Panel>
          )}
          {isHost && phase !== 'ended' && <button onClick={() => { if (confirm(en ? 'End the adventure?' : '结束本场冒险？')) call('/api/dnd/end', { roomId: props.room.id }); }} disabled={busy} className="w-full py-1.5 rounded bg-fog border border-parchment/20 text-parchment/50 text-xs">🏁 {en ? 'End adventure' : '结束冒险'}</button>}
        </aside>
      </div>
      <AudioManager state={dndAudioState} />
      {sheet && myChar && <CharSheet c={myChar} en={en} onClose={() => setSheet(false)} />}
    </main>
  );
}

function Panel({ title, children }: { title: string; children: any }) {
  return <div><div className="text-xs text-eldritch/80 mb-1.5 border-b border-eldritch/15 pb-1">{title}</div><div>{children}</div></div>;
}

function DndCharCard({ seat, c, me, turnNow, en }: { seat: string; c: any; me: boolean; turnNow: boolean; en: boolean }) {
  if (!c) return <div className="p-3 rounded-lg bg-fog border border-dashed border-parchment/15 text-xs text-parchment/40">{seat} · {en ? 'creating…' : '建卡中'}</div>;
  const pct = Math.max(0, Math.round((c.hp / c.hpMax) * 100));
  const slot = Object.keys(c.spellSlotsMax || {}).sort().map((lv) => `${lv}环${c.spellSlots?.[lv] || 0}/${c.spellSlotsMax[lv]}`).join(' ');
  return (
    <div className={`p-3 rounded-lg bg-fog border ${turnNow ? 'border-blood bg-blood/10' : me ? 'border-eldritch/50' : 'border-eldritch/25'} ${!c.alive ? 'opacity-50' : ''}`}>
      <div className="flex items-center gap-2 mb-2">
        <div className="w-10 h-10 rounded-full overflow-hidden border border-eldritch/30 bg-ink flex items-center justify-center shrink-0">{c.avatar ? <img src={c.avatar} alt="" className="w-full h-full object-cover" /> : <span className="text-parchment/30 text-xs">{seat}</span>}</div>
        <div className="min-w-0 flex-1"><div className="font-serif text-parchment text-sm truncate">{me ? '★ ' : ''}{c.name}</div><div className="text-[11px] text-parchment/50 truncate">{RACES[c.race]?.cn}{CLASSES[c.cls]?.cn} Lv{c.level}</div></div>
        <span className="text-xs text-parchment/60 shrink-0">AC {c.ac}</span>
      </div>
      <div className="space-y-1.5 text-xs text-parchment/70">
        <div><div className="flex justify-between text-[10px] text-parchment/50"><span>HP</span><span>{c.hp}/{c.hpMax}</span></div><div className="h-1.5 rounded bg-ink overflow-hidden"><div className={`h-full ${pct > 50 ? 'bg-green-600' : pct > 25 ? 'bg-amber-500' : 'bg-blood'}`} style={{ width: `${pct}%` }} /></div></div>
        <div className="grid grid-cols-6 gap-0.5 text-center text-[10px]">{ABILITIES.map((a) => <div key={a}><div className="text-parchment/40">{ABILITY_CN[a]}</div><div className="text-parchment/80">{mod(c.scores[a]) >= 0 ? '+' : ''}{mod(c.scores[a])}</div></div>)}</div>
        <div><span className="text-parchment/40">{en ? 'Wielding: ' : '持握：'}</span>{c.attacks?.[c.equipped || 0]?.name || '—'}{(c.attacks || []).length > 1 ? <span className="text-parchment/40">{en ? ` (+${c.attacks.length - 1} in pack)` : `（背包还有 ${c.attacks.length - 1} 把）`}</span> : null}</div>
        <div><span className="text-parchment/40">{en ? 'Armor: ' : '护甲：'}</span>{c.armorBonus ? `+${c.armorBonus}AC` : (en ? 'none' : '无甲')}{c.shield ? ` · ${en ? 'Shield' : '盾'}` : ''}</div>
        {slot && <div><span className="text-parchment/40">{en ? 'Slots: ' : '法术位：'}</span>{slot}</div>}
        <div><span className="text-parchment/40">{en ? 'Pack: ' : '背包：'}</span>🧪×{c.potions} · 💰{c.gold}</div>
        {(c.statuses?.length || c.conditions?.length || c.rage) ? <div className="text-blood/80">{c.rage ? '🪓狂暴 ' : ''}{[...(c.statuses || []).map((x: any) => x.name), ...(c.conditions || [])].join('/')}</div> : null}
      </div>
    </div>
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
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {c.avatar && <img src={c.avatar} alt="" className="w-12 h-12 rounded-lg object-cover border border-eldritch/30 shrink-0" />}
            <div className="min-w-0">
              <div className="text-lg text-parchment font-serif truncate">{c.name}</div>
              <div className="text-xs text-parchment/60">{RACES[c.race]?.cn}{CLASSES[c.cls]?.cn} · Lv{c.level} · XP {c.xp}</div>
            </div>
          </div>
          <button onClick={onClose} className="text-parchment/50 hover:text-parchment text-lg leading-none shrink-0">✕</button>
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

function LogLine({ l, myName, en }: { l: any; myName?: string; en?: boolean }) {
  const k = l.kind || '';
  const msg = String(l.msg || '');
  if (k === 'act') {
    const body = msg.replace(/^🗨️\s*/, '');
    const i = body.indexOf('：');
    const name = i > 0 ? body.slice(0, i) : '';
    const text = i > 0 ? body.slice(i + 1) : body;
    const mine = !!myName && name === myName;
    return (
      <div className={`flex flex-col ${mine ? 'items-end' : 'items-start'}`}>
        <span className="text-xs text-parchment/40 mb-1">{name}{mine ? ` · ${en ? 'You' : '你'}` : ''}</span>
        <div className={`max-w-[80%] px-4 py-2 rounded-lg leading-relaxed text-parchment/90 border ${mine ? 'bg-blood/25 border-blood/40' : 'bg-eldritch/20 border-eldritch/40'}`}>{text}</div>
      </div>
    );
  }
  if (k === 'dm') {
    return (
      <div className="mx-auto max-w-2xl text-center">
        <div className="text-[11px] uppercase tracking-widest text-eldritch/70 mb-1">{en ? 'Dungeon Master' : '地下城主'}</div>
        <div className="px-4 py-3 rounded-lg bg-eldritch/10 border border-eldritch/30 text-parchment/90 leading-relaxed italic">{msg}</div>
      </div>
    );
  }
  if (['kill', 'win', 'level', 'up'].includes(k)) return <div className="text-center"><span className="inline-block px-3 py-0.5 rounded-full bg-green-900/30 border border-green-700/40 text-green-300 text-xs">{msg}</span></div>;
  if (['down', 'death', 'loss'].includes(k)) return <div className="text-center"><span className="inline-block px-3 py-0.5 rounded-full bg-blood/25 border border-blood/40 text-blood text-xs">{msg}</span></div>;
  if (['roll', 'attack', 'spell', 'combat'].includes(k)) return <div className="text-center text-[12px] text-parchment/45 leading-snug">{msg}</div>;
  return <div className="text-center text-[11px] text-parchment/40">{msg}</div>;
}

function DndStepper({ phase, en }: { phase: string; en: boolean }) {
  const steps = en
    ? [{ k: 'lobby', t: 'Lobby' }, { k: 'select', t: 'Choose quest' }, { k: 'creation', t: 'Create hero' }, { k: 'play', t: 'Adventuring' }, { k: 'ended', t: 'Ending' }]
    : [{ k: 'lobby', t: '等待加入' }, { k: 'select', t: '选择冒险' }, { k: 'creation', t: '创建英雄' }, { k: 'play', t: '正式跑团' }, { k: 'ended', t: '结局' }];
  const cur = phase === 'ended' ? 4 : (phase === 'explore' || phase === 'combat') ? 3 : phase === 'creation' ? 2 : phase === 'select' ? 1 : 0;
  return (
    <div className="w-full border-b border-eldritch/20 bg-fog/40">
      <div className="lg:hidden px-4 py-2 flex items-center gap-2 text-xs"><span className="px-2 py-0.5 rounded-full bg-blood/30 border border-blood text-parchment">{cur + 1}/{steps.length}</span><span className="text-parchment/90">{steps[cur]?.t}</span></div>
      <div className="hidden lg:block overflow-x-auto"><div className="flex items-center gap-1 px-4 py-2.5 min-w-max">
        {steps.map((sp, i) => { const done = i < cur, active = i === cur; return <div key={sp.k} className="flex items-center gap-1"><div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs whitespace-nowrap border ${active ? 'bg-blood/30 border-blood text-parchment' : done ? 'bg-eldritch/20 border-eldritch/40 text-parchment/70' : 'bg-transparent border-parchment/15 text-parchment/35'}`}><span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${active ? 'bg-blood text-parchment' : done ? 'bg-eldritch/60 text-parchment' : 'bg-parchment/10'}`}>{done ? '✓' : i + 1}</span>{sp.t}</div>{i < steps.length - 1 && <span className="text-parchment/20">—</span>}</div>; })}
      </div></div>
    </div>
  );
}

function DndGuide({ scene, quest, options, mySeat, disabled, onPick, en }: { scene: string; quest: string; options: string[]; mySeat: string; disabled: boolean; onPick: (o: string) => void; en: boolean }) {
  const letters = ['A', 'B', 'C', 'D', 'E', 'F'];
  return (
    <div className="mx-auto max-w-2xl mt-1 rounded-lg border border-eldritch/40 bg-fog/60 p-4 space-y-3">
      <div className="grid sm:grid-cols-2 gap-x-4 gap-y-1 text-sm">
        {scene && <div><span className="text-eldritch text-xs">【{en ? 'Location' : '你的位置'}】</span><span className="text-parchment/90"> {scene}</span></div>}
        {quest && <div><span className="text-eldritch text-xs">【{en ? 'Goal' : '你的目标'}】</span><span className="text-parchment/90"> {quest}</span></div>}
      </div>
      <div className="space-y-2">
        <div className="text-eldritch text-xs">【{en ? `You (${mySeat}) can` : `你（${mySeat}）可以选择`}】</div>
        <div className="grid gap-2">
          {options.map((o: string, i: number) => <button key={i} onClick={() => onPick(o)} disabled={disabled} className="text-left px-3 py-2 rounded bg-ink/60 hover:bg-eldritch/25 border border-eldritch/30 text-parchment/90 text-sm disabled:opacity-40"><span className="text-eldritch mr-2">{letters[i] || '·'}.</span>{o}</button>)}
        </div>
        <div className="text-[11px] text-parchment/40">{en ? 'Or type any free action below.' : '或在下方输入框「自由行动」，做任何你想做的事。'}</div>
      </div>
    </div>
  );
}

function spellDesc(sp: any, en: boolean) {
  const kind = sp.kind === 'heal' ? (en ? 'Heal' : '治疗') : sp.kind === 'status' ? (en ? `Control (${sp.status})` : `控制（${sp.status}）`) : (en ? 'Damage' : '伤害');
  return `${sp.level}${en ? '-lvl' : ' 环'} · ${kind}${sp.dice ? ' ' + sp.dice : ''}`;
}

function ItemRow({ icon, name, desc, action }: { icon: string; name: string; desc: string; action?: { label: string; onClick: () => void; disabled?: boolean } | null }) {
  return (
    <div className="rounded-lg bg-fog/60 border border-eldritch/20 p-2">
      <div className="flex items-center justify-between gap-2"><span className="text-parchment/90 text-sm">{icon} {name}</span>{action && <button onClick={action.onClick} disabled={action.disabled} className="text-xs px-2 py-0.5 rounded bg-eldritch/40 text-parchment disabled:opacity-40">{action.label}</button>}</div>
      <div className="text-[11px] text-parchment/50 mt-0.5">{desc}</div>
    </div>
  );
}

function Backpack({ c, en, busy, onUsePotion, onEquip }: { c: any; en: boolean; busy: boolean; onUsePotion: (() => void) | null; onEquip: (idx: number) => void }) {
  if (!c) return <div className="text-xs text-parchment/40">{en ? 'No character yet' : '尚无角色'}</div>;
  return (
    <div className="space-y-2 text-sm">
      <div className="text-xs text-eldritch/80 border-b border-eldritch/15 pb-1">{en ? 'Backpack' : '背包'} · 💰 {c.gold}</div>
      {c.potions > 0 && <ItemRow icon="🧪" name={`${en ? 'Healing Potion' : '治疗药水'} ×${c.potions}`} desc={en ? 'Restores 2d4+2 HP. Usable in or out of combat.' : '饮用恢复 2d4+2 生命，战斗内外皆可。'} action={onUsePotion ? { label: en ? 'Use' : '喝', onClick: onUsePotion, disabled: busy } : null} />}
      <div className="text-xs text-parchment/50 pt-1">{en ? 'Weapons (wield one)' : '武器（一次持握一把）'}</div>
      <div className="text-[10px] text-parchment/35">{en ? 'Tap “Wield” to switch. Armor & shield auto-equip when bought in town.' : '点「装备」切换持握；护甲/盾在城镇商店购买后自动穿戴。'}</div>
      {(c.attacks || []).map((a: any, i: number) => { const eq = (c.equipped || 0) === i; return <ItemRow key={'w' + i} icon={eq ? '🗡️' : '·'} name={`${a.name}${eq ? (en ? ' (wielding)' : '（持握中）') : ''}`} desc={`${en ? 'Damage' : '伤害'} ${a.damage} · ${a.type}（${ABILITY_CN[a.ability as keyof typeof ABILITY_CN] || a.ability}）`} action={eq ? null : { label: en ? 'Wield' : '装备', onClick: () => onEquip(i), disabled: busy }} />; })}
      <div className="text-xs text-parchment/50 pt-1">{en ? 'Armor' : '护甲'}</div>
      <ItemRow icon="🛡️" name={c.armorBonus ? `+${c.armorBonus} AC` : (en ? 'No armor' : '无甲')} desc={`${en ? 'Current AC' : '当前护甲等级'} ${c.ac}${c.shield ? ` · ${en ? 'Shield +2' : '盾牌 +2'}` : ''}`} />
      {((c.cantrips || []).length + (c.knownSpells || []).length) > 0 && <>
        <div className="text-xs text-parchment/50 pt-1">{en ? 'Spells' : '法术'}</div>
        {(c.cantrips || []).map((a: any, i: number) => <ItemRow key={'ct' + i} icon="✨" name={a.name} desc={`${en ? 'Cantrip' : '戏法'} · ${a.damage} ${a.type}`} />)}
        {(c.knownSpells || []).map((k: string) => { const sp = SPELLS[k]; if (!sp) return null; return <ItemRow key={'sp' + k} icon="🔮" name={sp.cn} desc={spellDesc(sp, en)} />; })}
      </>}
    </div>
  );
}
