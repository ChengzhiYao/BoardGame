'use client';
import { useEffect, useRef, useState } from 'react';
import type { ShellProps } from './RoomShell';
import { rollAttributes, derive } from '@/lib/coc/create';
import { SKILLS, baseFor, skillPointPool, SKILL_CAP } from '@/lib/coc/skills';
import { randomInvestigator } from '@/lib/coc/randomChar';
import { ITEMS, MAX_ITEMS } from '@/lib/coc/items';
import { RULE_BRIEFING } from '@/lib/kp/briefing';

async function postStep(roomId: string, step: string, data?: any) {
  const res = await fetch('/api/characters/step', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ roomId, step, data }),
  });
  const d = await res.json();
  if (!res.ok) throw new Error(d.error || '提交失败');
}

export default function CharacterFlow(props: ShellProps) {
  const state = props.room.game_state;
  const myChar = props.initialCharacters.find((c) => c.player_id === props.myPlayerId);
  const myPlayer = props.initialPlayers.find((p) => p.id === props.myPlayerId);

  if (state === 'character_creation')
    return myChar && (myChar.creation_stage || 0) >= 1 ? <Waiting label="资料已提交" chars={props.initialCharacters} need={1} /> : <InfoForm {...props} />;
  if (state === 'attribute_allocation')
    return myChar && (myChar.creation_stage || 0) >= 2 ? <Waiting label="属性已确定" chars={props.initialCharacters} need={2} /> : <AttributeForm {...props} />;
  if (state === 'skill_allocation')
    return myChar && (myChar.creation_stage || 0) >= 3 ? <Waiting label="技能已分配" chars={props.initialCharacters} need={3} /> : <SkillForm {...props} myChar={myChar} />;
  if (state === 'character_confirmation')
    return myChar?.confirmed ? <Waiting label="你已确认" chars={props.initialCharacters} need={4} /> : <ConfirmView {...props} />;
  if (state === 'rule_briefing')
    return myPlayer?.is_ready ? <WaitingReady players={props.initialPlayers} /> : <BriefingView {...props} />;
  return null;
}

function Wrap({ title, desc, children }: any) {
  return (
    <div className="w-full max-w-2xl flex flex-col gap-4">
      <div className="text-center">
        <h1 className="text-xl font-serif text-parchment">{title}</h1>
        {desc && <p className="text-parchment/50 text-sm mt-1">{desc}</p>}
      </div>
      {children}
    </div>
  );
}

function Waiting({ label, chars, need }: { label: string; chars: any[]; need: number }) {
  const done = chars.filter((c) => (c.creation_stage || 0) >= need).length;
  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <div className="w-7 h-7 border-2 border-eldritch/30 border-t-eldritch rounded-full animate-spin" />
      <p className="text-parchment/70">{label}，等待同伴……（{done}/2）</p>
    </div>
  );
}
function WaitingReady({ players }: { players: any[] }) {
  const done = players.filter((p) => p.is_ready).length;
  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <div className="w-7 h-7 border-2 border-eldritch/30 border-t-eldritch rounded-full animate-spin" />
      <p className="text-parchment/70">你已准备就绪，等待同伴……（{done}/2）</p>
    </div>
  );
}

const FIELD = 'px-3 py-2 rounded bg-fog border border-eldritch/30 text-parchment placeholder:text-parchment/30 outline-none focus:border-eldritch w-full';

