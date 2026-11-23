'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Stepper from './Stepper';
import ModuleSelection from './ModuleSelection';
import CharacterFlow from './CharacterFlow';
import Dashboard from './Dashboard';
import SoupRoom from './SoupRoom';
import TDRoom from './TDRoom';
import JbsRoom from './JbsRoom';
import BotcRoom from './BotcRoom';
import MccRoom from './MccRoom';
import DndRoom from './DndRoom';
import StoryRoom from './StoryRoom';
import AudioManager from './AudioManager';
import QuickCast from './QuickCast';

const EN = (l?: string) => l === 'en';

function jbsAudioState(room: any): string {
  const phase = room.jbs_phase;
  if (room.game_state === 'ended' || phase === 'reveal') return 'TRUTH_REVEAL';
  if (phase === 'vote') return 'FINAL_CONFRONTATION';
  if (phase === 'playing') return (room.jbs_act || 1) >= 3 ? 'EXPLORATION_DANGEROUS' : 'EXPLORATION_SAFE';
  return 'MENU';
}

function soupAudioState(room: any): string {
  if (room.game_state === 'ended') return 'TRUTH_REVEAL';
  if (room.game_state === 'playing') return 'EXPLORATION_SAFE';
  return 'MENU';
}
function botcAudioState(room: any): string {
  const ph = String(room.botc_phase || '');
  if (room.game_state === 'ended' || ph === 'reveal') return 'TRUTH_REVEAL';
  if (ph === 'night') return 'EXPLORATION_DANGEROUS';
  if (ph === 'vote') return 'FINAL_CONFRONTATION';
  if (ph === 'day') return 'INVESTIGATION_BREAKTHROUGH';
  return 'MENU';
}

function audioStateFor(room: any): string {
  const gs = room.game_state;
  if (['lobby', 'module_selection', 'case_locking'].includes(gs)) return 'MENU';
  if (['character_creation', 'attribute_allocation', 'skill_allocation', 'character_confirmation', 'rule_briefing'].includes(gs))
    return 'CHARACTER_CREATION';
  if (gs === 'playing') return (room.scene_state || 'EXPLORATION_SAFE').toUpperCase();
  if (gs === 'ended') return (room.scene_state || 'TRUTH_REVEAL').toUpperCase();
  return 'MENU';
}

function RoomExit({ en }: { en: boolean }) {
  return (
    <a href="/play" title={en ? 'Leave — you can come back from your hall' : '离开房间（3 小时内可从「我的大厅」回来）'}
      className="mn-exit fixed left-2 z-[60] h-9 pl-2 pr-3 rounded-full flex items-center gap-1 text-[13px] text-parchment/85 bg-[#0b0c0f]/75 backdrop-blur border border-[#d8c7a8]/15 hover:border-[#c9a96e]/50"
      style={{ top: 'max(10px, env(safe-area-inset-top))' }}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
      {en ? 'Leave' : '离开'}
    </a>
  );
}

export type ShellProps = {
  room: any;
  initialPlayers: any[];
  initialUsers: any[];
  initialMessages: any[];
  initialCharacters: any[];
  initialClues: any[];
  initialNpcs: any[];
  initialImages: any[];
  myPlayerId: string | null;
  mySeat: string | null;
  userId: string;
  inviteToken: string;
  siteUrl: string;
  caseQuality?: any;
  soupSurface?: string;
  jbsCharacters?: any[];
  jbsObjectives?: any[];
  botcPlayers?: any[];
  mccPublic?: any;
  mccHand?: string[];
  dndPublic?: any;
  storyState?: any;
};

