'use client';
import { toast, ask } from '@/components/Toast';
import Narration from '@/components/Narration';
import MicButton from '@/components/MicButton';
import CompanionWaiting from '@/components/CompanionWaiting';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { ShellProps } from './RoomShell';
import { useTTS } from './useTTS';
import { Sheet, SheetLabel } from './ui';
import PosterCard from './PosterCard';
import { pickLook, RoleCard, ScriptPaper, ActTitle } from './JbsLook';

const EN = (l?: string) => l === 'en';
const ACTS_ZH = ['', '案件开场', '搜证', '人物关系', '关键证据', '推理讨论', '最终指认', '真相揭晓'];
const ACTS_EN = ['', 'Opening', 'Investigate', 'Relationships', 'Key Evidence', 'Discussion', 'Accusation', 'Reveal'];

const fresh = (m: any) => !!m?.created_at && Date.now() - new Date(m.created_at).getTime() < 90000;
export default function JbsRoom(props: ShellProps) {
  const router = useRouter();
  const supabase = useRef(createClient()).current;
  const lang = props.room.language || 'zh';
  const en = EN(lang);
  const [messages, setMessages] = useState<any[]>(props.initialMessages);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [headcount, setHeadcount] = useState(6);
  const [pace, setPace] = useState<number>(6);
  const [short, setShort] = useState(true);
  const [now, setNow] = useState(Date.now());
  const [showCustom, setShowCustom] = useState(false);
  const [custom, setCustom] = useState<Record<string, string>>({});
  const [friends, setFriends] = useState('');
  const [occasion, setOccasion] = useState('');
  const [needCustomPay, setNeedCustomPay] = useState(false);
  // 付完定制券回来：把刚才填的朋友名单恢复，并打开面板
  useEffect(() => {
    try {
      const dr = JSON.parse(localStorage.getItem('mn_custom_draft') || 'null');
      if (dr && typeof window !== 'undefined' && /[?&]paid=1/.test(window.location.search)) { setFriends(dr.friends || ''); setOccasion(dr.occasion || ''); setCustom(dr.custom || {}); setShowCustom(true); localStorage.removeItem('mn_custom_draft'); }
    } catch {}
  }, []);
  const [sheet, setSheet] = useState<null | 'role' | 'clues' | 'cast' | 'map'>(null);
  const [talkTo, setTalkTo] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [playing, setPlaying] = useState<string | null>(null);
  const [pickVote, setPickVote] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  useTTS({
    lang: props.room.language,
    messages,
    roomId: props.room.id,
    classify: (m: any) => {
      const t = m.payload?.type;
      if (t === 'jbs_dm') return { kind: 'narrator' as const, text: m.content, audio: m.payload?.audio };
      if (t === 'jbs_whisper' && m.payload?.from === 'them') return { kind: 'character' as const, name: m.payload?.with, gender: m.payload?.gender === 'female' ? 'female' as const : 'male' as const, text: m.content };
      if (t === 'jbs_ai') {
        const nm = m.payload?.name;
        const g = (props.jbsCharacters || []).find((c: any) => c.name === nm)?.gender;
        return { kind: 'character' as const, name: nm, gender: g === 'female' ? 'female' as const : 'male' as const, text: m.content };
      }
      return null;
    },
  });
  const bottomRef = useRef<HTMLDivElement>(null);

  const phase = props.room.jbs_phase as string | undefined;
  const act = props.room.jbs_act || 1;
  const generating = props.room.modules_generating;
  const isHost = props.room.host_user_id === props.userId;
  const chars = props.jbsCharacters || [];
  const objectives: any[] = props.jbsObjectives || [];
  const myChar = chars.find((c: any) => c.assigned_seat === props.mySeat);
  const inviteUrl = `${typeof window !== 'undefined' ? window.location.origin : props.siteUrl}/join/${props.inviteToken}`;
  const roleMsgs = messages.filter((m) => m.payload?.type === 'jbs_role');
  const clueList = messages.filter((m) => m.payload?.type === 'jbs_evidence' || m.payload?.type === 'private');
  const keyFound = messages.some((m: any) => m.payload?.type === 'jbs_evidence' && m.payload?.key && m.turn_no === (props.room.jbs_act || 1));
  const resources: any[] = Array.isArray(props.room.jbs_resources) ? props.room.jbs_resources : [];
  // 真人发言显示其角色名（按座位映射）
  const seatByPid: Record<string, string> = {};
  (props.initialPlayers || []).forEach((p: any) => { seatByPid[p.id] = p.seat; });
  const charNameBySeat: Record<string, string> = {};
  (props.jbsCharacters || []).forEach((c: any) => { if (c.assigned_seat) charNameBySeat[c.assigned_seat] = c.name; });
  function speakerOf(m: any): string {
    if (!m.sender_player_id) return '';
    const seat = seatByPid[m.sender_player_id];
    const p = (props.initialPlayers || []).find((x: any) => x.id === m.sender_player_id);
    const dn = p ? (props.initialUsers || []).find((u: any) => u.id === p.user_id)?.display_name : '';
    return charNameBySeat[seat] || dn || (en ? 'Player' : '玩家');
  }
  // 本幕倒计时
  const totalActs = props.room.jbs_total_acts || 7;
  const actNames: string[] = Array.isArray(props.room.jbs_act_names) ? props.room.jbs_act_names : [];
  const actName = actNames[act - 1] || (en ? ACTS_EN[act] || '' : ACTS_ZH[act] || '');
  const actMin = props.room.jbs_act_minutes || 6;
  const actStart = props.room.jbs_act_started_at ? new Date(props.room.jbs_act_started_at).getTime() : 0;
  const remainMs = actStart ? Math.max(0, actStart + actMin * 60000 - now) : 0;
  const mmss = `${String(Math.floor(remainMs / 60000)).padStart(2, '0')}:${String(Math.floor((remainMs % 60000) / 1000)).padStart(2, '0')}`;

  useEffect(() => {
    const ch = supabase.channel(`jbs-msgs-${props.room.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `room_id=eq.${props.room.id}` },
        (payload: any) => { setMessages((prev) => prev.some((m) => m.id === payload.new.id) ? prev : [...prev, payload.new]); if (payload.new?.payload?.type === 'jbs_objupd') router.refresh(); })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [props.room.id, supabase, router]);

  useEffect(() => { setMessages((prev) => { const ids = new Set(prev.map((m) => m.id)); const add = props.initialMessages.filter((m) => !ids.has(m.id)); return add.length ? [...prev, ...add] : prev; }); }, [props.initialMessages]);

  // 轮询兜底：被邀请的匿名玩家realtime可能被RLS过滤而收不到推送，这里每隔几秒主动拉一次消息与房间阶段，保证两边同步。
  useEffect(() => {
    const tick = async () => {
      if (typeof document !== 'undefined' && document.hidden) return;
      const { data } = await supabase.from('messages').select('*').eq('room_id', props.room.id).order('created_at', { ascending: true }).limit(300);
      if (data) setMessages((prev) => { const ids = new Set(prev.map((m) => m.id)); const add = data.filter((m: any) => !ids.has(m.id)); return add.length ? [...prev, ...add] : prev; });
      const { data: r } = await supabase.from('rooms').select('jbs_phase, jbs_act, game_state').eq('id', props.room.id).maybeSingle();
      if (r && (r.jbs_phase !== props.room.jbs_phase || r.jbs_act !== props.room.jbs_act || r.game_state !== props.room.game_state)) router.refresh();
    };
    const id = setInterval(tick, 4000);
    return () => clearInterval(id);
  }, [props.room.id, props.room.jbs_phase, props.room.jbs_act, props.room.game_state, supabase, router]);

  // 倒计时每秒走字
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id); }, []);

  // 时间到 → 房主端自动推进本幕（每幕只触发一次）
  const autoAdv = useRef(0);
  useEffect(() => {
    const isHostNow = props.room.host_user_id === props.userId;
    if (!isHostNow || props.room.jbs_phase !== 'playing' || !actStart) return;
    if (remainMs > 0 || busy) return;
    if (autoAdv.current === props.room.jbs_act) return;
    autoAdv.current = props.room.jbs_act;
    advance(false, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remainMs, props.room.jbs_phase, props.room.jbs_act]);

  // 自动生成角色头像：开本后房主端自动出图，无需点击；分批补齐直到全部完成。
  const autoAvatar = useRef(false);
  useEffect(() => {
    const isHostNow = props.room.host_user_id === props.userId;
    const phaseNow = props.room.jbs_phase;
    const list = props.jbsCharacters || [];
    if (!isHostNow || !['playing', 'vote', 'reveal'].includes(phaseNow || '') || list.length === 0) return;
    if (!list.some((c: any) => !c.avatar_url) || autoAvatar.current) return;
    autoAvatar.current = true; // 每次进房只自动出一批，避免反复触发烧额度；剩余可手动补
    genAvatars(false, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.room.jbs_phase, props.jbsCharacters]);

  const stage = props.room.jbs_stage || null;
  const sceneArt = useRef(false);
  useEffect(() => {
    if (!isHost || sceneArt.current || props.room.jbs_phase !== 'playing') return;
    if (!stage?.scenes?.length || stage.scenes.every((x: any) => x.image)) return;
    sceneArt.current = true;
    fetch('/api/jbs/scenes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ roomId: props.room.id }) }).then(() => router.refresh()).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHost, props.room.jbs_phase, stage?.scenes?.length]);
  const evFired = useRef(0);
  useEffect(() => {
    if (!isHost || props.room.jbs_phase !== 'playing' || !actStart) return;
    if (stage?.events?.[act] || evFired.current === act) return;
    if (remainMs > actMin * 60000 * 0.55) return;
    evFired.current = act;
    fetch('/api/jbs/event', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ roomId: props.room.id }) }).then(() => router.refresh()).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remainMs, act, isHost, props.room.jbs_phase]);

  async function call(url: string, body: any) {
    setBusy(true);
    try {
      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const d = await res.json();
      if (!res.ok) { toast(d.error || (en ? 'Error' : '出错了')); return null; }
      return d;
    } catch (e: any) { toast((en ? 'Failed: ' : '失败：') + e.message); return null; }
    finally { setBusy(false); }
  }

  // Linger 伴侣邀请的局:TA 生成剧本、按口味挑一个,然后开本
  const compStep = useRef('');
  useEffect(() => {
    const comp = props.room.companion;
    if (!comp?.name || !isHost || props.room.modules_generating) return;
    const ph = props.room.jbs_phase || 'lobby';
    const post = (u: string, b: any) => fetch(u, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) }).then((r) => r.json()).catch(() => null);
    if ((ph === 'lobby' || !props.room.jbs_phase) && compStep.current !== 'gen') {
      compStep.current = 'gen';
      post('/api/jbs/scripts', { roomId: props.room.id, headcount: comp.picks?.headcount || 5, customDirection: null }).then(() => router.refresh());
    } else if (ph === 'script' && (props.room.jbs_options || []).length && compStep.current !== 'pick') {
      compStep.current = 'pick';
      post('/api/linger/pick', { roomId: props.room.id }).then((d) => { if (d?.scriptId) setTimeout(() => post('/api/jbs/start', { roomId: props.room.id, scriptId: d.scriptId, actMinutes: 9 }).then(() => router.refresh()), 3000); });
    }
  }, [isHost, props.room.jbs_phase, (props.room.jbs_options || []).length, props.room.modules_generating]);

  async function genScripts(dir?: Record<string, any> | null) {
    let d: any = dir || null;
    if (d && friends.trim()) {
      const people = friends.split('\n').map((l) => l.trim()).filter(Boolean).slice(0, 8).map((l) => { const m = l.split(/[:：—\-–]/); return { name: m[0].trim().slice(0, 20), note: m.slice(1).join(' ').trim().slice(0, 120) }; });
      d = { ...d, people, occasion: occasion.trim() };
    }
    setBusy(true);
    try {
      const res = await fetch('/api/jbs/scripts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ roomId: props.room.id, headcount, customDirection: d }) });
      const j = await res.json().catch(() => ({}));
      if (res.status === 402 && j?.reason === 'custom_pay') { setNeedCustomPay(true); return; }
      if (!res.ok) { toast(j.error || (en ? 'Error' : '出错了')); return; }
      setShowCustom(false); setNeedCustomPay(false);
    } catch (e: any) { toast((en ? 'Failed: ' : '失败：') + e.message); }
    finally { setBusy(false); }
  }
  async function buyCustom() {
    try {
      const r = await fetch('/api/billing/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ plan: 'custom1', returnTo: window.location.pathname }) });
      const d = await r.json(); if (d.url) { try { localStorage.setItem('mn_custom_draft', JSON.stringify({ friends, occasion, custom })); } catch {} window.location.href = d.url; } else toast(d.error || (en ? 'Could not open checkout' : '没能打开支付'));
    } catch { toast(en ? 'Network error' : '网络错误'); }
  }

  const TYPE_OPTS = en
    ? [['', 'Any'], ['推理', 'Murder Mystery'], ['情感', 'Emotional'], ['欢乐', 'Comedy'], ['阵营', 'Faction'], ['恐怖', 'Horror'], ['还原', 'Reconstruction'], ['机制', 'Mechanism/Economy']]
    : [['', '不限'], ['推理', '推理凶案'], ['情感', '情感'], ['欢乐', '欢乐'], ['阵营', '阵营对抗'], ['恐怖', '恐怖'], ['还原', '还原'], ['机制', '机制/经济']];

  const field = 'w-full px-3.5 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-[#efe6d2] text-[14px] placeholder:text-parchment/30 outline-none focus:border-[#c9a96e]/50';
  const customPanel = (
    <div className="space-y-4 text-left">
      <div className="rounded-2xl border border-[#f2a65a]/35 bg-[#f2a65a]/[0.06] p-4 space-y-2.5">
        <div className="flex items-center justify-between"><span className="font-serif text-[15.5px] text-[#fbe7cf]">{en ? 'Write your friends into it' : '把朋友写进剧本'}</span><span className="text-[11px] px-2 py-0.5 rounded-full border border-[#f2a65a]/45 text-[#f6c48c]">{en ? 'Custom · $9.9' : '定制 · $9.9'}</span></div>
        <p className="text-[12px] text-[#fbe7cf]/60 leading-relaxed">{en ? 'Birthdays, bachelor nights, team events — every character is one of you, with your nicknames and inside jokes.' : '生日、婚前派对、团建——每个角色都是你们自己，带上外号和只有你们懂的梗。'}</p>
        <textarea value={friends} onChange={(e) => setFriends(e.target.value)} rows={4} placeholder={en ? 'One per line: name — a trait or inside joke\nAmy — always late, swears she isn’t\nLeo — the group’s fake detective' : '一行一个：名字 —— 特点或梗\n小美 —— 永远迟到但死不承认\n阿杰 —— 群里的"名侦探"'} className={field} />
        <input value={occasion} onChange={(e) => setOccasion(e.target.value)} placeholder={en ? 'Occasion (optional): Amy’s 30th birthday' : '场合（可选）：小美 30 岁生日'} className={field} />
        {needCustomPay && (
          <button onClick={buyCustom} className="w-full h-11 rounded-xl bg-[#f2a65a] text-[#1e1308] text-[14.5px] font-medium">{en ? 'Get a custom script · $9.9' : '买一张定制券 · $9.9'}</button>
        )}
      </div>
      <p className="text-[12.5px] text-parchment/45 leading-relaxed">{en ? 'Only shapes theme, era and mood — never the truth, the killer or hidden roles.' : '只影响题材、时代和氛围，不会让你提前知道真相、凶手或隐藏身份。'}</p>
      <div>
        <SheetLabel>{en ? 'TYPE' : '本型'}</SheetLabel>
        <div className="flex flex-wrap gap-2">{TYPE_OPTS.map(([v, l]) => (
          <button key={v} onClick={() => setCustom({ ...custom, type: v })} className={`h-9 px-3.5 rounded-full border text-[13px] ${((custom.type || '') === v) ? 'border-[#c9a96e]/70 bg-[#c9a96e]/15 text-[#efe6d2]' : 'border-white/10 text-parchment/60'}`}>{l}</button>
        ))}</div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <input value={custom.era || ''} onChange={(e) => setCustom({ ...custom, era: e.target.value })} placeholder={en ? 'Era, e.g. 1930s' : '时代，比如民国'} className={field} />
        <input value={custom.place || ''} onChange={(e) => setCustom({ ...custom, place: e.target.value })} placeholder={en ? 'Place, e.g. a cruise ship' : '地点，比如豪华游轮'} className={field} />
      </div>
      <textarea value={custom.theme || ''} onChange={(e) => setCustom({ ...custom, theme: e.target.value })} rows={3} placeholder={en ? 'The story you want — people, setup, twist…' : '你想要的故事——人物、设定、反转……'} className={field} />
      <input value={custom.forbidden || ''} onChange={(e) => setCustom({ ...custom, forbidden: e.target.value })} placeholder={en ? 'Avoid, e.g. nothing too gory' : '不想要的，比如别太血腥'} className={field} />
      <button onClick={() => genScripts(custom)} disabled={busy || generating} className="w-full h-12 rounded-xl bg-[#7d1d1d] border border-[#a83232]/60 text-[#f2ead9] font-serif tracking-[.12em] disabled:opacity-50">
        {busy || generating ? (en ? 'Writing…' : '正在写…') : friends.trim() ? (en ? 'Write our custom script' : '写我们的定制本') : (en ? 'Write it this way' : '按这个方向写')}
      </button>
    </div>
  );
  async function startScript(id: string) { await call('/api/jbs/start', { roomId: props.room.id, scriptId: id, actMinutes: pace, short }); }
  async function act_(content: string) { const c = content.trim(); if (!c) return; setText(''); await call('/api/jbs/act', { roomId: props.room.id, content: c }); if (props.room.companion?.name) fetch('/api/linger/react', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ roomId: props.room.id }) }).catch(() => {}); }
  async function advance(toVote?: boolean, auto?: boolean) { const r = await call('/api/jbs/advance', { roomId: props.room.id, toVote: !!toVote, auto: !!auto }); if (r) router.refresh(); }
  async function vote(target: string) { const r = await call('/api/jbs/vote', { roomId: props.room.id, target }); if (r) setPickVote(null); }
  async function settle() { if (!(await ask(en ? 'Reveal the ending / settle now?' : '现在揭晓结局 / 结算本局？'))) return; await call('/api/jbs/settle', { roomId: props.room.id }); }
  async function genAvatars(force?: boolean, silent?: boolean) {
    const r = silent
      ? await fetch('/api/jbs/avatars', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ roomId: props.room.id, force: !!force }) }).then((x) => x.json()).catch(() => null)
      : await call('/api/jbs/avatars', { roomId: props.room.id, force: !!force });
    if (r?.ok) { router.refresh(); if (!silent && r.remaining > 0) toast(en ? `Generated ${r.done}, ${r.remaining} left — click again to finish.` : `已生成 ${r.done} 张，还剩 ${r.remaining} 张，再点一次补齐。`); }
    return r;
  }
  async function replay() {
    setResetting(true);
    try {
      const res = await fetch('/api/rooms/replay', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ roomId: props.room.id }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { toast(d.error || (en ? 'Error' : '出错了')); setResetting(false); return; }
      if (typeof window !== 'undefined') window.location.reload();
    } catch (e: any) { toast((en ? 'Failed: ' : '失败：') + e.message); setResetting(false); }
  }

  // ===== 和 Linger 伴侣的局:TA 在挑本、开本,不显示大厅/选本 =====
  if (props.room.companion?.name && (!phase || phase === 'lobby' || phase === 'script' || phase === 'locking' || phase === 'revealing')) {
    return <CompanionWaiting comp={props.room.companion} en={en} title={en ? `${props.room.companion.name} is picking a script…` : `${props.room.companion.name} 正在挑剧本…`} sub={en ? 'You two will each get a role. Read it carefully — someone is lying.' : '你们每人会拿到一个角色。仔细读你的剧本——有人在说谎。'} />;
  }

  const customSheet = (
    <Sheet open={showCustom} onClose={() => setShowCustom(false)} title={en ? 'Write to my taste' : '按我的口味写'}>{customPanel}</Sheet>
  );

  // ===== 大厅：一个大按钮直接开始，其余收起来 =====
  if (!phase || phase === 'lobby') {
    const count = props.initialPlayers.length;
    const Seg = ({ opts, val, set }: { opts: [number, string][]; val: number; set: (n: number) => void }) => (
      <div className="flex p-1 rounded-xl bg-white/[0.04] border border-white/[0.08]">
        {opts.map(([v, l]) => <button key={v} onClick={() => set(v)} className={`flex-1 h-8 rounded-lg text-[13px] transition ${val === v ? 'bg-[#c9a96e]/20 text-[#efe6d2]' : 'text-parchment/50'}`}>{l}</button>)}
      </div>
    );
    return (
      <main className="min-h-[100svh] flex flex-col items-center justify-center px-5 pb-10" style={{ paddingTop: 'calc(max(10px, env(safe-area-inset-top)) + 56px)' }}>
        <div className="w-full max-w-sm flex flex-col items-center text-center">
          <div className="text-[10.5px] tracking-[.45em] pl-[.45em] text-[#c0453f]/85">{en ? 'MURDER MYSTERY' : '剧本杀'}</div>
          <h1 className="mt-3 font-serif font-semibold text-[29px] text-[#efe6d2]">{en ? 'One body. A room of suspects.' : '一具尸体，一屋子嫌疑人'}</h1>
          <p className="mt-4 font-serif text-[15px] leading-[1.9] text-parchment/75">{en ? <>Everyone gets a secret role; AI plays the rest.<br />Search, question, and name the killer.</> : <>每人拿一份秘密剧本，AI 扮演其余角色。<br />搜证、对质，最后指认真凶。</>}</p>
          <div className="mt-5 flex items-center gap-2.5 text-[12px] tracking-wider text-parchment/50">
            <span>{short ? (en ? '~25 min' : '约 25 分钟') : (en ? '~1 hour' : '约 1 小时')}</span><span className="w-[3px] h-[3px] rotate-45 bg-[#c9a96e]/60" /><span>{en ? 'Solo is fine' : '一个人也能开本'}</span><span className="w-[3px] h-[3px] rotate-45 bg-[#c9a96e]/60" /><span>{en ? `${count}/8 seated` : `已入座 ${count}/8`}</span>
          </div>
          <button onClick={() => genScripts()} disabled={busy || generating} className="mt-8 w-full py-3.5 rounded-xl bg-[#7d1d1d] hover:bg-[#8e2323] border border-[#a83232]/60 text-[#f2ead9] font-serif font-semibold tracking-[.2em] text-[17px] shadow-[0_10px_40px_-10px_rgba(125,29,29,.7)] disabled:opacity-60">
            {busy || generating ? (en ? 'Picking scripts…' : '正在挑本……') : count <= 1 ? (en ? 'Begin' : '开始') : (en ? `Begin with ${count}` : `${count} 人开始`)}
          </button>
          {count < 8 && (
            <div className="mt-4 w-full flex items-center gap-2 rounded-xl border border-[#d8c7a8]/[0.13] bg-[#0b0c0f]/60 px-4 py-2.5 text-left">
              <span className="flex-1 text-[13px] text-parchment/70">{en ? 'Bring friends' : '叫朋友一起'} <span className="text-parchment/35">· {en ? 'AI fills the rest' : '其余 AI 补位'}</span></span>
              <button onClick={() => { navigator.clipboard.writeText(inviteUrl); setCopied(true); setTimeout(() => setCopied(false), 1500); }} className="shrink-0 text-[13px] text-[#c9a96e] border-b border-[#c9a96e]/40">{copied ? (en ? 'Copied' : '已复制') : (en ? 'Copy link' : '复制链接')}</button>
              <button onClick={() => { try { (navigator as any).share ? (navigator as any).share({ title: 'MystNight', url: inviteUrl }) : navigator.clipboard.writeText(inviteUrl); } catch {} }} className="shrink-0 ml-2 text-[13px] text-parchment/60">{en ? 'Share' : '分享'}</button>
            </div>
          )}
          <div className="mt-5 flex items-center justify-center gap-5 text-[13px]">
            <button onClick={() => setShowSettings((v) => !v)} className="text-parchment/50 hover:text-parchment">{en ? 'Length, cast & pace' : '长度、人数和节奏'} {showSettings ? '▴' : '▾'}</button>
            <span className="w-px h-3 bg-parchment/15" />
            <button onClick={() => setShowCustom(true)} className="text-parchment/50 hover:text-parchment">{en ? 'Write to my taste' : '按我的口味写'}</button>
          </div>
          <button onClick={() => setShowCustom(true)} className="mt-4 w-full rounded-xl border border-[#f2a65a]/35 bg-[#f2a65a]/[0.06] px-4 py-3 flex items-center gap-3 text-left">
            <span className="text-[20px]">🎂</span>
            <span className="flex-1 min-w-0"><span className="block text-[14px] text-[#fbe7cf]">{en ? 'A script starring your friends' : '定制一个主角是你们的剧本'}</span><span className="block text-[11.5px] text-[#fbe7cf]/55">{en ? 'Birthdays · parties · team events' : '生日 · 聚会 · 团建'}</span></span>
            <span className="text-[13px] text-[#f6c48c]">$9.9 ›</span>
          </button>
          {showSettings && (
            <div className="mt-4 w-full space-y-3 text-left nf-in">
              <div><div className="text-[11px] tracking-[.2em] text-parchment/40 mb-1.5">{en ? 'LENGTH' : '长度'}</div><Seg opts={[[1, en ? 'Short · ~25 min' : '短本 · 约 25 分钟'], [0, en ? 'Full · ~1 hr' : '完整本 · 约 1 小时']]} val={short ? 1 : 0} set={(v) => { setShort(v === 1); setPace(v === 1 ? 6 : 9); }} /></div>
              <div><div className="text-[11px] tracking-[.2em] text-parchment/40 mb-1.5">{en ? 'CAST (INCL. AI)' : '总人数（含 AI）'}</div><Seg opts={[[4, '4'], [6, '6'], [8, '8']]} val={headcount} set={setHeadcount} /></div>
              <div><div className="text-[11px] tracking-[.2em] text-parchment/40 mb-1.5">{en ? 'EACH ACT' : '每一幕'}</div><Seg opts={[[6, en ? 'Fast · 6m' : '快 · 6 分'], [9, en ? 'Normal · 9m' : '中 · 9 分'], [13, en ? 'Slow · 13m' : '慢 · 13 分']]} val={pace} set={setPace} /></div>
            </div>
          )}
        </div>
        {customSheet}
      </main>
    );
  }

  // ===== 选本：海报 =====
  if (phase === 'script') {
    const opts = props.room.jbs_options || [];
    const listen = (s: any) => {
      if (playing === s.id) { audioRef.current?.pause(); setPlaying(null); return; }
      audioRef.current?.pause();
      const a = new Audio(s.blurb_audio); audioRef.current = a; setPlaying(s.id);
      a.onended = () => setPlaying(null); a.play().catch(() => setPlaying(null));
    };
    return (
      <main className="min-h-[100svh] flex flex-col gap-5 pb-10" style={{ paddingTop: 'calc(max(10px, env(safe-area-inset-top)) + 60px)' }}>
        <div className="text-center px-4">
          <div className="text-[10.5px] tracking-[.4em] text-[#c0453f]/80">{en ? 'PICK A SCRIPT' : '选 一 个 本'}</div>
          <h1 className="mt-2 font-serif font-semibold text-[25px] sm:text-[30px] text-[#efe6d2]">{en ? 'Which story tonight?' : '今晚，演哪一出？'}</h1>
          <p className="mt-1.5 text-[12.5px] text-parchment/45">{generating ? (en ? 'Writing…' : '正在写……') : (en ? 'Swipe to compare' : '左右滑动看看')}</p>
        </div>
        <div className="flex gap-3.5 overflow-x-auto snap-x snap-mandatory px-[9vw] sm:px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:justify-center sm:flex-wrap sm:overflow-visible">
          {opts.map((s: any, k: number) => (
            <PosterCard key={s.id} index={k} total={opts.length} en={en}
              m={{ ...s, genre: `${s.type || ''} ${s.genre || ''}`, duration: [s.headcount ? (en ? `${s.headcount} roles` : `${s.headcount} 人本`) : '', s.duration].filter(Boolean).join(' · '), from_library: s.from_library }}
              footer={
                <div className="flex items-center gap-2.5">
                  {s.blurb_audio && (
                    <button onClick={() => listen(s)} className="shrink-0 h-11 px-4 rounded-xl border border-white/20 bg-black/20 text-[13px] text-white/85">{playing === s.id ? (en ? 'Stop' : '停') : (en ? 'Listen' : '听')}</button>
                  )}
                  <button onClick={() => { audioRef.current?.pause(); startScript(s.id); }} disabled={busy} className="flex-1 h-11 rounded-xl bg-[#7d1d1d] hover:bg-[#8e2323] border border-[#a83232]/60 text-[#f2ead9] font-serif tracking-[.12em] disabled:opacity-50">{busy ? '…' : (en ? 'This one' : '就这个')}</button>
                </div>
              } />
          ))}
        </div>
        <div className="flex items-center justify-center gap-5 text-[13px]">
          <button onClick={() => genScripts()} disabled={busy || generating} className="text-parchment/55 hover:text-parchment disabled:opacity-50">{en ? '↻ Three more' : '↻ 换一批'}</button>
          <span className="w-px h-3 bg-parchment/15" />
          <button onClick={() => setShowCustom(true)} disabled={busy || generating} className="text-parchment/55 hover:text-parchment disabled:opacity-50">{en ? 'Write to my taste' : '按我的口味写'}</button>
        </div>
        {customSheet}
      </main>
    );
  }

  // ===== 布置中 / 揭晓中 =====
  if (phase === 'locking' || phase === 'revealing') {
    return <Staging en={en} revealing={phase === 'revealing'} />;
  }

  // ===== 游戏中 / 投票 / 揭晓 =====
  const voting = phase === 'vote';
  const ended = phase === 'reveal' || props.room.game_state === 'ended';
  const rosterMsg = messages.find((m) => m.payload?.type === 'jbs_roster');
  const rosterNames = rosterMsg
    ? String(rosterMsg.content).split('\n').filter((l) => /^[·•]/.test(l.trim())).map((l) => l.trim().replace(/^[·•]\s*/, '').split(/[（(]/)[0].trim()).filter(Boolean)
    : [];
  const myName = (() => {
    const roleMsg = messages.find((m) => m.payload?.type === 'jbs_role');
    const mt = String(roleMsg?.content || '').match(/[「『](.+?)[」』]/);
    return myChar?.name || (mt ? mt[1] : '');
  })();
  const candList: any[] = chars.length ? chars : rosterNames.map((n) => ({ name: n, is_ai: false }));
  const candidates = candList.filter((c: any) => c.name && c.name !== myName);
  const showAccuseBtn = act >= Math.ceil(totalActs / 2);
  const jbsType = (props.room.jbs_type as string) || '推理';
  const accuse = ['推理', '恐怖', '阵营'].includes(jbsType);
  const endLabel = jbsType === '机制' ? (en ? 'Settle & rank' : '结算排名') : jbsType === '欢乐' ? (en ? 'Reveal & score' : '揭晓评分') : (en ? 'Reveal the ending' : '揭晓结局');
  const avatarOf = (name?: string) => chars.find((c: any) => c.name === name)?.avatar_url;
  const tasksDone = objectives.filter((o: any) => o.status === 'done').length;
  const actPct = actStart ? Math.max(0, Math.min(1, remainMs / (actMin * 60000))) : 0;
  function send() { if (!text.trim() || busy) return; act_(text); }

  return (
    <JbsPlay
      {...{ en, messages, busy, ended, voting, isHost, act, totalActs, actName, mmss, remainMs, actPct, showTimer: !ended && phase === 'playing' && actStart > 0,
        myChar, myName, tasksDone, objectives, clueList, chars, resources, candidates, accuse, endLabel, showAccuseBtn, keyFound, jbsType, roleMsgs,
        text, setText, send, sheet, setSheet, pickVote, setPickVote, vote, advance, settle, replay, resetting, genAvatars, avatarOf, speakerOf, inputRef,
        myPlayerId: props.myPlayerId, bottomRef, stage, talkTo, setTalkTo, roomId: props.room.id, refresh: () => router.refresh() }} />
  );
}

// ───────── 布置案件时的等待画面 ─────────
function Staging({ en, revealing }: { en: boolean; revealing: boolean }) {
  const lines = revealing
    ? (en ? ['Counting the votes…', 'Opening the sealed envelope…', 'The truth is coming…'] : ['正在清点每一票……', '正在拆开封好的真相……', '真相马上揭晓……'])
    : (en ? ['Setting the scene of the crime…', 'Writing everyone’s secrets…', 'Hiding the clues…', 'Handing out the scripts…'] : ['正在布置案发现场……', '正在给每个人写秘密……', '正在把线索藏好……', '正在分发剧本……']);
  const [i, setI] = useState(0);
  useEffect(() => { const id = setInterval(() => setI((x) => (x + 1) % lines.length), 2600); return () => clearInterval(id); }, [lines.length]);
  return (
    <main className="min-h-[100svh] flex flex-col items-center justify-center gap-6 text-center px-6">
      <div className="relative w-14 h-14">
        <span className="absolute inset-0 rounded-full border border-[#c0453f]/25" />
        <span className="absolute inset-0 rounded-full border-2 border-transparent border-t-[#c0453f] animate-spin" />
        <span className="absolute inset-[22px] rounded-full bg-[#c0453f]/70 animate-pulse" />
      </div>
      <p key={i} className="font-serif text-[16px] text-[#efe6d2]/80 nf-in">{lines[i]}</p>
      {!revealing && <p className="text-[12.5px] text-parchment/40 max-w-xs leading-relaxed">{en ? 'Tip: read your script carefully when it arrives — someone at this table is lying.' : '小提示：剧本到手后先仔细读——这张桌上，有人在说谎。'}</p>}
    </main>
  );
}

// ───────── 游戏主界面 ─────────
function JbsPlay(p: any) {
  const { en, messages, busy, ended, voting, isHost, chars, sheet, setSheet } = p;
  const scrollRef = useRef<HTMLElement>(null);
  const nearBottom = useRef(true);
  const lastId = useRef<string | null>(null);
  const [newBelow, setNewBelow] = useState(false);
  useEffect(() => {
    const last = messages[messages.length - 1];
    const first = lastId.current === null;
    const isNew = !!last && last.id !== lastId.current;
    lastId.current = last?.id || null;
    if (first) { p.bottomRef.current?.scrollIntoView(); return; }
    if (!isNew) return;
    if (!nearBottom.current && last.sender_player_id !== p.myPlayerId) { setNewBelow(true); return; }
    const t = last.payload?.type;
    if (t === 'jbs_dm' || t === 'jbs_act' || t === 'jbs_reveal') document.getElementById('j-' + last.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    else p.bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, p.myPlayerId, p.bottomRef]);
  useEffect(() => { const el = p.inputRef.current; if (!el) return; el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight, 112) + 'px'; }, [p.text, p.inputRef]);

  const clueN = p.clueList.length;
  const hasRole = p.roleMsgs.length > 0;
  const curScene = (p.stage?.scenes || []).find((x: any) => x.id === p.stage?.scene) || null;
  const pages = messages.filter((m: any) => m.payload?.type === 'jbs_page');
  const [seenPages, setSeenPages] = useState(0);
  const newPage = pages.length > seenPages;
  useEffect(() => { if (sheet === 'role') setSeenPages(pages.length); }, [sheet, pages.length]);
  const npcs: any[] = p.stage?.npcs || [];
  const look = pickLook(p.stage?.meta || { type: p.jbsType });

  return (
    <main className="relative h-[100svh] flex flex-col overflow-hidden">
      <div aria-hidden className="fixed inset-0 -z-[5] pointer-events-none bg-[radial-gradient(120%_80%_at_50%_20%,rgba(60,14,14,.35),rgba(11,12,15,.92))]" />

      {/* 顶部：我是谁 · 第几幕 · 剩多久 · 剧本 · 线索 */}
      <header className="shrink-0 px-3" style={{ paddingTop: 'calc(max(10px, env(safe-area-inset-top)) + 50px)' }}>
        <div className="mx-auto max-w-2xl flex items-center gap-2.5 h-14 px-2.5 rounded-2xl bg-[#0e0f13]/75 backdrop-blur-md border border-white/[0.07]">
          <button onClick={() => setSheet('cast')} className="flex items-center gap-2.5 min-w-0 flex-1 text-left">
            <Face src={p.myChar?.avatar_url} name={p.myName} size={38} ring={p.showTimer ? p.actPct : undefined} urgent={p.remainMs < 60000} />
            <span className="min-w-0">
              <span className="block text-[13.5px] text-[#efe6d2] font-serif truncate leading-tight">{p.myName || (en ? 'You' : '你')}</span>
              <span className="flex mt-0.5 text-[11.5px] text-parchment/50 min-w-0"><span className="truncate">
                {ended ? (en ? 'Case closed' : '本局结束') : voting ? (en ? 'Final accusation' : '最终指认') : (en ? `Act ${p.act}/${p.totalActs}` : `第 ${p.act}/${p.totalActs} 幕`) + (p.actName && !voting && !ended ? ` · ${p.actName}` : '')}
                </span>{p.showTimer && <span className={`shrink-0 ml-1.5 tabular-nums ${p.remainMs < 60000 ? 'text-[#e06060]' : 'text-parchment/60'}`}>{p.mmss}</span>}
              </span>
            </span>
          </button>
          <button onClick={() => setSheet('role')} className="relative h-10 px-3 rounded-xl bg-[#7d1d1d]/25 border border-[#a83232]/35 flex items-center gap-1.5 text-[12.5px] text-[#f2d6d6]">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5zM4 20.5A2.5 2.5 0 0 1 6.5 18H20" /></svg>
            {en ? 'Script' : '剧本'}
            {p.objectives.length > 0 && <span className="text-[10.5px] text-[#f2d6d6]/60 tabular-nums">{p.tasksDone}/{p.objectives.length}</span>}
            {newPage && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-[#e05a4a] ring-2 ring-[#0e0f13] mn-ping" />}
          </button>
          <button onClick={() => setSheet('clues')} className="relative h-10 px-3 rounded-xl bg-white/[0.04] border border-white/[0.08] flex items-center gap-1.5 text-[12.5px] text-[#d8c7a8]">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="11" cy="11" r="6.5" /><path d="M20 20l-4.2-4.2" /></svg>
            <span className={`min-w-[18px] h-[18px] px-1 rounded-full text-[10.5px] flex items-center justify-center ${clueN ? 'bg-[#c9a96e] text-[#14110b]' : 'bg-white/10 text-parchment/50'}`}>{clueN}</span>
          </button>
        </div>
        {curScene && (
          <button onClick={() => setSheet('map')} className="mx-auto max-w-2xl w-full mt-1.5 flex items-center justify-center gap-1.5 text-[12px] text-[#d8c7a8]/70">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#c0453f" strokeWidth="2" strokeLinecap="round"><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.4" /></svg>
            <span className="truncate">{en ? 'Now at ' : '现在在 · '}{curScene.name}</span><span className="text-parchment/30">›</span>
          </button>
        )}
      </header>

      {/* 剧情 */}
      <section ref={scrollRef as any} onScroll={(e) => { const el = e.currentTarget; nearBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 160; if (nearBottom.current && newBelow) setNewBelow(false); }} className="flex-1 min-h-0 overflow-y-auto mn-fade-top">
        <div className="mx-auto max-w-2xl px-4 pt-5 pb-6 space-y-4">
          {messages.filter((m: any) => m.payload?.type !== 'jbs_whisper').map((m: any) => (
            <div key={m.id} id={'j-' + m.id} className="scroll-mt-4">
              <Msg m={m} en={en} mine={m.sender_player_id === p.myPlayerId} who={p.speakerOf(m)} avatarOf={p.avatarOf} chars={chars} onOpen={setSheet} stage={p.stage} look={look} />
            </div>
          ))}
          {busy && !voting && (
            <div className="flex items-center justify-center gap-2.5 py-3 text-[12.5px] tracking-[.18em] text-[#c9a96e]/75">
              <span className="flex gap-1">{[0, 1, 2].map((i) => <span key={i} className="w-1.5 h-1.5 rounded-full bg-[#c9a96e]/80 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />)}</span>
              {en ? 'The host is responding' : '主持人正在回应'}
            </div>
          )}
          <div ref={p.bottomRef} className="h-1" />
        </div>
      </section>

      {newBelow && (
        <button onClick={() => { setNewBelow(false); const last = messages[messages.length - 1]; (last && document.getElementById('j-' + last.id) || p.bottomRef.current)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}
          className="mn-fadein absolute left-1/2 -translate-x-1/2 z-[40] h-9 px-4 rounded-full bg-[#17140d]/95 border border-[#c9a96e]/40 text-[12.5px] text-[#efe6d2] shadow-[0_8px_30px_rgba(0,0,0,.6)]" style={{ bottom: 'calc(max(12px, env(safe-area-inset-bottom)) + 120px)' }}>
          {en ? 'New ↓' : '有新进展 ↓'}
        </button>
      )}

      {/* 底部 */}
      <footer className="shrink-0 px-3 pt-2 bg-gradient-to-t from-[#0b0c0f] via-[#0b0c0f]/95 to-[#0b0c0f]/0" style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}>
        <div className="mx-auto max-w-2xl space-y-2">
          {ended ? (
            <div className="rounded-2xl border border-white/10 bg-[#111216]/90 px-4 py-4 text-center">
              <div className="font-serif text-[16px] text-[#efe6d2]">{en ? 'The case is closed.' : '本案已结。'}</div>
              <div className="mt-3 flex gap-2.5">
                <a href="/play" className="flex-1 h-11 rounded-xl border border-white/12 text-[14px] text-parchment/75 flex items-center justify-center">{en ? 'Back to hall' : '回到大厅'}</a>
                {isHost && <button onClick={p.replay} disabled={p.resetting} className="flex-1 h-11 rounded-xl bg-[#7d1d1d] border border-[#a83232]/60 text-[#f2ead9] text-[14px] disabled:opacity-50">{p.resetting ? '…' : (en ? 'New script' : '再来一本')}</button>}
              </div>
            </div>
          ) : voting ? (
            <div className="rounded-2xl border border-[#a83232]/35 bg-[#160c0c]/90 backdrop-blur px-3.5 pt-3.5 pb-3">
              <div className="text-center font-serif text-[16px] text-[#f2d6d6]">{p.jbsType === '阵营' ? (en ? 'Cast your vote' : '投出你的一票') : (en ? 'Who did it?' : '谁是真凶？')}</div>
              <div className="mt-3 grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-[34svh] overflow-y-auto">
                {p.candidates.map((c: any) => {
                  const on = p.pickVote === c.name;
                  return (
                    <button key={c.name} onClick={() => p.setPickVote(on ? null : c.name)} className={`rounded-xl p-2 flex flex-col items-center gap-1.5 border transition ${on ? 'border-[#e05a4a] bg-[#e05a4a]/15' : 'border-white/10 bg-white/[0.03]'}`}>
                      <Face src={c.avatar_url} name={c.name} size={48} />
                      <span className="text-[12.5px] text-[#efe6d2]/90 truncate max-w-full">{c.name}</span>
                    </button>
                  );
                })}
              </div>
              <button onClick={() => p.pickVote && p.vote(p.pickVote)} disabled={!p.pickVote || busy} className="mt-3 w-full h-12 rounded-xl bg-[#7d1d1d] border border-[#a83232]/60 text-[#f2ead9] font-serif tracking-[.12em] disabled:opacity-40">
                {p.pickVote ? (en ? `Accuse ${p.pickVote}` : `指认 ${p.pickVote}`) : (en ? 'Tap a suspect' : '点一个人')}
              </button>
            </div>
          ) : (
            <>
              {isHost && (
                <div className="flex items-center gap-2 px-1 text-[12px]">
                  <span className="text-parchment/35 shrink-0">{en ? 'Host' : '主持'}</span>
                  <span className="flex-1 truncate text-parchment/35">{p.keyFound ? '' : (en ? '· next act unlocks with the key clue or the timer' : '· 找到本幕关键线索或时间到，就能进下一幕')}</span>
                  <button onClick={() => p.advance(false)} disabled={busy || !p.keyFound} className="shrink-0 h-8 px-3 rounded-full border border-white/12 text-parchment/75 disabled:opacity-35">{en ? 'Next act ›' : '下一幕 ›'}</button>
                  {p.showAccuseBtn && (p.accuse
                    ? <button onClick={() => p.advance(true)} disabled={busy} className="shrink-0 h-8 px-3 rounded-full border border-[#a83232]/50 bg-[#7d1d1d]/30 text-[#f2d6d6] disabled:opacity-40">{en ? 'Accuse ›' : '去指认 ›'}</button>
                    : <button onClick={p.settle} disabled={busy} className="shrink-0 h-8 px-3 rounded-full border border-[#c9a96e]/40 text-[#e8d7b0] disabled:opacity-40">{p.endLabel}</button>)}
                </div>
              )}
              <div className="flex items-end gap-2">
                <div className="flex-1 min-w-0 flex items-end rounded-2xl border border-white/[0.12] focus-within:border-[#c9a96e]/50 bg-[#0f1014]/90 backdrop-blur pl-4 pr-1.5 py-1.5">
                  <textarea ref={p.inputRef} rows={1} value={p.text} onChange={(e) => p.setText(e.target.value)} style={{ resize: 'none' }}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !(e.nativeEvent as any).isComposing) { e.preventDefault(); p.send(); } }}
                    placeholder={en ? 'Search, ask, accuse…' : '搜证、问人、说推理……'} disabled={busy}
                    className="flex-1 min-w-0 bg-transparent py-[7px] text-[15px] leading-[22px] text-[#efe6d2] placeholder:text-parchment/35 outline-none disabled:opacity-50" />
                  <MicButton value={p.text} onChange={p.setText} en={en} compact />
                </div>
                <button onClick={p.send} disabled={!p.text.trim() || busy} aria-label={en ? 'Send' : '发送'} className="shrink-0 h-12 w-12 rounded-2xl bg-[#7d1d1d] border border-[#a83232]/60 text-[#f2ead9] flex items-center justify-center disabled:opacity-35">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19V5M5.5 11.5L12 5l6.5 6.5" /></svg>
                </button>
              </div>
            </>
          )}
        </div>
      </footer>

      {/* 我的剧本 */}
      <Sheet open={sheet === 'role'} onClose={() => setSheet(null)} title={en ? 'My script' : '我的剧本'}>
        <div className="space-y-6">
          {p.myChar && <div className="max-w-[300px] mx-auto"><RoleCard c={p.myChar} look={look} en={en} tag={en ? 'YOU' : '你'} big /></div>}
          <div>
            <SheetLabel>{en ? 'ONLY YOU CAN READ THIS' : '只有你能看'}</SheetLabel>
            {hasRole ? p.roleMsgs.map((m: any) => <ScriptPaper key={m.id} look={look}>{m.content}</ScriptPaper>) : <p className="text-[13px] text-parchment/40">{en ? 'Your script will appear here.' : '你的剧本会出现在这里。'}</p>}
          </div>
          {pages.length > 0 && (
            <div>
              <SheetLabel>{en ? 'UNLOCKED AS THE STORY GOES' : '随剧情解锁'}</SheetLabel>
              <div className="space-y-3">
                {pages.map((m: any) => (
                  <ScriptPaper key={m.id} look={look}>
                    <div className="text-[10.5px] tracking-[.3em] mb-1.5 font-sans" style={{ color: look.accent }}>{en ? `ACT ${m.payload?.act}` : `第 ${m.payload?.act} 幕`}</div>
                    {m.content}
                  </ScriptPaper>
                ))}
              </div>
            </div>
          )}
          {p.objectives.length > 0 && (
            <div>
              <SheetLabel>{en ? 'YOUR SECRET TASKS' : '你的秘密任务'}</SheetLabel>
              <div className="space-y-2">
                {p.objectives.map((o: any, i: number) => {
                  const st = o.status;
                  const c = st === 'done' ? '#6fcf8e' : st === 'failed' ? '#e06060' : st === 'progress' ? '#e3b66a' : 'rgba(216,199,168,.35)';
                  return (
                    <div key={i} className="flex gap-3 rounded-xl border border-white/[0.07] bg-white/[0.025] px-3.5 py-3">
                      <span className="mt-1 w-2.5 h-2.5 rounded-full shrink-0" style={{ background: c }} />
                      <div className="min-w-0">
                        <div className={`text-[14px] leading-relaxed ${st === 'done' ? 'text-parchment/50 line-through' : 'text-[#efe6d2]/90'}`}>{o.text}</div>
                        {o.note && <div className="text-[12px] text-parchment/45 mt-0.5">{o.note}</div>}
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="mt-2.5 text-[12px] text-parchment/35 leading-relaxed">{en ? 'Do it in the story — sneak, persuade, take. The host decides whether it works.' : '要在剧情里真的去做——潜入、说服、拿走……成不成由主持人判定，嘴上说不算。'}</p>
            </div>
          )}
        </div>
      </Sheet>

      {/* 线索 */}
      <Sheet open={sheet === 'clues'} onClose={() => setSheet(null)} title={en ? 'Clues' : '线索'}>
        <div className="space-y-2.5">
          {p.clueList.length === 0 && <p className="text-[13px] text-parchment/40">{en ? 'Nothing yet. Search somewhere, or ask someone.' : '还没有。去搜一个地方，或者问问谁。'}</p>}
          {p.clueList.map((m: any) => {
            const priv = m.payload?.type === 'private';
            return (
              <div key={m.id} className={`rounded-xl border px-3.5 py-3 ${priv ? 'border-[#a83232]/35 bg-[#2a0e0e]/40' : m.payload?.key ? 'border-[#c9a96e]/45 bg-[#c9a96e]/[0.07]' : 'border-white/[0.08] bg-white/[0.03]'}`}>
                <div className="text-[10.5px] tracking-[.2em] mb-1" style={{ color: priv ? '#e08a8a' : m.payload?.key ? '#c9a96e' : 'rgba(216,199,168,.45)' }}>{priv ? (en ? 'ONLY YOU' : '只有你知道') : m.payload?.key ? (en ? 'KEY CLUE' : '关键线索') : (en ? `ACT ${m.turn_no || ''}` : `第 ${m.turn_no || ''} 幕`)}</div>
                <div className="text-[14px] text-[#efe6d2]/88 leading-relaxed whitespace-pre-line">{String(m.content).replace(/^🔍\s*/, '')}</div>
              </div>
            );
          })}
          {p.resources.length > 0 && (
            <div className="pt-4">
              <SheetLabel>{en ? 'STANDINGS' : '资源 / 分数'}</SheetLabel>
              <div className="grid grid-cols-2 gap-2">
                {p.resources.map((r: any, i: number) => (
                  <div key={i} className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-3">
                    <div className="text-[13.5px] text-[#efe6d2] truncate">{r.name}</div>
                    {(r.items || []).map((it: any, j: number) => <div key={j} className="flex justify-between gap-2 text-[12px] text-parchment/55 mt-1"><span className="truncate">{it.label}</span><span className="text-[#c9a96e] shrink-0">{it.value}</span></div>)}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </Sheet>

      {/* 登场人物 */}
      <Sheet open={sheet === 'cast'} onClose={() => setSheet(null)} title={en ? 'The cast' : '登场人物'}>
        <div className="text-center text-[10.5px] tracking-[.3em] mb-3" style={{ color: look.accent }}>{look.label(en)}</div>
        <div className="grid grid-cols-2 gap-3">
          {chars.map((c: any) => {
            const me = c.name === p.myName;
            return (
              <RoleCard key={c.name} c={c} look={look} en={en}
                tag={me ? (en ? 'YOU' : '你') : c.assigned_seat ? (en ? 'PLAYER' : '真人') : 'AI'}
                footer={!me && !c.assigned_seat && !p.ended ? (
                  <button onClick={() => { setSheet(null); p.setTalkTo(c.name); }} className="w-full h-8 rounded-lg text-[12.5px]" style={{ color: look.key === 'ancient' ? '#5a2a20' : look.accent, border: `1px solid ${look.accent}66` }}>{en ? 'Talk in private' : '私下聊聊'}</button>
                ) : undefined} />
            );
          })}
        </div>
        {npcs.length > 0 && (
          <>
            <div className="mt-6 mb-3 text-center text-[10.5px] tracking-[.3em] text-parchment/40">{en ? 'OTHERS HERE · NOT SUSPECTS' : '其 他 在 场 的 人 · 不 参 与 指 认'}</div>
            <div className="grid grid-cols-2 gap-3">
              {npcs.map((n: any) => (
                <RoleCard key={n.name} c={n} look={look} en={en}
                  footer={!p.ended ? <button onClick={() => { setSheet(null); p.setTalkTo(n.name); }} className="w-full h-8 rounded-lg text-[12.5px]" style={{ color: look.key === 'ancient' ? '#5a2a20' : look.accent, border: `1px solid ${look.accent}66` }}>{en ? 'Talk in private' : '私下聊聊'}</button> : undefined} />
              ))}
            </div>
          </>
        )}
        {isHost && chars.some((c: any) => !c.avatar_url) && (
          <button onClick={() => p.genAvatars(false)} disabled={busy} className="mt-4 w-full h-10 rounded-xl border border-white/10 text-[13px] text-parchment/60 disabled:opacity-50">{busy ? (en ? 'Drawing…' : '正在画……') : (en ? 'Draw the missing portraits' : '补画缺的头像')}</button>
        )}
      </Sheet>

      {/* 地点 */}
      <Sheet open={sheet === 'map'} onClose={() => setSheet(null)} title={en ? 'Places' : '地点'}>
        <div className="space-y-2.5">
          {(p.stage?.scenes || []).map((sc: any) => {
            const here = sc.id === p.stage?.scene;
            return (
              <div key={sc.id} className={`rounded-2xl overflow-hidden border ${here ? 'border-[#c0453f]/50' : 'border-white/[0.08]'} bg-white/[0.025]`}>
                {sc.image && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={sc.image} alt="" className="w-full h-28 object-cover opacity-80" />
                )}
                <div className="px-4 py-3">
                  <div className="flex items-center gap-2"><span className="font-serif text-[15.5px] text-[#efe6d2]">{sc.name}</span>{here && <span className="text-[10.5px] px-1.5 py-[1px] rounded border border-[#c0453f]/50 text-[#f2a0a0]">{en ? 'you are here' : '你们在这'}</span>}</div>
                  {sc.mood && <p className="mt-1 text-[13px] text-parchment/65 leading-relaxed">{sc.mood}</p>}
                  {Array.isArray(sc.spots) && sc.spots.length > 0 && <p className="mt-1.5 text-[12px] text-parchment/40">{en ? 'Worth a look: ' : '能搜的地方：'}{sc.spots.join(en ? ', ' : '、')}</p>}
                </div>
              </div>
            );
          })}
          <p className="text-[12px] text-parchment/35 leading-relaxed">{en ? 'To go somewhere, just say it — "I go to the study".' : '想去哪，直接说就行，比如「我去书房看看」。'}</p>
        </div>
      </Sheet>

      <Whisper open={!!p.talkTo} target={p.talkTo} onClose={() => p.setTalkTo(null)} en={en} roomId={p.roomId} messages={messages} face={p.avatarOf(p.talkTo) || npcs.find((n: any) => n.name === p.talkTo)?.image} refresh={p.refresh} role={npcs.find((n: any) => n.name === p.talkTo)?.role || chars.find((c: any) => c.name === p.talkTo)?.occupation} />
    </main>
  );
}

// 私下聊：一对一，只有你看得到
function Whisper({ open, target, onClose, en, roomId, messages, face, refresh, role }: { open: boolean; target: string | null; onClose: () => void; en: boolean; roomId: string; messages: any[]; face?: string; refresh: () => void; role?: string }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const endRef = useRef<HTMLDivElement>(null);
  const thread = messages.filter((m: any) => m.payload?.type === 'jbs_whisper' && m.payload?.with === target);
  const clues = messages.filter((m: any) => m.payload?.type === 'jbs_evidence' && m.payload?.via === target);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [thread.length, busy, open]);
  if (!open || !target) return null;
  async function send() {
    const t = text.trim(); if (!t || busy) return;
    setText(''); setBusy(true); setErr('');
    try {
      const r = await fetch('/api/jbs/whisper', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ roomId, target, text: t }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) setErr(d.error || (en ? 'Failed' : '没说成')); else refresh();
    } catch { setErr(en ? 'Network error' : '网络错误'); }
    setBusy(false);
  }
  return (
    <div className="fixed inset-0 z-[72]" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-[3px] mn-fadein" />
      <div onClick={(e) => e.stopPropagation()} className="mn-sheet absolute inset-x-0 bottom-0 h-[86svh] lg:inset-x-auto lg:right-0 lg:top-0 lg:h-full lg:w-[420px] rounded-t-3xl lg:rounded-none lg:rounded-l-3xl bg-gradient-to-b from-[#1a1012] to-[#0e0f13] border-t lg:border-t-0 lg:border-l border-[#a83232]/25 flex flex-col">
        <div className="shrink-0 px-5 pt-3 pb-3 border-b border-white/[0.06]">
          <div className="mx-auto w-10 h-1 rounded-full bg-white/15 lg:hidden" />
          <div className="mt-3 flex items-center gap-3">
            <Face src={face} name={target} size={44} />
            <div className="min-w-0 flex-1"><div className="font-serif text-[17px] text-[#efe6d2] truncate">{target}</div><div className="text-[11.5px] text-[#e08a8a]/80">{en ? 'Private · only you can see this' : '私下 · 只有你看得到'}{role ? ` · ${role}` : ''}</div></div>
            <button onClick={onClose} className="w-9 h-9 -mr-2 rounded-full text-parchment/50 flex items-center justify-center">✕</button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          {thread.length === 0 && <p className="text-center text-[13px] text-parchment/40 mt-6 leading-relaxed">{en ? <>You pull {target} aside.<br />What do you want to know — and what will you offer?</> : <>你把{target}拉到一边。<br />你想问什么？又打算拿什么换？</>}</p>}
          {thread.map((m: any) => {
            const mine = m.payload?.from === 'me';
            return (
              <div key={m.id} className={`flex ${mine ? 'justify-end' : 'items-start gap-2'}`}>
                {!mine && <Face src={face} name={target} size={30} />}
                <div className={`max-w-[82%] px-4 py-2.5 text-[14.5px] leading-relaxed ${mine ? 'rounded-2xl rounded-br-md border border-[#c9a96e]/30 bg-[#c9a96e]/[0.09] text-[#efe6d2]' : 'rounded-2xl rounded-tl-md border border-[#a83232]/25 bg-[#2a0e0e]/45 text-[#efe6d2]/92'}`}>
                  {mine ? m.content : <Narration text={m.content} lang={en ? 'en' : 'zh'} fresh={false} tone="quiet" collapse={false} />}
                </div>
              </div>
            );
          })}
          {clues.map((m: any) => (
            <div key={m.id} className="rounded-xl border border-[#c9a96e]/40 bg-[#c9a96e]/[0.07] px-3.5 py-2.5">
              <div className="text-[10.5px] tracking-[.22em] text-[#c9a96e] mb-0.5">{en ? 'YOU GOT A CLUE' : '你拿到了线索'}</div>
              <div className="text-[13.5px] text-[#efe6d2]/90">{String(m.content).replace(/^🔍\s*/, '')}</div>
            </div>
          ))}
          {busy && <div className="flex items-center gap-2 text-[12.5px] text-parchment/45"><span className="flex gap-1">{[0, 1, 2].map((i) => <span key={i} className="w-1.5 h-1.5 rounded-full bg-parchment/50 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />)}</span>{en ? `${target} is thinking…` : `${target}在犹豫……`}</div>}
          {err && <p className="text-[12.5px] text-[#e06060]">{err}</p>}
          <div ref={endRef} />
        </div>
        <div className="shrink-0 px-3 pt-2" style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}>
          <div className="flex items-end gap-2">
            <div className="flex-1 min-w-0 flex items-end rounded-2xl border border-white/[0.12] bg-black/30 pl-4 pr-1.5 py-1.5">
              <textarea rows={1} value={text} onChange={(e) => setText(e.target.value)} style={{ resize: 'none' }}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !(e.nativeEvent as any).isComposing) { e.preventDefault(); send(); } }}
                placeholder={en ? 'Ask, bargain, threaten…' : '问、谈条件、或者吓唬……'} className="flex-1 min-w-0 bg-transparent py-[7px] text-[15px] leading-[22px] text-[#efe6d2] placeholder:text-parchment/35 outline-none" />
              <MicButton value={text} onChange={setText} en={en} compact />
            </div>
            <button onClick={send} disabled={!text.trim() || busy} className="shrink-0 h-12 w-12 rounded-2xl bg-[#7d1d1d] border border-[#a83232]/60 text-[#f2ead9] flex items-center justify-center disabled:opacity-35">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19V5M5.5 11.5L12 5l6.5 6.5" /></svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Face({ src, name, size, ring, urgent }: { src?: string; name?: string; size: number; ring?: number; urgent?: boolean }) {
  const r = size / 2 + 2.5, C = 2 * Math.PI * r;
  return (
    <span className="relative shrink-0 inline-flex" style={{ width: size, height: size }}>
      <span className="w-full h-full rounded-full overflow-hidden border border-[#c9a96e]/35 bg-gradient-to-b from-[#2a1d1a] to-[#141012] flex items-center justify-center">
        {src
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={src} alt="" className="w-full h-full object-cover" />
          : <span className="font-serif text-[#e8d7b0]/70" style={{ fontSize: size * 0.42 }}>{String(name || '?').slice(0, 1)}</span>}
      </span>
      {typeof ring === 'number' && (
        <svg className="absolute pointer-events-none" style={{ left: -5, top: -5, width: size + 10, height: size + 10 }} viewBox={`0 0 ${size + 10} ${size + 10}`}>
          <circle cx={size / 2 + 5} cy={size / 2 + 5} r={r} fill="none" stroke="rgba(255,255,255,.07)" strokeWidth="2" />
          <circle cx={size / 2 + 5} cy={size / 2 + 5} r={r} fill="none" stroke={urgent ? '#e05a4a' : '#c9a96e'} strokeWidth="2" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - ring)} transform={`rotate(-90 ${size / 2 + 5} ${size / 2 + 5})`} className={urgent ? 'animate-pulse' : ''} />
        </svg>
      )}
    </span>
  );
}

function Msg({ m, en, mine, who, avatarOf, chars, onOpen, stage, look }: { m: any; en: boolean; mine: boolean; who?: string; avatarOf: (n?: string) => string | undefined; chars: any[]; onOpen: (s: any) => void; stage?: any; look: any }) {
  const type = m.payload?.type;
  const lang = en ? 'en' : 'zh';
  if (type === 'jbs_scene') {
    const sc = (stage?.scenes || []).find((x: any) => x.id === m.payload?.scene);
    return (
      <button onClick={() => onOpen('map')} className="relative w-full overflow-hidden rounded-2xl border border-white/10 text-left nf-in">
        {sc?.image
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={sc.image} alt="" className="w-full h-40 object-cover" />
          : <div className="w-full h-24 bg-[radial-gradient(120%_100%_at_30%_0%,rgba(192,69,63,.25),rgba(14,15,19,.9))]" />}
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
        <div className="absolute left-4 right-4 bottom-3">
          <div className="text-[10px] tracking-[.35em] text-[#f2a0a0]/85">{en ? 'LOCATION' : '地 点'}</div>
          <div className="font-serif text-[20px] text-[#f4ecdc]">{m.content}</div>
          {sc?.mood && <div className="text-[12.5px] text-[#efe6d2]/70 leading-snug line-clamp-2">{sc.mood}</div>}
        </div>
      </button>
    );
  }
  if (type === 'jbs_event') {
    return (
      <div className="rounded-2xl border border-[#e05a4a]/45 bg-gradient-to-r from-[#3a0f0f]/80 to-[#1a0c0c]/70 px-4 py-3.5 nf-in shadow-[0_0_40px_-12px_rgba(224,90,74,.6)]">
        <div className="flex items-center gap-2 text-[10.5px] tracking-[.32em] text-[#ff8a7a]"><span className="w-1.5 h-1.5 rounded-full bg-[#ff6b5a] animate-ping" />{en ? 'SUDDENLY' : '突 发'}</div>
        <div className="mt-1 font-serif text-[16px] leading-relaxed text-[#fbeee0]">{m.content}</div>
      </div>
    );
  }
  if (type === 'jbs_page') {
    return (
      <button onClick={() => onOpen('role')} className="w-full text-left rounded-2xl border border-[#a83232]/40 bg-[#2a0e0e]/55 px-4 py-3.5 flex items-center gap-3 nf-in">
        <span className="w-10 h-10 rounded-xl bg-[#7d1d1d]/40 border border-[#a83232]/40 flex items-center justify-center text-[#f2d6d6] font-serif">{m.payload?.act}</span>
        <span className="min-w-0 flex-1"><span className="block font-serif text-[15px] text-[#f2d6d6]">{en ? 'A new page of your script' : '你的剧本多了一页'}</span><span className="block text-[12.5px] text-parchment/50">{en ? 'Something comes back to you — only you can read it' : '你想起了一些事 · 只有你能看'}</span></span>
        <span className="text-[#f2d6d6]/60">›</span>
      </button>
    );
  }
  if (type === 'jbs_dm' && m.payload?.show) return <Narration text={m.content} lang={lang} fresh={fresh(m)} tone="reveal" label={en ? 'On stage' : '演 出'} collapse={false} />;
  if (type === 'jbs_act') return <ActTitle look={look} en={en} text={String(m.content).replace(/^[▶—\-\s]+|[—\-\s]+$/g, '')} />;
  if (type === 'jbs_dm') return <Narration text={m.content} lang={lang} fresh={fresh(m)} label={en ? 'Host' : '主持人'} />;
  if (type === 'jbs_reveal') return <Narration text={m.content} lang={lang} fresh={fresh(m)} tone="reveal" label={en ? 'The truth' : '真相'} collapse={false} />;
  if (type === 'jbs_role') {
    return (
      <button onClick={() => onOpen('role')} className="w-full text-left rounded-2xl border border-[#a83232]/40 bg-gradient-to-br from-[#2a0e0e]/70 to-[#130b0b]/70 px-4 py-4 flex items-center gap-3.5">
        <span className="w-11 h-11 rounded-xl bg-[#7d1d1d]/40 border border-[#a83232]/40 flex items-center justify-center text-[#f2d6d6]"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5zM4 20.5A2.5 2.5 0 0 1 6.5 18H20" /></svg></span>
        <span className="min-w-0 flex-1"><span className="block font-serif text-[15.5px] text-[#f2d6d6]">{en ? 'Your script has arrived' : '你的剧本到了'}</span><span className="block text-[12.5px] text-parchment/50">{en ? 'Only you can read it — tap to open' : '只有你能看 · 点开读一读'}</span></span>
        <span className="text-[#f2d6d6]/60">›</span>
      </button>
    );
  }
  if (type === 'jbs_roster') {
    return (
      <button onClick={() => onOpen('cast')} className="w-full rounded-2xl border border-white/[0.08] bg-white/[0.025] px-4 py-3.5 text-left">
        <div className="text-[10.5px] tracking-[.3em] text-parchment/40">{en ? 'THE CAST' : '登场人物'}</div>
        <div className="mt-2.5 flex flex-wrap gap-3">
          {(chars.length ? chars : []).map((c: any) => (
            <span key={c.name} className="flex flex-col items-center gap-1 w-12"><Face src={c.avatar_url} name={c.name} size={40} /><span className="text-[11px] text-parchment/65 truncate max-w-full">{c.name}</span></span>
          ))}
          {!chars.length && <span className="text-[13px] text-parchment/70 whitespace-pre-line">{m.content}</span>}
        </div>
      </button>
    );
  }
  if (type === 'jbs_evidence') {
    const key = !!m.payload?.key;
    return (
      <div className={`rounded-2xl border px-4 py-3 nf-in ${key ? 'border-[#c9a96e]/50 bg-[#c9a96e]/[0.08] shadow-[0_0_30px_-10px_rgba(201,169,110,.5)]' : 'border-[#c9a96e]/20 bg-[#c9a96e]/[0.04]'}`}>
        <div className="text-[10.5px] tracking-[.25em] mb-1 text-[#c9a96e]">{key ? (en ? 'KEY CLUE' : '关键线索') : (en ? 'CLUE' : '线索')}{m.payload?.via ? (en ? ` · FROM ${m.payload.via}` : ` · 私下从${m.payload.via}那里`) : ''}</div>
        <div className="text-[14px] text-[#efe6d2]/90 leading-relaxed whitespace-pre-line">{String(m.content).replace(/^🔍\s*/, '')}</div>
      </div>
    );
  }
  if (type === 'private') {
    return (
      <div className="rounded-2xl bg-[#2a0e0e]/55 border border-[#a83232]/35 px-4 py-3 text-[14px] text-[#efe6d2]/88 leading-relaxed whitespace-pre-line">
        <div className="text-[10.5px] tracking-[.22em] text-[#e08a8a] mb-1">{en ? 'ONLY YOU' : '只有你知道'}</div>{m.content}
      </div>
    );
  }
  if (type === 'jbs_objupd') {
    return <div className="flex justify-center"><button onClick={() => onOpen('role')} className="px-3.5 py-1.5 rounded-full border border-[#c9a96e]/30 bg-[#c9a96e]/[0.07] text-[12.5px] text-[#e8d7b0]">{String(m.content).replace(/^🎯\s*/, '')}</button></div>;
  }
  if (type === 'jbs_score') return <ScoreCard scores={m.payload?.scores || []} en={en} />;
  if (type === 'jbs_ai') {
    const nm = m.payload?.name;
    return (
      <div className="flex items-start gap-2.5">
        <Face src={avatarOf(nm)} name={nm} size={34} />
        <div className="min-w-0 max-w-[84%]">
          <div className="text-[11.5px] text-parchment/45 mb-1">{nm}</div>
          <div className="px-4 py-2.5 rounded-2xl rounded-tl-md border border-white/10 bg-white/[0.045] text-[14.5px] leading-relaxed text-[#efe6d2]/92">{m.content}</div>
        </div>
      </div>
    );
  }
  if (m.sender_type === 'system') {
    return <div className="flex justify-center"><span className="max-w-full px-3.5 py-1.5 rounded-full border border-white/[0.07] text-[12.5px] text-parchment/50 text-center whitespace-pre-line">{m.content}</span></div>;
  }
  return (
    <div className={`flex ${mine ? 'justify-end' : 'items-start gap-2.5'}`}>
      {!mine && <Face src={avatarOf(who)} name={who} size={34} />}
      <div className={`flex flex-col ${mine ? 'items-end' : 'items-start'} max-w-[84%]`}>
        <span className="text-[11.5px] text-parchment/40 mb-1">{mine ? (en ? 'You' : '你') : who}</span>
        <div className={`px-4 py-2.5 text-[14.5px] leading-relaxed ${mine ? 'rounded-2xl rounded-br-md border border-[#c9a96e]/30 bg-[#c9a96e]/[0.09] text-[#efe6d2]' : 'rounded-2xl rounded-tl-md border border-[#5aa39a]/25 bg-[#5aa39a]/[0.07] text-[#efe6d2]/92'}`}>{m.content}</div>
      </div>
    </div>
  );
}

function ScoreCard({ scores, en }: { scores: any[]; en: boolean }) {
  return (
    <div className="rounded-2xl border border-[#c9a96e]/25 bg-[#14120d]/80 px-4 py-4">
      <div className="text-[10.5px] tracking-[.3em] text-[#c9a96e] mb-3">{en ? 'SCORECARD' : '本局评分'}</div>
      <div className="space-y-3">
        {scores.map((s: any, i: number) => (
          <div key={i} className="rounded-xl bg-white/[0.03] border border-white/[0.07] p-3">
            <div className="flex items-center justify-between"><span className="text-[14px] text-[#efe6d2]">{s.name}</span><span className="font-serif text-[20px] text-[#c9a96e]">{s.total}<span className="text-[11px] text-parchment/40">/100</span></span></div>
            <div className="mt-2 space-y-1.5">
              {(s.metrics || []).map((mt: any, j: number) => (
                <div key={j} className="flex items-center gap-2">
                  <span className="text-parchment/55 text-[11.5px] w-20 shrink-0 truncate">{mt.label}</span>
                  <div className="flex-1 h-1.5 rounded-full bg-white/[0.07] overflow-hidden"><div className="h-full rounded-full bg-[#c9a96e]/80" style={{ width: `${Math.max(0, Math.min(100, mt.score))}%` }} /></div>
                  <span className="text-parchment/65 text-[11.5px] w-7 text-right tabular-nums">{mt.score}</span>
                </div>
              ))}
            </div>
            {s.highlight && <div className="text-[#8fd3b8]/85 text-[12px] mt-2">{en ? 'Best: ' : '高光：'}{s.highlight}</div>}
            {s.improve && <div className="text-[#e3b66a]/80 text-[12px]">{en ? 'Next time: ' : '下次可以：'}{s.improve}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}