function InfoForm(props: ShellProps) {
  const [f, setF] = useState<any>({ name: '', gender: '', age: '', occupation: '', personality: '', background: '', personal_goal: '', fear: '', appearance: '', inventory: [] });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const set = (k: string, v: any) => setF((prev: any) => ({ ...prev, [k]: v }));
  const toggleItem = (item: string) => setF((prev: any) => {
    const inv: string[] = prev.inventory || [];
    if (inv.includes(item)) return { ...prev, inventory: inv.filter((x) => x !== item) };
    if (inv.length >= MAX_ITEMS) return prev;
    return { ...prev, inventory: [...inv, item] };
  });

  async function submit() {
    for (const k of ['name', 'age', 'occupation', 'personality', 'background', 'personal_goal', 'fear'])
      if (!String(f[k]).trim()) return setErr('请把所有栏位填完');
    setBusy(true); setErr('');
    try { await postStep(props.room.id, 'info', { ...f, age: Number(f.age) }); }
    catch (e: any) { setErr(e.message); }
    finally { setBusy(false); }
  }

  return (
    <Wrap title={`创建调查员（${props.mySeat}）`} desc="可以点「随机生成」一键填好，再按需修改；也可以全部自己写。">
      <div className="flex justify-center">
        <button type="button" onClick={() => setF(randomInvestigator())}
          className="px-5 py-2 rounded bg-eldritch/40 hover:bg-eldritch/70 text-parchment text-sm border border-eldritch/50">
          🎲 随机生成一个调查员
        </button>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <input className={FIELD} placeholder="姓名" value={f.name} onChange={(e) => set('name', e.target.value)} />
        <select className={FIELD} value={f.gender} onChange={(e) => set('gender', e.target.value)}>
          <option value="">性别（未定）</option>
          <option value="male">男</option>
          <option value="female">女</option>
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <input className={FIELD} placeholder="年龄" value={f.age} onChange={(e) => set('age', e.target.value)} />
        <input className={FIELD} placeholder="职业（如：私家侦探、记者、医生）" value={f.occupation} onChange={(e) => set('occupation', e.target.value)} />
      </div>
      <input className={FIELD} placeholder="外貌特征（影响头像，如：短发、戴眼镜、左眉有疤）" value={f.appearance} onChange={(e) => set('appearance', e.target.value)} />
      <textarea className={FIELD} placeholder="性格" value={f.personality} onChange={(e) => set('personality', e.target.value)} />
      <textarea className={FIELD} placeholder="背景故事" value={f.background} onChange={(e) => set('background', e.target.value)} />
      <input className={FIELD} placeholder="个人目标（你为何而来）" value={f.personal_goal} onChange={(e) => set('personal_goal', e.target.value)} />
      <input className={FIELD} placeholder="恐惧（你最怕什么）" value={f.fear} onChange={(e) => set('fear', e.target.value)} />

      <div>
        <div className="text-sm text-parchment/70 mb-2">随身道具（最多 {MAX_ITEMS} 件，开局后只能使用你带的东西）：已选 {f.inventory?.length || 0}/{MAX_ITEMS}</div>
        <div className="flex flex-wrap gap-2">
          {ITEMS.map((item) => {
            const on = (f.inventory || []).includes(item);
            return (
              <button key={item} type="button" onClick={() => toggleItem(item)}
                className={`px-2.5 py-1 rounded text-xs border ${on ? 'bg-blood/40 border-blood text-parchment' : 'bg-fog border-eldritch/30 text-parchment/60 hover:border-eldritch/60'}`}>
                {item}
              </button>
            );
          })}
        </div>
      </div>

      {err && <p className="text-blood text-sm">{err}</p>}
      <button onClick={submit} disabled={busy} className="self-center px-6 py-2.5 rounded bg-blood/80 hover:bg-blood text-parchment disabled:opacity-50">
        {busy ? '提交中…' : '提交资料'}
      </button>
    </Wrap>
  );
}

const ATTR_LABELS: [string, string][] = [
  ['str', '力量 STR'], ['con', '体质 CON'], ['dex', '敏捷 DEX'], ['app', '外貌 APP'],
  ['pow', '意志 POW'], ['int_attr', '智力 INT'], ['edu', '教育 EDU'], ['siz', '体型 SIZ'],
];

function AttributeForm(props: ShellProps) {
  const [attrs, setAttrs] = useState(() => rollAttributes());
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const d = derive(attrs);

  async function submit() {
    setBusy(true); setErr('');
    try {
      await postStep(props.room.id, 'attributes', {
        ...attrs,
        hp_max: d.hp_max, hp_current: d.hp_current,
        san_max: d.san_max, san_current: d.san_current, san_start: d.san_start,
        luck: d.luck, mov: d.mov, db: d.db, build: d.build,
      });
    } catch (e: any) { setErr(e.message); setBusy(false); }
  }

  return (
    <Wrap title="分配属性" desc="点击「重掷」生成一组属性（3D6 法）。满意后确定。">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {ATTR_LABELS.map(([k, label]) => (
          <div key={k} className="p-3 rounded bg-fog border border-eldritch/30 text-center">
            <div className="text-xs text-parchment/50">{label}</div>
            <div className="text-2xl font-serif text-parchment">{(attrs as any)[k]}</div>
          </div>
        ))}
      </div>
      <div className="flex justify-center gap-6 text-sm text-parchment/70">
        <span>HP {d.hp_max}</span><span>SAN {d.san_current}</span><span>幸运 {d.luck}</span><span>MOV {d.mov}</span><span>DB {d.db}</span>
      </div>
      {err && <p className="text-blood text-sm text-center">{err}</p>}
      <div className="flex justify-center gap-3">
        <button onClick={() => setAttrs(rollAttributes())} disabled={busy} className="px-5 py-2 rounded bg-fog border border-eldritch/40 text-parchment hover:bg-eldritch/20 disabled:opacity-50">重掷</button>
        <button onClick={submit} disabled={busy} className="px-6 py-2 rounded bg-blood/80 hover:bg-blood text-parchment disabled:opacity-50">{busy ? '确定中…' : '确定属性'}</button>
      </div>
    </Wrap>
  );
}