export default function RoomShell(props: ShellProps) {
  const router = useRouter();
  const supabase = useRef(createClient()).current;

  const refreshTimer = useRef<any>(null);
  useEffect(() => {
    const debouncedRefresh = () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      refreshTimer.current = setTimeout(() => router.refresh(), 250);
    };
    const ch = supabase.channel(`room-struct-${props.room.id}`);
    const tables = ['rooms', 'players', 'characters', 'clues', 'npcs', 'images', 'jbs_characters', 'jbs_votes'];
    tables.forEach((table) => {
      ch.on(
        'postgres_changes',
        { event: '*', schema: 'public', table, filter: `${table === 'rooms' ? 'id' : 'room_id'}=eq.${props.room.id}` },
        debouncedRefresh
      );
    });
    ch.subscribe();
    return () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      supabase.removeChannel(ch);
    };
  }, [props.room.id, supabase, router]);

  // 心跳：开着房间页时每分钟上报活跃，供后台自动关闭闲置房间使用
  useEffect(() => {
    let stop = false;
    const ping = () => {
      if (stop || (typeof document !== 'undefined' && document.visibilityState === 'hidden')) return;
      fetch('/api/rooms/heartbeat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId: props.room.id }),
      }).catch(() => {});
    };
    ping();
    const id = setInterval(ping, 60000);
    const onVis = () => { if (document.visibilityState === 'visible') ping(); };
    document.addEventListener('visibilitychange', onVis);
    return () => { stop = true; clearInterval(id); document.removeEventListener('visibilitychange', onVis); };
  }, [props.room.id]);

  // 离开房间：所有声音（音乐、音效、旁白、浏览器朗读）立刻停掉
  useEffect(() => {
    const Orig = window.Audio;
    const made: HTMLAudioElement[] = [];
    const Tracked: any = function (src?: string) { const a = new Orig(src); made.push(a); return a; };
    Tracked.prototype = Orig.prototype;
    (window as any).Audio = Tracked;
    const kill = () => { made.forEach((a) => { try { a.pause(); a.removeAttribute('src'); a.load(); } catch {} }); made.length = 0; try { window.speechSynthesis?.cancel(); } catch {} };
    window.addEventListener('pagehide', kill);
    return () => { kill(); (window as any).Audio = Orig; window.removeEventListener('pagehide', kill); };
  }, []);

  const exit = <RoomExit en={props.room.language === 'en'} />;
  if (props.room.mode === 'soup') return (<>{exit}<AudioManager state={soupAudioState(props.room)} /><SoupRoom {...props} /></>);
  if (props.room.mode === 'td') return (<>{exit}<TDRoom {...props} /></>);
  if (props.room.mode === 'jbs') return (<>{exit}<AudioManager state={jbsAudioState(props.room)} /><JbsRoom {...props} /></>);
  if (props.room.mode === 'botc') return (<>{exit}<AudioManager state={botcAudioState(props.room)} /><BotcRoom {...props} /></>);
  if (props.room.mode === 'mcc') return (<>{exit}<MccRoom {...props} /></>);
  if (props.room.mode === 'dnd') return (<>{exit}<DndRoom {...props} /></>);
  if (props.room.mode === 'story') return (<>{exit}<StoryRoom {...props} /></>);

  const state = props.room.game_state || 'lobby';
  const audioState = audioStateFor(props.room);
  const playing = state === 'playing' || state === 'ended';
  const lang = props.room.language || 'zh';

  return (
    <>
      {exit}
      <AudioManager state={audioState} />
      {playing ? (
        <Dashboard {...props} />
      ) : (
        <main className="min-h-screen flex flex-col">
          <Stepper current={state} lang={lang} />
          <div className="flex-1 flex items-stretch justify-center py-6 sm:px-4">
            <FlowView state={state} props={props} lang={lang} />
          </div>
        </main>
      )}
    </>
  );
}

function FlowView({ state, props, lang }: { state: string; props: ShellProps; lang: string }) {
  switch (state) {
    case 'lobby':
      return <Lobby {...props} />;
    case 'module_selection':
      return <ModuleSelection {...props} />;
    case 'case_locking':
      return <Locking {...props} />;
    case 'character_creation':
    case 'attribute_allocation':
    case 'skill_allocation':
    case 'character_confirmation':
    case 'rule_briefing':
      return <CastOrBuild {...props} state={state} />;
    default:
      return <Centered title={EN(lang) ? 'Unknown state' : '未知状态'} desc={state} />;
  }
}

// 第二步：默认选现成人物；老玩家可切到完整建卡（已经在完整建卡流程里的人继续走完）
function CastOrBuild(props: ShellProps & { state: string }) {
  const mine = (props.initialCharacters || []).find((c: any) => c.player_id === props.myPlayerId);
  const inBuild = !!mine && !mine.confirmed && (mine.creation_stage || 0) > 0;
  const [advanced, setAdvanced] = useState(inBuild);
  if (advanced) return <div className="w-full max-w-2xl mx-auto"><CharacterFlow {...props} /></div>;
  return <QuickCast {...props} onAdvanced={() => setAdvanced(true)} />;
}

