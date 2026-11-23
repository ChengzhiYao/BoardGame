'use client';
import { toast as notify } from '@/components/Toast';
import Narration from '@/components/Narration';
import MicButton from '@/components/MicButton';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { playSfx } from '@/lib/audio/sfx';
import { playAnswerSfx } from '@/lib/audio/answerSfx';
import type { ShellProps } from './RoomShell';
import { tr } from '@/lib/i18n';
import { useTTS } from './useTTS';
import { Sheet, SheetLabel, Field } from './ui';

const EN = (l?: string) => l === 'en';

const ACTION_LABELS: Record<string, Record<string, string>> = {
  zh: { investigate: '调查', talk: '交谈', combat: '战斗', move: '移动', free: '自由', chat: '对话' },
  en: { investigate: 'Investigate', talk: 'Talk', combat: 'Fight', move: 'Move', free: 'Free', chat: 'Talk' },
};
const IMG_TYPE: Record<string, Record<string, string>> = {
  zh: { scene_image: '场景', npc_portrait: 'NPC', clue_evidence: '证物', monster_image: '怪物', event_illustration: '事件' },
  en: { scene_image: 'Scene', npc_portrait: 'NPC', clue_evidence: 'Evidence', monster_image: 'Monster', event_illustration: 'Event' },
};
const THREADS_L: Record<string, Record<string, string>> = {
  zh: { A: '建筑历史', B: '失踪 / 死亡', C: 'NPC 异常', D: '超自然现象', E: '关键物品 / 仪式', 其他: '其他线索' },
  en: { A: 'History', B: 'Missing / Death', C: 'NPC Anomaly', D: 'Supernatural', E: 'Key Item / Ritual', 其他: 'Other' },
};
const ACT = (lang: string, k: string) => (ACTION_LABELS[EN(lang) ? 'en' : 'zh'][k] || '');

// CoC scene_state -> 3D 背景氛围（探索/调查/战斗/怪物现身/宇宙恐怖/结局）
const SCENE3D: Record<string, string> = {
  EXPLORATION_SAFE: 'explore', EXPLORATION_DANGEROUS: 'explore', CHARACTER_CREATION: 'explore', MENU: 'explore',
  HIDDEN_CLUE: 'investigate', INVESTIGATION_BREAKTHROUGH: 'investigate', RITUAL_DISCOVERY: 'investigate',
  PARANORMAL_EVENT: 'cosmic', COSMIC_HORROR: 'cosmic',
  MONSTER_REVEAL: 'monster',
  CHASE_SEQUENCE: 'combat', COMBAT: 'combat', FINAL_CONFRONTATION: 'combat',
  GOOD_ENDING: 'ending', BITTERSWEET_ENDING: 'ending', BAD_ENDING: 'ending', TRUTH_REVEAL: 'ending',
};
const scene3dFor = (s?: string) => SCENE3D[(s || '').toUpperCase()] || 'explore';