function SkillForm(props: ShellProps & { myChar: any }) {
  const char = props.myChar || {};
  const pool = skillPointPool(char);
  const [alloc, setAlloc] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const used = Object.values(alloc).reduce((a, b) => a + b, 0);
  const remaining = pool - used;

  function change(name: string, base: number, delta: number) {
    const cur = alloc[name] || 0;
    let next = cur + delta;
    if (next < 0) next = 0;
    if (base + next > SKILL_CAP) next = SKILL_CAP - base;
    if (delta > 0 && remaining - (next - cur) < 0) return;
    setAlloc({ ...alloc, [name]: next });
  }

  async function submit() {
    setBusy(true); setErr('');
    const skills: any = {};
    for (const def of SKILLS) {
      const base = baseFor(def, char);
      const added = alloc[def.name] || 0;
      skills[def.name] = { base, occupation: added, interest: 0, total: base + added };
    }
    try { await postStep(props.room.id, 'skills', { skills }); }
    catch (e: any) { setErr(e.message); setBusy(false); }
  }

  return (
    <Wrap title="分配技能" desc={`技能点池 ${pool}，剩余 ${remaining}。单项上限 ${SKILL_CAP}。`}>
      <div className="grid sm:grid-cols-2 gap-2 max-h-[50vh] overflow-y-auto pr-1">
        {SKILLS.map((def) => {
          const base = baseFor(def, char);
          const added = alloc[def.name] || 0;
          return (
            <div key={def.name} className="flex items-center justify-between px-3 py-2 rounded bg-fog border border-eldritch/20">
              <span className="text-sm text-parchment/80">{def.name}</span>
              <div className="flex items-center gap-2">
                <button onClick={() => change(def.name, base, -5)} className="w-6 h-6 rounded bg-ink text-parchment/70">−</button>
                <span className="w-10 text-center text-parchment">{base + added}</span>
                <button onClick={() => change(def.name, base, +5)} className="w-6 h-6 rounded bg-ink text-parchment/70">+</button>
              </div>
            </div>
          );
        })}
      </div>
      <div className={`text-center text-sm ${remaining < 0 ? 'text-blood' : 'text-parchment/60'}`}>剩余技能点：{remaining}</div>
      {err && <p className="text-blood text-sm text-center">{err}</p>}
      <button onClick={submit} disabled={busy} className="self-center px-6 py-2 rounded bg-blood/80 hover:bg-blood text-parchment disabled:opacity-50">{busy ? '提交中…' : '完成技能分配'}</button>
    </Wrap>
  );
}