function Locking(props: ShellProps) {
  const en = EN(props.room.language || 'zh');
  const chosen = (props.room.module_options || []).find((m: any) => m.id === props.room.chosen_module_id) || null;
  const lines = en ? ['The Keeper is hiding the truth…', 'Laying the false trails…', 'Setting the clock ticking…'] : ['守秘人正在藏起真相……', '布下误导的线索……', '让时钟开始走……'];
  const [i, setI] = useState(0);
  useEffect(() => { const t = setInterval(() => setI((x) => (x + 1) % lines.length), 2600); return () => clearInterval(t); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="w-full max-w-md mx-auto flex flex-col items-center text-center gap-5 pt-12">
      <div className="text-[10.5px] tracking-[.4em] pl-[.4em] uppercase text-[#c9a96e]/75">{en ? 'The story is being written' : '故事正在写成'}</div>
      {chosen?.title && <h1 className="font-serif font-semibold text-[28px] text-[#efe6d2]">{chosen.title}</h1>}
      {chosen?.tagline && <p className="font-serif italic text-[14px] text-[#c9a96e]/80">{chosen.tagline}</p>}
      <div className="mt-6 w-10 h-10 rounded-full border-2 border-[#c9a96e]/20 border-t-[#c9a96e] animate-spin" />
      <p key={i} className="font-serif text-[14px] text-parchment/60 nf-in">{lines[i]}</p>
    </div>
  );
}

function inviteUrlOf(props: ShellProps) {
  const origin = typeof window !== 'undefined' && window.location?.origin ? window.location.origin : (props.siteUrl || '');
  return `${origin}/join/${props.inviteToken}`;
}

function Lobby(props: ShellProps) {
  const lang = props.room.language || 'zh';
  const en = EN(lang);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const url = inviteUrlOf(props);
  const count = props.initialPlayers.length;
  const CAP = 6;

  async function start() {
    setBusy(true); setErr('');
    try {
      const res = await fetch('/api/rooms/start', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ roomId: props.room.id }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || (en ? 'Failed' : '开始失败'));
    } catch (e: any) { setErr(e.message); setBusy(false); }
  }

  return (
    <div className="w-full max-w-sm mx-auto flex flex-col items-center text-center px-5 pt-8">
      <div className="text-[10.5px] tracking-[.45em] pl-[.45em] uppercase text-[#c9a96e]/75">{en ? 'Call of Cthulhu' : '克苏鲁跑团'}</div>
      <h1 className="mt-3 font-serif font-semibold text-[30px] text-[#efe6d2]">{en ? 'A horror investigation' : '一场恐怖调查'}</h1>
      <p className="mt-4 font-serif text-[15px] leading-[1.9] text-parchment/75">{en ? <>The AI Keeper writes the case.<br />You pick a story, become someone, and walk in.</> : <>AI 守秘人写好案子，<br />你选一个故事，成为一个人，走进去。</>}</p>
      <div className="mt-5 flex items-center gap-2.5 text-[12px] tracking-wider text-parchment/50">
        <span>{en ? 'About 1 min to begin' : '1 分钟入戏'}</span><span className="w-[3px] h-[3px] rotate-45 bg-[#c9a96e]/60" /><span>{en ? `${count}/${CAP} seated` : `已入座 ${count}/${CAP}`}</span>
      </div>
      <button onClick={start} disabled={busy} className="mt-8 w-full py-3.5 rounded-xl bg-[#7d1d1d] hover:bg-[#8e2323] border border-[#a83232]/60 text-[#f2ead9] font-serif font-semibold tracking-[.2em] text-[17px] shadow-[0_10px_40px_-10px_rgba(125,29,29,.7)] disabled:opacity-50">
        {busy ? (en ? 'Opening…' : '正在开始…') : count <= 1 ? (en ? 'Begin' : '开始') : (en ? `Begin with ${count}` : `${count} 人开始`)}
      </button>
      {count < CAP && (
        <div className="mt-4 w-full flex items-center gap-2 rounded-xl border border-[#d8c7a8]/[0.13] bg-[#0b0c0f]/60 px-4 py-2.5 text-left">
          <span className="flex-1 text-[13px] text-parchment/70">{en ? 'Bring friends' : '叫朋友一起'} <span className="text-parchment/35">· {en ? 'up to 6' : '最多 6 人'}</span></span>
          <button onClick={() => { navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1500); }} className="shrink-0 text-[13px] text-[#c9a96e] border-b border-[#c9a96e]/40">{copied ? (en ? 'Copied' : '已复制') : (en ? 'Copy link' : '复制链接')}</button>
          <button onClick={() => { try { (navigator as any).share ? (navigator as any).share({ title: 'MystNight', url }) : navigator.clipboard.writeText(url); } catch {} }} className="shrink-0 ml-2 text-[13px] text-parchment/60">{en ? 'Share' : '分享'}</button>
        </div>
      )}
      {err && <p className="mt-3 text-[#e06060] text-sm">{err}</p>}
    </div>
  );
}