const fresh = (m: any) => !!m?.created_at && Date.now() - new Date(m.created_at).getTime() < 90000;
export default function Dashboard(props: ShellProps) {
  const supabase = useRef(createClient()).current;
  const router = useRouter();
  const lang = props.room.language || 'zh';
  const t = tr(lang);
  const [messages, setMessages] = useState<any[]>(props.initialMessages);
  const [text, setText] = useState('');
  const [action, setAction] = useState('free');
  const [thinking, setThinking] = useState(false);
  const [online, setOnline] = useState<Record<string, boolean>>({});
  const [genImg, setGenImg] = useState<string | null>(null);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [upBusy, setUpBusy] = useState('');
  const [mobileTab, setMobileTab] = useState<'story' | 'chars' | 'clues'>('story');
  const bottomRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<HTMLIFrameElement>(null);
  const scene3d = scene3dFor(props.room.scene_state);
  const ended = props.room.game_state === 'ended';
  useEffect(() => {
    const send = () => { try { sceneRef.current?.contentWindow?.postMessage({ type: 'scene', state: scene3d }, '*'); } catch {} };
    send();
    const id = setTimeout(send, 700);
    return () => clearTimeout(id);
  }, [scene3d]);

  const players = props.initialPlayers;
  const users = props.initialUsers;
  const characters = props.initialCharacters;
  const dflt = EN(lang) ? 'Investigator' : '调查员';
  const nameOfUser = (uid?: string) => users.find((u) => u.id === uid)?.display_name || dflt;
  const playerById = (pid?: string | null) => players.find((p) => p.id === pid);
  const charOfSeat = (seat: string) => {
    const p = players.find((x) => x.seat === seat);
    return characters.find((c) => c.player_id === p?.id);
  };
  const charNameOrUser = (seat: string) => {
    const p = players.find((x) => x.seat === seat);
    return charOfSeat(seat)?.name || nameOfUser(p?.user_id);
  };

  const sfxSeen = useRef<Set<string>>(new Set());
  useEffect(() => {
    let tm: any;
    const ch = supabase
      .channel(`room-msgs-${props.room.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `room_id=eq.${props.room.id}` },
        (payload: any) => {
          const m = payload.new;
          setMessages((prev) => prev.some((x) => x.id === m.id) ? prev : [...prev, m]);
          const sfx = m.payload?.sfx;
          if (Array.isArray(sfx) && !sfxSeen.current.has(m.id)) { sfxSeen.current.add(m.id); sfx.forEach((k: string) => playSfx(k)); }
          if (tm) clearTimeout(tm);
          tm = setTimeout(() => router.refresh(), 500);
        })
      .subscribe();
    return () => { if (tm) clearTimeout(tm); supabase.removeChannel(ch); };
  }, [props.room.id, supabase, router]);

  useEffect(() => {
    setMessages((prev) => {
      const ids = new Set(prev.map((m) => m.id));
      const add = props.initialMessages.filter((m) => !ids.has(m.id));
      return add.length ? [...prev, ...add] : prev;
    });
  }, [props.initialMessages]);

  useEffect(() => {
    const ch = supabase.channel(`room-presence-${props.room.id}`, { config: { presence: { key: props.userId } } });
    ch.on('presence', { event: 'sync' }, () => {
      const state = ch.presenceState();
      const map: Record<string, boolean> = {};
      Object.keys(state).forEach((k) => (map[k] = true));
      setOnline(map);
    }).subscribe(async (status) => { if (status === 'SUBSCRIBED') await ch.track({ seat: props.mySeat }); });
    return () => { supabase.removeChannel(ch); };
  }, [props.room.id, props.userId, props.mySeat, supabase]);

  const scrollRef = useRef<HTMLElement>(null);
  const nearBottom = useRef(true);
  const [newBelow, setNewBelow] = useState(false);
  const lastId = useRef<string | null>(null);
  useEffect(() => {
    const last = messages[messages.length - 1];
    const first = lastId.current === null;
    const isNew = !!last && last.id !== lastId.current;
    lastId.current = last?.id || null;
    if (first) { bottomRef.current?.scrollIntoView(); return; }
    if (!isNew) { if (nearBottom.current) bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); return; }
    if (!nearBottom.current && last.sender_player_id !== props.myPlayerId) { setNewBelow(true); return; }
    // 守秘人的新一段：滚到这段开头，从头读，而不是直接冲到底
    if (last.sender_type === 'kp') document.getElementById('m-' + last.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    else bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, thinking, props.myPlayerId]);

  // 轮询兜底：被邀请的匿名玩家realtime可能被RLS过滤收不到推送，这里定时主动拉消息+回合状态，保证两边同步。
  useEffect(() => {
    const tick = async () => {
      if (typeof document !== 'undefined' && document.hidden) return;
      const { data } = await supabase.from('messages').select('*').eq('room_id', props.room.id).order('created_at', { ascending: true }).limit(300);
      if (data) setMessages((prev) => { const ids = new Set(prev.map((m) => m.id)); const add = data.filter((m: any) => !ids.has(m.id)); return add.length ? [...prev, ...add] : prev; });
      const { data: r } = await supabase.from('rooms').select('current_round, resolution_status, game_state, waiting_for').eq('id', props.room.id).maybeSingle();
      if (r && (r.current_round !== props.room.current_round || r.resolution_status !== props.room.resolution_status || r.game_state !== props.room.game_state || r.waiting_for !== props.room.waiting_for)) router.refresh();
    };
    const id = setInterval(tick, 4000);
    return () => clearInterval(id);
  }, [props.room.id, props.room.current_round, props.room.resolution_status, props.room.game_state, props.room.waiting_for, supabase, router]);

  const room = props.room;
  useTTS({
    lang,
    messages,
    roomId: props.room.id,
    classify: (m: any) => (m.sender_type === 'kp' ? { kind: 'narrator' as const, text: voiceText(m.content, props.mySeat), audio: m.payload?.audio } : null),
  });
  const myReady = !!room.pending_actions?.[props.mySeat as string]?.content;
  const resolving = room.resolution_status === 'resolving';
  const myPending = room.pending_actions?.[props.mySeat as string]?.content;
  const myChar = charOfSeat(props.mySeat as string);
  const myOut = !!myChar && ((myChar.status_flags?.dead || myChar.status_flags?.retired) || (myChar.hp_current ?? 1) <= 0 || (myChar.san_current ?? 1) <= 0);

  async function sendChat() {
    const c = text.trim();
    if (!c || !props.myPlayerId) return;
    setText('');
    const { error } = await supabase.from('messages').insert({
      room_id: room.id, sender_type: 'player', sender_player_id: props.myPlayerId,
      action_type: 'chat', content: c, visibility: 'public', turn_no: room.current_round || 1,
    });
    if (error) notify((EN(lang) ? 'Send failed: ' : '发送失败：') + error.message);
  }
  async function submitAction(content: string, act: string = action) {
    const c = (content || '').trim();
    if (!c || !props.myPlayerId || myReady || resolving || ended || myOut) return;
    setText(''); setThinking(true);
    try {
      const res = await fetch('/api/round/submit', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId: room.id, content: c, action_type: act }),
      });
      const data = await res.json();
      if (!res.ok) notify(data.error || (EN(lang) ? 'Submit failed' : '提交失败'));
    } catch (e: any) { notify((EN(lang) ? 'Submit failed: ' : '提交失败：') + e.message); }
    finally { setThinking(false); }
  }
  async function withdrawAction() {
    try {
      await fetch('/api/round/withdraw', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ roomId: room.id }) });
    } catch {}
  }
  function submitFromInput() { submitAction(text, action); }

  const guidance = (() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].sender_type === 'kp' && messages[i].payload?.guidance) return messages[i].payload.guidance;
    }
    return null;
  })();

  async function makeImage(imageId: string, silent?: boolean) {
    setGenImg(imageId);
    try {
      const res = await fetch('/api/images/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId: props.room.id, imageId }),
      });
      const data = await res.json();
      if (res.status === 402) { setShowUpgrade(true); }
      else if (!res.ok && !silent) notify(data.error || (EN(lang) ? 'Image failed' : '出图失败'));
    } catch (e: any) { if (!silent) notify((EN(lang) ? 'Image failed: ' : '出图失败：') + e.message); }
    finally { setGenImg(null); }
  }

  const suggestedImages = props.initialImages.filter((i) => i.status === 'suggested' || i.status === 'generating' || i.status === 'failed');
  const doneImages = props.initialImages.filter((i) => i.status === 'done');

  // 自动出图：房主端在预算内自动把"建议配图"逐张生成，无需点击。
  const autoImg = useRef(false);
  useEffect(() => {
    if (props.userId !== props.room.host_user_id) return;
    if ((props.room.image_used ?? 0) >= (props.room.image_budget ?? 0)) return;
    const next = props.initialImages.find((i) => i.status === 'suggested');
    if (!next || autoImg.current || genImg) return;
    autoImg.current = true;
    makeImage(next.id, true).finally(() => { autoImg.current = false; });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.initialImages, props.room.image_used, props.room.image_budget]);

  async function upgrade(plan: 'monthly' | 'yearly') {
    setUpBusy(plan);
    try {
      const r = await fetch('/api/billing/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ plan, returnTo: `/room/${props.room.id}` }) });
      const d = await r.json();
      if (d.url) { window.location.href = d.url; return; }
      notify(d.error || (EN(lang) ? 'Failed' : '创建支付失败'));
    } catch { notify(EN(lang) ? 'Network error' : '网络错误'); }
    setUpBusy('');
  }

  const en = EN(lang);
  const [sheet, setSheet] = useState<null | 'me' | 'clues' | 'goal'>(null);
  const solo = players.length <= 1;
  const [mode, setMode] = useState<'act' | 'chat'>('act');
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // 新线索提示：线索数增加时弹一条小卡片
  const [toast, setToast] = useState<string | null>(null);
  const clueCount = useRef(props.initialClues.length);
  useEffect(() => {
    const n = props.initialClues.length;
    if (n > clueCount.current) {
      const c = props.initialClues[n - 1];
      setToast(c?.title || (en ? 'New clue' : '新线索'));
      try { playAnswerSfx('right'); } catch {}
      const id = setTimeout(() => setToast(null), 3800);
      clueCount.current = n;
      return () => clearTimeout(id);
    }
    clueCount.current = n;
  }, [props.initialClues, en]);

  // 故事流：消息 + 已画好的场景图，按时间合在一起
  const stream = (() => {
    const imgs = doneImages.map((i) => ({ __img: true, ...i }));
    const all: any[] = [...messages, ...imgs];
    return all.sort((a, b) => String(a.created_at || '').localeCompare(String(b.created_at || '')));
  })();

  const myOptions: string[] = (() => {
    if (!guidance) return [];
    const arr = Array.isArray(guidance.options) ? guidance.options : [];
    return arr.map((o: any) => typeof o === 'string' ? { for: 'all', text: o } : { for: o.for || 'all', text: o.text || '' })
      .filter((o: any) => o.text && (o.for === 'all' || o.for === props.mySeat)).map((o: any) => o.text).slice(0, 4);
  })();
  const goal = (() => {
    if (!guidance) return null;
    const k = props.mySeat === 'A' ? 'a' : props.mySeat === 'B' ? 'b' : '';
    const g = (k && guidance[k]) || { location: guidance.location, goal: guidance.goal, investigables: guidance.investigables };
    return g && (g.location || g.goal) ? g : null;
  })();

  const canAct = !!props.myPlayerId && !myReady && !resolving && !ended && !myOut;
  function send() {
    if (mode === 'chat' && !solo) { sendChat(); return; }
    submitAction(text, action);
    setAction('free');
  }
  // 输入框自动长高（最多 4 行）
  useEffect(() => {
    const el = inputRef.current; if (!el) return;
    el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight, 112) + 'px';
  }, [text]);

  const others = [...players].filter((p) => p.seat !== props.mySeat).sort((a, b) => a.seat.localeCompare(b.seat));
  const waitingOn = others.filter((p) => !room.pending_actions?.[p.seat]?.content).map((p) => charNameOrUser(p.seat));
  const clueTotal = props.initialClues.length;
  const worldTurns = new Set(messages.filter((m) => m.sender_type === 'kp' && /【世界状态变化】/.test(m.content || '')).map((m) => m.turn_no));

  return (
    <main className="mn-coc relative h-[100svh] flex flex-col overflow-hidden">
      {showUpgrade && (
        <div className="fixed inset-0 z-[80] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowUpgrade(false)}>
          <div className="w-full max-w-sm rounded-2xl bg-[#121318] border border-[#c9a96e]/25 shadow-2xl p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-1"><span className="font-serif text-[#efe6d2] text-lg">{en ? 'Unlock scene art' : '解锁场景配图'}</span><button onClick={() => setShowUpgrade(false)} className="text-parchment/50 hover:text-parchment px-2">✕</button></div>
            <p className="text-parchment/55 text-sm mb-4">{en ? 'Membership turns on AI scene images for this game and all your games — unlimited. Upgrade now and keep playing this very session.' : '开通会员即可为本局(以及你所有对局)无限生成 AI 场景配图。立即升级,不用重开,这一局马上就能出图。'}</p>
            <div className="space-y-2">
              <button onClick={() => upgrade('monthly')} disabled={!!upBusy} className="w-full py-3 rounded-xl bg-[#7d1d1d] border border-[#a83232]/60 text-[#f2ead9] disabled:opacity-40 flex items-center justify-between px-4"><span>{en ? 'Monthly' : '月费会员'}</span><span className="font-serif">$10<span className="text-parchment/50 text-xs">/mo</span></span></button>
              <button onClick={() => upgrade('yearly')} disabled={!!upBusy} className="w-full py-3 rounded-xl bg-white/[0.04] border border-white/10 text-parchment disabled:opacity-40 flex items-center justify-between px-4"><span>{en ? 'Yearly · save 50%' : '年费会员 · 省 50%'}</span><span className="font-serif">$60<span className="text-parchment/50 text-xs">/yr</span></span></button>
            </div>
            <p className="text-[11px] text-parchment/35 mt-3">{en ? 'Paid via Stripe. You return here right after.' : '通过 Stripe 安全支付,付完自动回到本局。'}</p>
          </div>
        </div>
      )}
      <iframe
        ref={sceneRef}
        src="/coc3d-demo.html?embed=1"
        title=""
        aria-hidden
        tabIndex={-1}
        onLoad={() => { try { sceneRef.current?.contentWindow?.postMessage({ type: 'scene', state: scene3d }, '*'); } catch {} }}
        className="fixed inset-0 w-full h-full border-0 pointer-events-none -z-10"
      />
      {/* 压暗背景，让文字始终好读 */}
      <div aria-hidden className="fixed inset-0 -z-[5] pointer-events-none bg-[radial-gradient(120%_80%_at_50%_30%,rgba(11,12,15,.35),rgba(11,12,15,.88))]" />

      {/* ── 顶部：我的状态（一行） ── */}
      <header className="shrink-0 px-3" style={{ paddingTop: 'calc(max(10px, env(safe-area-inset-top)) + 50px)' }}>
        <div className="mx-auto max-w-2xl flex items-center gap-2.5 h-14 px-2.5 rounded-2xl bg-[#0e0f13]/70 backdrop-blur-md border border-white/[0.07]">
          <button onClick={() => setSheet('me')} className="flex items-center gap-2.5 min-w-0 flex-1 text-left">
            <Avatar char={myChar} size={38} />
            <span className="min-w-0 flex-1">
              <span className="block text-[13.5px] text-[#efe6d2] font-serif truncate leading-tight">{myChar?.name || (en ? 'You' : '你')}</span>
              <span className="mt-1 flex items-center gap-2">
                <MiniBar v={myChar?.hp_current} m={myChar?.hp_max} c="#b3413d" label="HP" />
                <MiniBar v={myChar?.san_current} m={myChar?.san_max} c="#5aa39a" label="SAN" />
              </span>
            </span>
          </button>
          <span className="w-px h-7 bg-white/10" />
          <Suspicion value={room.suspicion || 0} en={en} />
          <button onClick={() => setSheet('clues')} className="relative h-10 pl-2.5 pr-3 rounded-xl bg-white/[0.04] border border-white/[0.08] flex items-center gap-1.5 text-[12.5px] text-[#d8c7a8]">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="11" cy="11" r="6.5" /><path d="M20 20l-4.2-4.2" /></svg>
            {en ? 'Clues' : '线索'}
            <span className={`min-w-[18px] h-[18px] px-1 rounded-full text-[10.5px] flex items-center justify-center ${clueTotal ? 'bg-[#c9a96e] text-[#14110b]' : 'bg-white/10 text-parchment/50'} ${toast ? 'mn-ping' : ''}`}>{clueTotal}</span>
          </button>
        </div>
        <Clock clock={room.world_clock} round={room.current_round || 1} en={en} />
      </header>

      {toast && (
        <button onClick={() => { setToast(null); setSheet('clues'); }} className="fixed left-1/2 -translate-x-1/2 z-[55] nf-in max-w-[86vw] flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-[#17140d]/95 border border-[#c9a96e]/40 shadow-[0_10px_40px_rgba(0,0,0,.6)]" style={{ top: 'calc(max(10px, env(safe-area-inset-top)) + 118px)' }}>
          <span className="text-[#c9a96e] text-[11px] tracking-[.2em] shrink-0">{en ? 'NEW CLUE' : '新线索'}</span>
          <span className="text-[13.5px] text-[#efe6d2] truncate">{toast}</span>
        </button>
      )}

      {/* ── 故事 ── */}
      <section ref={scrollRef as any} onScroll={(e) => { const el = e.currentTarget; nearBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 160; if (nearBottom.current && newBelow) setNewBelow(false); }} className="relative flex-1 min-h-0 overflow-y-auto mn-fade-top">
        <div className="mx-auto max-w-2xl px-4 pt-5 pb-6 space-y-4">
          <div className="text-center text-[11px] tracking-[.3em] text-parchment/30">{en ? `ROUND ${room.current_round || 1}` : `第 ${room.current_round || 1} 回合`}</div>
          {stream.map((m) => m.__img
            ? <SceneImage key={'i' + m.id} img={m} en={en} />
            : <div key={m.id} id={'m-' + m.id} className="scroll-mt-4"><MessageRow m={m} mine={m.sender_player_id === props.myPlayerId} mySeat={props.mySeat}
                worldInNarr={worldTurns.has(m.turn_no)}
                seat={playerById(m.sender_player_id)?.seat} who={charNameOrUser(playerById(m.sender_player_id)?.seat || '')} lang={lang} /></div>
          )}
          {(thinking || resolving) && <KeeperTyping en={en} />}
          <div ref={bottomRef} className="h-1" />
        </div>
      </section>

      {newBelow && (
        <button onClick={() => { setNewBelow(false); const last = messages[messages.length - 1]; (last && document.getElementById('m-' + last.id) || bottomRef.current)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}
          className="mn-fadein absolute left-1/2 -translate-x-1/2 z-[40] h-9 px-4 rounded-full bg-[#17140d]/95 border border-[#c9a96e]/40 text-[12.5px] text-[#efe6d2] shadow-[0_8px_30px_rgba(0,0,0,.6)] flex items-center gap-1.5" style={{ bottom: 'calc(max(12px, env(safe-area-inset-bottom)) + 150px)' }}>
          {en ? 'New ↓' : '有新进展 ↓'}
        </button>
      )}
      {/* ── 底部：行动 ── */}
      <footer className="shrink-0 px-3 pt-2 bg-gradient-to-t from-[#0b0c0f] via-[#0b0c0f]/95 to-[#0b0c0f]/0" style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}>
        <div className="mx-auto max-w-2xl space-y-2">
          {ended ? (
            <EndedBanner roomId={props.room.id} lang={lang} isHost={props.userId === props.room.host_user_id} />
          ) : myOut ? (
            <div className="rounded-2xl border border-[#a83232]/40 bg-[#2a0e0e]/60 px-4 py-3.5 text-center text-[13.5px] text-[#e8b4b4]">{t('out_notice')}</div>
          ) : myReady ? (
            <div className="rounded-2xl border border-[#c9a96e]/25 bg-[#14120d]/85 backdrop-blur px-4 py-3">
              <div className="flex items-center gap-2 text-[11px] tracking-[.18em] text-[#c9a96e]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#c9a96e] animate-pulse" />
                {resolving ? (en ? 'THE KEEPER IS TELLING WHAT HAPPENS' : '守秘人正在讲述后果') : waitingOn.length ? (en ? `WAITING FOR ${waitingOn.join(', ')}` : `等 ${waitingOn.join('、')} 行动`) : (en ? 'SENT TO THE KEEPER' : '已交给守秘人')}
              </div>
              <div className="mt-1.5 flex items-start gap-3">
                <p className="flex-1 text-[14px] text-[#efe6d2]/90 leading-relaxed">{myPending}</p>
                {!resolving && <button onClick={withdrawAction} className="shrink-0 text-[12.5px] text-parchment/55 hover:text-parchment underline underline-offset-4 decoration-parchment/25">{t('withdraw')}</button>}
              </div>
            </div>
          ) : (
            <>
              {goal && (
                <button onClick={() => setSheet('goal')} className="w-full flex items-center gap-2 px-1 text-left text-[12.5px] text-parchment/55">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#c9a96e" strokeWidth="2" strokeLinecap="round"><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.4" /></svg>
                  <span className="truncate"><span className="text-[#d8c7a8]/85">{goal.location}</span>{goal.goal ? <span className="text-parchment/40"> · {goal.goal}</span> : null}</span>
                </button>
              )}
              {myOptions.length > 0 && (
                <p className="px-1 text-[12px] leading-relaxed text-parchment/35 italic line-clamp-2">
                  {en ? 'Perhaps: ' : '也许可以：'}{myOptions.join(en ? ' / ' : '、')}{en ? ' — or anything you can think of.' : '……或者任何你想到的事。'}
                </p>
              )}
              <div className="flex items-end gap-2">
                {!solo && (
                  <button onClick={() => setMode(mode === 'act' ? 'chat' : 'act')} title={en ? 'Switch: act / talk to party' : '切换：行动 / 对队友说'}
                    className={`shrink-0 h-12 w-12 rounded-2xl border flex flex-col items-center justify-center text-[10px] gap-0.5 ${mode === 'act' ? 'border-[#a83232]/50 bg-[#7d1d1d]/30 text-[#f2d6d6]' : 'border-[#5aa39a]/50 bg-[#5aa39a]/15 text-[#cfe9e4]'}`}>
                    {mode === 'act'
                      ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M5 19l9-9M14 5l5 5-3 3-5-5z" /></svg>
                      : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 5h16v11H9l-5 4z" /></svg>}
                    {mode === 'act' ? (en ? 'Act' : '行动') : (en ? 'Party' : '队内')}
                  </button>
                )}
                <div className={`flex-1 min-w-0 flex items-end rounded-2xl border bg-[#0f1014]/90 backdrop-blur pl-4 pr-1.5 py-1.5 transition ${mode === 'chat' && !solo ? 'border-[#5aa39a]/35' : 'border-white/[0.12] focus-within:border-[#c9a96e]/50'}`}>
                  <textarea ref={inputRef} rows={1} value={text} onChange={(e) => setText(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !(e.nativeEvent as any).isComposing) { e.preventDefault(); send(); } }}
                    placeholder={mode === 'chat' && !solo ? (en ? 'Say something to the party…' : '对队友说……') : (en ? 'What do you do?' : '你要做什么？')}
                    disabled={!props.myPlayerId || (mode === 'act' && !canAct)}
                    style={{ resize: 'none' }} className="flex-1 min-w-0 resize-none bg-transparent py-[7px] text-[15px] leading-[22px] text-[#efe6d2] placeholder:text-parchment/35 outline-none disabled:opacity-50" />
                  <MicButton value={text} onChange={setText} en={en} compact />
                </div>
                <button onClick={send} disabled={!text.trim() || (mode === 'act' && !canAct) || thinking} aria-label={en ? 'Send' : '发送'}
                  className="shrink-0 h-12 w-12 rounded-2xl bg-[#7d1d1d] border border-[#a83232]/60 text-[#f2ead9] flex items-center justify-center disabled:opacity-35 enabled:shadow-[0_0_22px_rgba(168,50,50,.35)]">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19V5M5.5 11.5L12 5l6.5 6.5" /></svg>
                </button>
              </div>
            </>
          )}
        </div>
      </footer>

      {/* ── 抽屉 ── */}
      <Sheet open={sheet === 'me'} onClose={() => setSheet(null)} title={en ? 'Investigators' : '调查员'}>
        <div className="space-y-3">
          {[...players].sort((a, b) => (a.seat === props.mySeat ? -1 : b.seat === props.mySeat ? 1 : a.seat.localeCompare(b.seat))).map((p) => (
            <CharacterCard key={p.seat} char={charOfSeat(p.seat)} name={nameOfUser(p?.user_id)} online={!!online[p?.user_id as string]} me={p.seat === props.mySeat} lang={lang} />
          ))}
        </div>
      </Sheet>
      <Sheet open={sheet === 'goal'} onClose={() => setSheet(null)} title={en ? 'Where you are' : '你现在'}>
        {goal && (
          <div className="space-y-4 text-[14px]">
            <Field k={en ? 'Location' : '位置'} v={goal.location} />
            <Field k={en ? 'Goal' : '目标'} v={goal.goal} />
            {Array.isArray(goal.investigables) && goal.investigables.length > 0 && (
              <div>
                <div className="text-[11px] tracking-[.2em] text-[#c9a96e]/80 mb-2">{en ? 'WORTH A LOOK' : '身边值得查的'}</div>
                <p className="text-[14px] text-[#efe6d2]/80 leading-relaxed">{goal.investigables.join(en ? ' · ' : '、')}</p>
              </div>
            )}
            <p className="text-[12.5px] text-parchment/40 leading-relaxed">{en ? 'Nothing here is a list of choices — do whatever you think of.' : '这些不是选项——你想做什么，直接打字或说出来就行。'}</p>
          </div>
        )}
      </Sheet>
      <Sheet open={sheet === 'clues'} onClose={() => setSheet(null)} title={en ? 'Casebook' : '调查笔记'}>
        <div className="space-y-6">
          {doneImages.length > 0 && (
            <div>
              <SheetLabel>{en ? 'Scenes' : '现场'}</SheetLabel>
              <div className="grid grid-cols-2 gap-2">
                {doneImages.map((img) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={img.id} src={img.storage_url} alt="" className="rounded-xl border border-white/10 w-full aspect-square object-cover" />
                ))}
              </div>
            </div>
          )}
          <div>
            <SheetLabel>{en ? 'Clues' : '线索'}</SheetLabel>
            {props.initialClues.length === 0 ? <p className="text-[13px] text-parchment/35">{t('clue_empty')}</p> : <ClueBoard clues={props.initialClues} roomId={props.room.id} lang={lang} />}
          </div>
          {props.initialNpcs.length > 0 && (
            <div>
              <SheetLabel>{en ? 'People met' : '遇到的人'}</SheetLabel>
              <ul className="space-y-2">
                {props.initialNpcs.map((n) => (
                  <li key={n.id} className="flex items-baseline gap-2 text-[14px] text-[#efe6d2]/90">{n.name}<span className="text-parchment/40 text-[12px]">{n.role}</span></li>
                ))}
              </ul>
            </div>
          )}
          {suggestedImages.some((i) => i.status === 'failed') && (
            <div>
              <SheetLabel>{en ? 'Scene art' : '配图'}</SheetLabel>
              {suggestedImages.filter((i) => i.status === 'failed').map((img) => (
                <button key={img.id} onClick={() => makeImage(img.id)} disabled={genImg === img.id} className="w-full mb-2 px-3 py-2 rounded-xl border border-white/10 text-[12.5px] text-parchment/70 text-left disabled:opacity-50">
                  {genImg === img.id ? (en ? 'Drawing…' : '正在画…') : (en ? 'Retry: ' : '重画：') + (IMG_TYPE[en ? 'en' : 'zh'][img.image_type] || '')}
                </button>
              ))}
            </div>
          )}
          <p className="text-[11.5px] text-parchment/30">{t('dash_img_budget')} {room.image_used}/{room.image_budget}</p>
        </div>
      </Sheet>
    </main>
  );
}