function ConfirmView(props: ShellProps) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [avatarErr, setAvatarErr] = useState('');
  const nameOfUser = (uid?: string) => props.initialUsers.find((u) => u.id === uid)?.display_name || '调查员';
  const myChar = props.initialCharacters.find((c) => c.player_id === props.myPlayerId);
  const triggered = useRef(false);

  // 进入确认页：若我的角色还没头像，自动生成一次（套全局风格）
  useEffect(() => {
    if (myChar && !myChar.avatar_url && !triggered.current) {
      triggered.current = true;
      genAvatar();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myChar?.id]);

  async function genAvatar() {
    setAvatarBusy(true); setAvatarErr('');
    try {
      const res = await fetch('/api/characters/avatar', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId: props.room.id }),
      });
      const d = await res.json();
      if (!res.ok) setAvatarErr(d.error || '头像生成失败');
    } catch (e: any) { setAvatarErr(e.message); }
    finally { setAvatarBusy(false); }
  }

  async function confirm() {
    setBusy(true); setErr('');
    try { await postStep(props.room.id, 'confirm'); }
    catch (e: any) { setErr(e.message); setBusy(false); }
  }

  return (
    <Wrap title="确认角色卡" desc="头像会按统一画风自动生成。两位都确认后，守秘人将讲解规则并开场。">
      <div className="grid md:grid-cols-2 gap-4">
        {['A', 'B'].map((seat) => {
          const p = props.initialPlayers.find((x) => x.seat === seat);
          const c = props.initialCharacters.find((x) => x.player_id === p?.id);
          const isMine = p?.id === props.myPlayerId;
          return (
            <div key={seat} className={`p-4 rounded-lg bg-fog border ${seat === 'A' ? 'border-eldritch/40' : 'border-blood/40'}`}>
              <div className="flex items-center gap-3 mb-2">
                <Avatar url={c?.avatar_url} loading={isMine && avatarBusy} seat={seat} />
                <div className="font-serif text-lg text-parchment">{c?.name || nameOfUser(p?.user_id)}（{seat}）</div>
              </div>
              {c ? (
                <div className="text-xs text-parchment/70 space-y-1">
                  <div>{c.age} 岁 · {c.occupation}</div>
                  <div>HP {c.hp_max} ｜ SAN {c.san_current} ｜ 幸运 {c.luck}</div>
                  <div>STR{c.str} CON{c.con} DEX{c.dex} APP{c.app}</div>
                  <div>POW{c.pow} INT{c.int_attr} EDU{c.edu} SIZ{c.siz}</div>
                  <div className="text-parchment/50 pt-1">目标：{c.personal_goal}</div>
                  <div className="text-parchment/50">恐惧：{c.fear}</div>
                  <div className="pt-1">{c.confirmed ? <span className="text-green-400">已确认 ✓</span> : <span className="text-parchment/40">待确认</span>}</div>
                </div>
              ) : <div className="text-xs text-parchment/40">尚未完成</div>}
            </div>
          );
        })}
      </div>
      {myChar && !myChar.avatar_url && !avatarBusy && (
        <button onClick={genAvatar} className="self-center text-sm text-eldritch hover:text-parchment underline">头像没出来？点此重试生成</button>
      )}
      {avatarErr && <p className="text-blood text-xs text-center">头像生成失败：{avatarErr}</p>}
      {err && <p className="text-blood text-sm text-center">{err}</p>}
      <button onClick={confirm} disabled={busy} className="self-center px-6 py-2.5 rounded bg-blood/80 hover:bg-blood text-parchment disabled:opacity-50">{busy ? '确认中…' : '确认我的角色卡'}</button>
    </Wrap>
  );
}

function Avatar({ url, loading, seat }: { url?: string; loading?: boolean; seat: string }) {
  const ring = seat === 'A' ? 'border-eldritch/50' : 'border-blood/50';
  return (
    <div className={`w-14 h-14 rounded-full overflow-hidden border-2 ${ring} bg-ink flex items-center justify-center shrink-0`}>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="w-full h-full object-cover" />
      ) : loading ? (
        <div className="w-5 h-5 border-2 border-eldritch/30 border-t-eldritch rounded-full animate-spin" />
      ) : (
        <span className="text-parchment/30 text-xs">{seat}</span>
      )}
    </div>
  );
}

function BriefingView(props: ShellProps) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  async function ack() {
    setBusy(true); setErr('');
    try { await postStep(props.room.id, 'briefing_ack'); }
    catch (e: any) { setErr(e.message); setBusy(false); }
  }
  return (
    <Wrap title="守秘人的提醒">
      <div className="p-5 rounded-lg bg-eldritch/10 border border-eldritch/30 text-parchment/85 leading-relaxed whitespace-pre-line">
        {RULE_BRIEFING}
      </div>
      {err && <p className="text-blood text-sm text-center">{err}</p>}
      <button onClick={ack} disabled={busy} className="self-center px-6 py-2.5 rounded bg-blood/80 hover:bg-blood text-parchment disabled:opacity-50">{busy ? '请稍候…' : '准备好了，开始调查'}</button>
    </Wrap>
  );
}