function QualityCard({ q, lang }: { q: any; lang: string }) {
  const color = q.complexity >= 85 ? 'text-green-400' : q.complexity >= 72 ? 'text-eldritch' : 'text-amber-400';
  const L = EN(lang)
    ? { title: 'Case quality', layers: 'Mystery layers', herrings: 'Red herrings', suspects: 'Suspects', hidden: 'Hidden endings', dur: 'Est. length' }
    : { title: '本案质量评估', layers: '谜团层数', herrings: '误导线索', suspects: '嫌疑人', hidden: '隐藏结局', dur: '预计时长' };
  const Metric = ({ label, value }: { label: string; value: any }) => (
    <div className="flex flex-col items-center px-2">
      <span className="text-parchment/50 text-[11px]">{label}</span>
      <span className="text-parchment text-sm">{value}</span>
    </div>
  );
  const en = EN(lang);
  const dims: any[] = Array.isArray(q.dimensions) ? q.dimensions : [];
  return (
    <div className="rounded-lg bg-fog border border-eldritch/30 p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-parchment/70">{L.title}</span>
        <span className={`text-2xl font-serif ${color}`}>{q.complexity}<span className="text-xs text-parchment/40"> /100</span></span>
      </div>
      <div className="flex flex-wrap justify-between gap-y-2">
        <Metric label={L.layers} value={q.mystery_layers} />
        <Metric label={L.herrings} value={q.red_herrings} />
        <Metric label={L.suspects} value={q.suspects} />
        <Metric label={L.hidden} value={q.hidden_endings} />
        <Metric label={L.dur} value={q.est_duration || '—'} />
      </div>
      {dims.length > 0 && (
        <div className="mt-3 pt-3 border-t border-eldritch/20 space-y-1">
          {dims.map((d: any, i: number) => {
            const sv = Math.max(0, Math.min(10, Number(d.score) || 0));
            const bc = sv >= 8.5 ? 'bg-green-500' : sv >= 7 ? 'bg-eldritch' : sv >= 5 ? 'bg-amber-500' : 'bg-blood';
            return (
              <div key={i} className="flex items-center gap-2">
                <span className="w-20 text-[11px] text-parchment/55 shrink-0">{d.label}</span>
                <div className="flex-1 h-1.5 rounded bg-ink overflow-hidden"><div className={`h-full ${bc}`} style={{ width: `${sv * 10}%` }} /></div>
                <span className="w-9 text-right text-[11px] text-parchment/60">{sv}<span className="text-parchment/30">/10</span></span>
              </div>
            );
          })}
        </div>
      )}
      {q.cap && (
        <div className="mt-2 text-[11px] text-blood/90">{en ? `Structurally capped at ${q.cap}` : `结构性封顶 ${q.cap} 分`}{Array.isArray(q.capReasons) && q.capReasons.length ? `（${q.capReasons.join('、')}）` : ''}</div>
      )}
      {q.potential?.best_fix && <div className="mt-1 text-[11px] text-eldritch/90">{en ? 'Best fix: ' : '最优改法：'}{q.potential.best_fix}</div>}
      {q.verdict && <div className="mt-1 text-[12px] text-parchment/70 italic">“{q.verdict}”</div>}
    </div>
  );
}

function Centered({ title, desc, spinner }: { title: string; desc: string; spinner?: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 text-center max-w-lg">
      {spinner && <div className="w-8 h-8 border-2 border-eldritch/30 border-t-eldritch rounded-full animate-spin" />}
      <h1 className="text-2xl font-serif text-parchment">{title}</h1>
      <p className="text-parchment/60 leading-relaxed">{desc}</p>
    </div>
  );
}