function Avatar({ char, size }: { char: any; size: number }) {
  return (
    <span className="relative shrink-0 rounded-full overflow-hidden border border-[#c9a96e]/40 bg-[#c9a96e]/[0.07] flex items-end justify-center" style={{ width: size, height: size }}>
      {char?.avatar_url
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={char.avatar_url} alt="" className="w-full h-full object-cover" />
        : <svg width={size * 0.8} height={size * 0.8} viewBox="0 0 24 24" fill="rgba(216,199,168,.22)"><circle cx="12" cy="9" r="4.2" /><path d="M3.5 22c.8-4.6 4.3-7.2 8.5-7.2s7.7 2.6 8.5 7.2z" /></svg>}
    </span>
  );
}

function MiniBar({ v, m, c, label }: { v?: number; m?: number; c: string; label: string }) {
  const pct = m ? Math.max(0, Math.min(100, ((v || 0) / m) * 100)) : 0;
  const low = pct <= 30;
  return (
    <span className="flex items-center gap-1.5 min-w-0">
      <span className="text-[9.5px] tracking-wider text-parchment/40">{label}</span>
      <span className="w-12 sm:w-16 h-[5px] rounded-full bg-white/10 overflow-hidden"><span className={`block h-full rounded-full transition-[width] duration-700 ${low ? 'animate-pulse' : ''}`} style={{ width: `${pct}%`, background: c }} /></span>
      <span className={`text-[10.5px] tabular-nums ${low ? 'text-[#e06060]' : 'text-parchment/55'}`}>{v ?? '–'}</span>
    </span>
  );
}

function Suspicion({ value, en }: { value: number; en: boolean }) {
  const lv = value >= 12 ? 3 : value >= 8 ? 2 : value >= 3 ? 1 : 0;
  const notes = en ? ['Calm', 'Watched', 'Lockdown', 'Hunted'] : ['平静', '被注意', '封锁', '被追捕'];
  const color = ['rgba(216,199,168,.45)', '#d6a64a', '#e0773d', '#e04848'][lv];
  return (
    <span className="flex flex-col items-center justify-center px-1 shrink-0" title={(en ? 'Suspicion ' : '嫌疑 ') + value}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" className={lv >= 2 ? 'animate-pulse' : ''}><path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z" /><circle cx="12" cy="12" r="2.6" fill={lv ? color : 'none'} /></svg>
      <span className="text-[9.5px] mt-0.5" style={{ color }}>{notes[lv]}</span>
    </span>
  );
}

function Clock({ clock, round, en }: { clock: any[]; round: number; en: boolean }) {
  const ev = (Array.isArray(clock) ? clock : [])
    .filter((e) => e && !e.fired && !e.hidden && (Number(e.due_round) || 0) >= round)
    .sort((a, b) => (a.due_round || 0) - (b.due_round || 0))[0];
  if (!ev) return null;
  const left = Math.max(0, (ev.due_round || 0) - round);
  return (
    <div className="mx-auto max-w-2xl mt-1.5 flex items-center justify-center gap-2 text-[12px] text-[#e3b66a]/85">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="13" r="8" /><path d="M12 9v4l2.5 2M9 2h6" /></svg>
      <span className="truncate">{ev.label}</span>
      <span className="text-[#e3b66a]/55 shrink-0">· {left === 0 ? (en ? 'this round' : '就在这回合') : en ? `${left} rounds` : `还剩 ${left} 回合`}</span>
    </div>
  );
}

function KeeperTyping({ en }: { en: boolean }) {
  return (
    <div className="flex items-center justify-center gap-2.5 py-3 text-[12.5px] tracking-[.18em] text-[#c9a96e]/75">
      <span className="flex gap-1">{[0, 1, 2].map((i) => <span key={i} className="w-1.5 h-1.5 rounded-full bg-[#c9a96e]/80 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />)}</span>
      {en ? 'The Keeper is speaking' : '守秘人正在讲述'}
    </div>
  );
}

function SceneImage({ img, en }: { img: any; en: boolean }) {
  return (
    <figure className="nf-in mx-auto max-w-2xl rounded-2xl overflow-hidden border border-white/10 shadow-[0_20px_60px_rgba(0,0,0,.5)]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={img.storage_url} alt="" className="w-full max-h-[52vh] object-cover" />
      <figcaption className="px-3 py-1.5 text-[10.5px] tracking-[.22em] text-parchment/40 bg-black/40">{IMG_TYPE[en ? 'en' : 'zh'][img.image_type] || ''}</figcaption>
    </figure>
  );
}

function MessageRow({ m, mine, seat, who, lang, mySeat, worldInNarr }: { m: any; mine: boolean; seat?: string; who: string; lang: string; mySeat?: string | null; worldInNarr?: boolean }) {
  const t = tr(lang);
  const en = EN(lang);
  const type = m.payload?.type;
  if (m.sender_type === 'system' && type === 'ending') {
    return <Narration text={m.content} lang={lang} fresh={fresh(m)} tone="reveal" label={en ? 'Ending' : '结局'} collapse={false} />;
  }
  if (m.sender_type === 'system' && type === 'world') {
    // 旧消息格式：【世界反应】xxx · 嫌疑值 +2（现 5）
    const raw = String(m.content || '').replace(/^【世界反应】/, '');
    const dm = raw.match(/嫌疑值\s*([+-]\d+)/);
    const delta = typeof m.payload?.delta === 'number' ? m.payload.delta : dm ? Number(dm[1]) : 0;
    const text = raw.replace(/\s*·?\s*嫌疑值[^·]*$/, '').trim();
    return <Omen delta={delta} text={worldInNarr ? '' : text} en={en} />;
  }
  if (m.sender_type === 'system') {
    if (type === 'private') {
      return (
        <div className="rounded-2xl bg-[#2a0e0e]/55 border border-[#a83232]/35 px-4 py-3 text-[14px] text-[#efe6d2]/90 leading-relaxed">
          <div className="text-[10.5px] tracking-[.22em] text-[#e08a8a] mb-1">{en ? 'ONLY YOU' : '只有你知道'}</div>{m.content}
        </div>
      );
    }
    const st: Record<string, string> = {
      world: 'text-[#e3b66a] border-[#e3b66a]/25 bg-[#e3b66a]/[0.06]',
      deduction: 'text-[#8fd3b8] border-[#8fd3b8]/25 bg-[#8fd3b8]/[0.06]',
      dice: 'text-[#d8c7a8]/80 border-white/10 bg-white/[0.03]',
      san: 'text-[#9fd0c8] border-[#5aa39a]/30 bg-[#5aa39a]/[0.08]',
      combat: 'text-[#ef8f8f] border-[#a83232]/30 bg-[#a83232]/[0.08]',
    };
    const icon = type === 'dice' ? '⚂ ' : type === 'san' ? '◎ ' : type === 'combat' ? '✕ ' : type === 'deduction' ? '◆ ' : type === 'world' ? '⏳ ' : '';
    return (
      <div className="flex justify-center">
        <span className={`max-w-full px-3.5 py-1.5 rounded-full border text-[12.5px] leading-snug text-center ${st[type] || 'text-parchment/45 border-white/[0.06] bg-transparent'}`}>{icon}{m.content}</span>
      </div>
    );
  }
  if (m.sender_type === 'kp') {
    const sst = String(m.payload?.scene_state || '');
    const tone = /MONSTER|CHASE|COMBAT|FINAL|PARANORMAL|COSMIC|BAD/.test(sst) ? 'danger' : /BREAKTHROUGH|TRUTH|CLUE|GOOD/.test(sst) ? 'reveal' : 'kp';
    const turn = splitTurn(m.content);
    if (!turn) return <Narration text={m.content} lang={lang} fresh={fresh(m)} tone={tone as any} label={t('kp')} />;
    return <KpTurn turn={turn} m={m} lang={lang} tone={tone} mySeat={mySeat} />;
  }
  const chat = m.action_type === 'chat';
  return (
    <div className={`flex flex-col ${mine ? 'items-end' : 'items-start'}`}>
      <span className="text-[11px] text-parchment/35 mb-1 px-1">{mine ? (en ? 'You' : '你') : who}{chat ? (en ? ' · to the party' : ' · 对队友') : ''}</span>
      <div className={`max-w-[86%] px-4 py-2.5 text-[14.5px] leading-relaxed ${chat
        ? 'rounded-2xl border border-[#5aa39a]/25 bg-[#5aa39a]/[0.08] text-[#d9ece8] italic'
        : mine ? 'rounded-2xl rounded-br-md border border-[#c9a96e]/30 bg-[#c9a96e]/[0.09] text-[#efe6d2]'
          : 'rounded-2xl rounded-bl-md border border-white/10 bg-white/[0.04] text-[#efe6d2]/90'}`}>{m.content}</div>
    </div>
  );
}

// 守秘人一回合的旁白：按「谁的行动结果」切开。你的那段在最前、完整展开；队友的折叠成一行，想看再点开。
type Turn = { intro: string; secs: { seat: string; name: string; text: string }[]; world: string };
function splitTurn(content: string): Turn | null {
  const re = /【\s*([^】（(]+?)\s*[（(]\s*([A-F])\s*[）)][^】]*】|【\s*(世界状态变化|世界反应|四周)\s*】/g;
  const hits = Array.from(String(content || '').matchAll(re));
  if (!hits.length) return null;
  const t: Turn = { intro: content.slice(0, hits[0].index).trim(), secs: [], world: '' };
  hits.forEach((h, i) => {
    const body = content.slice((h.index || 0) + h[0].length, i + 1 < hits.length ? hits[i + 1].index : undefined).trim();
    if (h[3]) t.world = (t.world ? t.world + '\n' : '') + body;
    else t.secs.push({ name: h[1].trim(), seat: h[2], text: body });
  });
  return t;
}
function voiceText(content: string, mySeat?: string | null): string {
  const t = splitTurn(content);
  if (!t) return content;
  const mine = t.secs.find((s) => s.seat === mySeat) || t.secs[0];
  return [t.intro, mine?.text, t.world].filter(Boolean).join('\n\n');
}

function KpTurn({ turn, m, lang, tone, mySeat }: { turn: Turn; m: any; lang: string; tone: string; mySeat?: string | null }) {
  const en = EN(lang);
  const mine = turn.secs.find((s) => s.seat === mySeat) || null;
  const others = turn.secs.filter((s) => s !== mine);
  const isFresh = fresh(m);
  return (
    <div className="space-y-3">
      {turn.intro && <Narration text={turn.intro} lang={lang} fresh={isFresh} tone={tone as any} label={en ? 'Keeper' : '守秘人'} />}
      {mine && <Narration text={mine.text} lang={lang} fresh={isFresh && !turn.intro} tone={tone as any} label={en ? 'You' : '你这边'} />}
      {others.map((o) => <OtherPart key={o.seat} o={o} lang={lang} tone={tone} first={!mine && !turn.intro && o === others[0]} fresh={isFresh} />)}
      {turn.world && <Omen text={turn.world} delta={0} en={en} plain />}
    </div>
  );
}

function OtherPart({ o, lang, tone, first, fresh: isFresh }: { o: { seat: string; name: string; text: string }; lang: string; tone: string; first: boolean; fresh: boolean }) {
  const en = EN(lang);
  const [open, setOpen] = useState(first);
  const preview = o.text.replace(/\*\*|!!|\(\(|\)\)|\[\[|\]\]|「|」/g, '').replace(/\s+/g, ' ').slice(0, 34);
  if (open) return (
    <div className="relative">
      <Narration text={o.text} lang={lang} fresh={first && isFresh} tone={tone as any} label={en ? `${o.name}'s side` : `${o.name} 那边`} collapse={false} />
      {!first && <button onClick={() => setOpen(false)} className="mt-1 ml-1 text-[12px] text-parchment/40">{en ? 'Fold' : '收起'}</button>}
    </div>
  );
  return (
    <button onClick={() => setOpen(true)} className="w-full text-left rounded-2xl border border-white/[0.08] bg-white/[0.025] px-4 py-3 flex items-center gap-3 hover:border-white/15">
      <span className="shrink-0 w-7 h-7 rounded-full border border-white/15 flex items-center justify-center text-[12px] text-parchment/60">{o.name.slice(0, 1)}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-[12px] text-parchment/45">{en ? `Meanwhile, ${o.name}` : `与此同时，${o.name}`}</span>
        <span className="block text-[13.5px] text-[#efe6d2]/70 truncate">{preview}…</span>
      </span>
      <span className="shrink-0 text-[12px] text-[#c9a96e]/70">{en ? 'Read' : '展开'}</span>
    </button>
  );
}

// 世界的动静：不写数字和术语，只用一个直觉的标题告诉你"情况变了"
function Omen({ text, delta, en, plain }: { text: string; delta: number; en: boolean; plain?: boolean }) {
  const lv = delta >= 3 ? 3 : delta > 0 ? 2 : delta < 0 ? 0 : 1;
  if (!text && lv === 1) return null;
  const head = [en ? 'Things ease off a little' : '风声松了些', en ? 'Something has changed' : '四周起了变化', en ? 'Someone is starting to notice you' : '有人开始注意你们了', en ? 'This is going very wrong' : '大事不妙'][lv];
  const c = ['#8fd3b8', '#c9a96e', '#e3a04a', '#e05a4a'][lv];
  return (
    <div className="flex gap-3 items-start px-1 nf-in">
      <span className="mt-[3px] shrink-0 w-6 h-6 rounded-full flex items-center justify-center" style={{ background: c + '1f', border: `1px solid ${c}55` }}>
        {lv >= 2
          ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.2" strokeLinecap="round"><path d="M12 8v5M12 17h.01" /><path d="M10.3 3.9L2.6 17.5A2 2 0 0 0 4.3 20.5h15.4a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" /></svg>
          : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round"><path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z" /><circle cx="12" cy="12" r="2.4" /></svg>}
      </span>
      <div className="min-w-0">
        {!plain || lv !== 1 ? <div className={`text-[12px] tracking-[.12em] ${lv === 3 ? 'animate-pulse' : ''}`} style={{ color: c }}>{plain ? (en ? 'Around you' : '四周') : head}</div> : <div className="text-[12px] tracking-[.12em]" style={{ color: c }}>{en ? 'Around you' : '四周'}</div>}
        {text && <p className="mt-0.5 text-[13.5px] leading-relaxed text-[#efe6d2]/65 italic">{text}</p>}
      </div>
    </div>
  );
}

function CharacterCard({ char, name, online, me, lang }: { char: any; name: string; online: boolean; me: boolean; lang: string }) {
  const en = EN(lang);
  const flags = char?.status_flags || {};
  const STAT = en
    ? { retired: 'Out', indef: 'Insane', temp: 'Temp. insane', dying: 'Dying', wounded: 'Wounded', ok: 'Steady' }
    : { retired: '退场', indef: '长期疯狂', temp: '临时疯狂', dying: '濒死', wounded: '受伤', ok: '尚好' };
  const status = flags.retired ? STAT.retired : flags.indef_insanity ? STAT.indef : flags.temp_insanity ? STAT.temp : flags.dying ? STAT.dying : flags.wounded ? STAT.wounded : STAT.ok;
  return (
    <div className={`rounded-2xl border p-4 ${me ? 'border-[#c9a96e]/30 bg-[#c9a96e]/[0.05]' : 'border-white/10 bg-white/[0.03]'}`}>
      <div className="flex items-center gap-3">
        <span className="relative"><Avatar char={char} size={52} /><span className={`absolute bottom-0.5 right-0.5 w-2.5 h-2.5 rounded-full ring-2 ring-[#111216] ${online ? 'bg-[#6fcf8e]' : 'bg-white/25'}`} /></span>
        <div className="min-w-0 flex-1">
          <div className="font-serif text-[16px] text-[#efe6d2] truncate">{char?.name || name}{me && <span className="ml-2 text-[11px] text-[#c9a96e]">{en ? 'you' : '你'}</span>}</div>
          <div className="text-[12.5px] text-parchment/50 truncate">{char?.occupation}{char?.current_location ? ` · ${char.current_location}` : ''}</div>
        </div>
        <span className={`text-[11.5px] px-2 py-0.5 rounded-full border ${status === STAT.ok ? 'border-white/10 text-parchment/50' : 'border-[#a83232]/50 text-[#ef8f8f]'}`}>{status}</span>
      </div>
      {char && (
        <div className="mt-3.5 space-y-2.5">
          <Bar label="HP" v={char.hp_current} m={char.hp_max} c="#b3413d" />
          <Bar label={en ? 'SAN' : '理智'} v={char.san_current} m={char.san_max} c="#5aa39a" />
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] text-parchment/55 pt-1">
            <span>{en ? 'Luck' : '幸运'} <span className="text-[#efe6d2]/80">{char.luck}</span></span>
            {char.resources && Object.entries(char.resources).map(([k, v]) => <span key={k}>{k} <span className="text-[#efe6d2]/80">{String(v)}</span></span>)}
          </div>
          {Array.isArray(char.inventory) && char.inventory.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-0.5">{char.inventory.map((x: string, i: number) => <span key={i} className="px-2.5 py-1 rounded-lg bg-white/[0.05] border border-white/[0.07] text-[12px] text-parchment/70">{x}</span>)}</div>
          )}
        </div>
      )}
    </div>
  );
}

function Bar({ label, v, m, c }: { label: string; v: number; m: number; c: string }) {
  const pct = m ? Math.max(0, Math.min(100, (v / m) * 100)) : 0;
  return (
    <div>
      <div className="flex justify-between text-[11.5px] text-parchment/50 mb-1"><span>{label}</span><span className="tabular-nums">{v}/{m}</span></div>
      <div className="h-2 rounded-full bg-white/[0.07] overflow-hidden"><div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${pct}%`, background: c }} /></div>
    </div>
  );
}

function ClueBoard({ clues, roomId, lang }: { clues: any[]; roomId: string; lang: string }) {
  const router = useRouter();
  const t = tr(lang);
  const [sel, setSel] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const toggle = (id: string) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  async function deduce() {
    if (sel.length < 2 || busy) return;
    setBusy(true); setMsg('');
    try {
      const res = await fetch('/api/clues/combine', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId, clueIds: sel }),
      });
      const d = await res.json();
      if (!res.ok) setMsg(d.error || (EN(lang) ? 'Deduction failed' : '推理失败'));
      else if (d.combines) { setMsg('🧩 ' + d.conclusion); setSel([]); router.refresh(); }
      else setMsg(d.message || (EN(lang) ? 'These clues don’t add up to anything new yet.' : '这些线索暂时拼不出新结论。'));
    } catch (e: any) { setMsg(e.message); }
    finally { setBusy(false); }
  }

  const T = THREADS_L[EN(lang) ? 'en' : 'zh'];
  const deductions = clues.filter((c) => c.kind === 'deduction');
  const facts = clues.filter((c) => c.kind !== 'deduction');
  const groups: Record<string, any[]> = {};
  for (const c of facts) {
    const k = ['A', 'B', 'C', 'D', 'E'].includes(c.thread) ? c.thread : '其他';
    (groups[k] = groups[k] || []).push(c);
  }
  const order = ['A', 'B', 'C', 'D', 'E', '其他'].filter((k) => groups[k]?.length);

  return (
    <div className="space-y-3">
      {deductions.length > 0 && (
        <div>
          <div className="text-[10px] uppercase tracking-wider text-emerald-400/80 mb-1">{EN(lang) ? '🧩 Deductions' : '🧩 已得推论'}</div>
          <ul className="space-y-2">
            {deductions.map((c) => (
              <li key={c.id} className="text-sm text-emerald-200/90 border-l-2 border-emerald-500/60 pl-2">
                <div className="font-medium">{c.title}</div>
                <div className="text-parchment/40 text-[10px]">{c.source}</div>
              </li>
            ))}
          </ul>
        </div>
      )}
      {order.map((k) => (
        <div key={k}>
          <div className="text-[10px] uppercase tracking-wider text-eldritch/70 mb-1">{T[k]}</div>
          <ul className="space-y-1.5">
            {groups[k].map((c) => {
              const on = sel.includes(c.id);
              return (
                <li key={c.id} onClick={() => toggle(c.id)}
                  className={`text-sm border-l-2 pl-2 py-0.5 cursor-pointer rounded-r ${on ? 'border-eldritch bg-eldritch/15' : 'border-eldritch/50 hover:bg-fog/60'}`}>
                  <div className="flex items-start gap-1.5">
                    <span className={`mt-0.5 w-3 h-3 rounded-sm border shrink-0 ${on ? 'bg-eldritch border-eldritch' : 'border-parchment/40'}`} />
                    <div>
                      <div className="font-medium text-parchment/80">{c.title}</div>
                      <div className="text-parchment/50 text-xs">{c.description}</div>
                      {c.visible_to !== 'all' && <span className="text-[10px] text-blood">{EN(lang) ? 'Only you · tell your partner' : '仅你可见 · 需告知队友'}</span>}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
      <div className="pt-1 border-t border-eldritch/15 space-y-1.5">
        <button onClick={deduce} disabled={sel.length < 2 || busy}
          className="w-full px-3 py-1.5 rounded bg-eldritch/40 hover:bg-eldritch/70 text-parchment text-xs disabled:opacity-40">
          {busy ? t('deducing') : t('deduce_btn', { n: sel.length })}
        </button>
        <div className="text-[10px] text-parchment/35">{t('deduce_hint')}</div>
        {msg && <div className="text-xs text-emerald-300/90">{msg}</div>}
      </div>
    </div>
  );
}

function EndedBanner({ roomId, lang, isHost }: { roomId: string; lang: string; isHost: boolean }) {
  const t = tr(lang);
  const [recap, setRecap] = useState<any>(null);
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState('');
  const [replaying, setReplaying] = useState(false);

  async function replay() {
    setReplaying(true);
    try {
      const res = await fetch('/api/rooms/replay', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ roomId }) });
      const d = await res.json();
      if (res.status === 402) { window.location.href = '/upgrade'; return; }
      if (!res.ok) { notify(d.error || (EN(lang) ? 'Failed' : '失败')); setReplaying(false); return; }
      // 成功后由实时刷新把双方带回"选择模组"
    } catch (e: any) { notify(e.message); setReplaying(false); }
  }
  const L = EN(lang)
    ? { truth: 'Truth: ', mind: 'Mastermind: ', sup: 'Supernatural: ', npc: 'NPC secrets: ', clues: 'Key clues: ', lie: 'lie: ', revealing: 'Unsealing the truth…' }
    : { truth: '真相：', mind: '幕后黑手：', sup: '超自然：', npc: 'NPC 秘密：', clues: '关键线索：', lie: '谎言：', revealing: '正在揭开封存的真相……' };

  async function load() {
    setOpen(true);
    if (recap) return;
    try {
      const res = await fetch('/api/recap', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ roomId }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setRecap(data);
    } catch (e: any) { setErr(e.message); }
  }

  return (
    <div className="bg-blood/15 border-b border-blood/40 px-4 py-3">
      <div className="flex items-center justify-between max-w-4xl mx-auto gap-3 flex-wrap">
        <span className="text-parchment font-serif">{t('ended_banner')}</span>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={load} className="px-4 py-1.5 rounded bg-blood/70 hover:bg-blood text-parchment text-sm">{t('view_recap')}</button>
          {isHost && (
            <button onClick={replay} disabled={replaying}
              className="px-4 py-1.5 rounded bg-eldritch/60 hover:bg-eldritch text-parchment text-sm border border-eldritch disabled:opacity-50">
              {replaying ? (EN(lang) ? 'Starting…' : '开始中…') : (EN(lang) ? '↻ Play again' : '↻ 再来一局')}
            </button>
          )}
        </div>
      </div>
      {!isHost && (
        <p className="text-center text-parchment/40 text-xs mt-2">{EN(lang) ? 'The host can start another game.' : '房主可以开启下一局。'}</p>
      )}
      {open && (
        <div className="max-w-4xl mx-auto mt-3 p-4 rounded-lg bg-ink border border-blood/40 text-sm text-parchment/85 space-y-3">
          {err && <p className="text-blood">{err}</p>}
          {recap && (
            <>
              {Array.isArray(recap.survivors) && recap.survivors.length > 0 && (
                <div className="flex flex-wrap gap-3 pb-2 border-b border-blood/20">
                  {recap.survivors.map((s: any, i: number) => (
                    <span key={i} className={`text-xs ${s.alive ? 'text-green-400' : 'text-blood'}`}>
                      {s.seat}·{s.name}：{s.status}（SAN {s.san}/{s.san_start}，HP {s.hp}/{s.hp_max}）
                    </span>
                  ))}
                </div>
              )}
              <div><span className="text-eldritch">{L.truth}</span>{recap.truth}</div>
              <div><span className="text-eldritch">{L.mind}</span>{recap.mastermind?.identity} —— {recap.mastermind?.motive}</div>
              {recap.supernatural?.nature && <div><span className="text-eldritch">{L.sup}</span>{recap.supernatural.nature}</div>}
              {Array.isArray(recap.npcs) && recap.npcs.length > 0 && (
                <div><span className="text-eldritch">{L.npc}</span>
                  <ul className="list-disc pl-5 mt-1 space-y-1">
                    {recap.npcs.map((n: any, i: number) => <li key={i}>{n.name}：{n.secret}{n.lie ? `（${L.lie}${n.lie}）` : ''}</li>)}
                  </ul>
                </div>
              )}
              {Array.isArray(recap.key_clues) && (
                <div><span className="text-eldritch">{L.clues}</span>
                  <ul className="list-disc pl-5 mt-1 space-y-1">
                    {recap.key_clues.map((c: any, i: number) => <li key={i}>{c.clue} → {c.reveals}</li>)}
                  </ul>
                </div>
              )}
              {Array.isArray(recap.scores) && recap.scores.length > 0 && (
                <div className="pt-2 border-t border-blood/20">
                  <span className="text-eldritch">{EN(lang) ? 'Player scorecard:' : '玩家评分：'}</span>
                  <div className="mt-2 space-y-2">
                    {recap.scores.map((s: any, i: number) => (
                      <div key={i} className="rounded bg-fog/50 border border-eldritch/20 p-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-parchment text-xs">{s.name}{s.seat ? ` [${s.seat}]` : ''}</span>
                          <span className="text-eldritch font-serif text-sm">{s.total}<span className="text-parchment/40 text-[10px]">/100</span></span>
                        </div>
                        <div className="mt-1.5 space-y-1">
                          {(s.metrics || []).map((mt: any, j: number) => (
                            <div key={j} className="flex items-center gap-2">
                              <span className="text-parchment/60 text-[10px] w-16 shrink-0 truncate">{mt.label}</span>
                              <div className="flex-1 h-1.5 rounded bg-ink overflow-hidden"><div className="h-full bg-eldritch/70" style={{ width: `${Math.max(0, Math.min(100, mt.score))}%` }} /></div>
                              <span className="text-parchment/70 text-[10px] w-6 text-right">{mt.score}</span>
                            </div>
                          ))}
                        </div>
                        {s.highlight && <div className="text-green-400/80 text-[10px] mt-1">👍 {s.highlight}</div>}
                        {s.improve && <div className="text-amber-400/80 text-[10px]">🔧 {s.improve}</div>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
          {!recap && !err && <p className="text-parchment/50">{L.revealing}</p>}
        </div>
      )}
    </div>
  );
}
