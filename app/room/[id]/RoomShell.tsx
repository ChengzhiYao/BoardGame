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
    <a href={en ? '/en' : '/zh'} title={en ? 'Leave — you can come back from the home page' : '离开房间（3 小时内可从首页回来）'}
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
          <div className="flex-1 flex items-stretch justify-center px-4 py-6">
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
      return (
        <Centered
          title={EN(lang) ? 'Weaving the truth…' : '正在编织真相……'}
          desc={EN(lang)
            ? 'The Keeper is building the complete hidden case file — the truth, the mastermind, the timeline and the red herrings. It will be locked away and never shown to you.'
            : '守秘人正在后台构建这桩案件的完整隐藏档案：真相、幕后黑手、时间线与误导线索。这一切将被锁定，永不向你展示。'}
          spinner
        />
      );
    case 'character_creation':
      return (
        <div className="w-full max-w-2xl flex flex-col gap-4">
          {props.caseQuality && <QualityCard q={props.caseQuality} lang={lang} />}
          <CharacterFlow {...props} />
        </div>
      );
    case 'attribute_allocation':
    case 'skill_allocation':
    case 'character_confirmation':
    case 'rule_briefing':
      return <CharacterFlow {...props} />;
    default:
      return <Centered title={EN(lang) ? 'Unknown state' : '未知状态'} desc={state} />;
  }
}

function inviteUrlOf(props: ShellProps) {
  const origin = typeof window !== 'undefined' && window.location?.origin ? window.location.origin : (props.siteUrl || '');
  return `${origin}/join/${props.inviteToken}`;
}

function Lobby(props: ShellProps) {
  const lang = props.room.language || 'zh';
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const url = inviteUrlOf(props);
  const count = props.initialPlayers.length;
  const CAP = 6; // CoC 现支持 1~6 人
  const full = count >= CAP;

  async function start() {
    setBusy(true);
    setErr('');
    try {
      const res = await fetch('/api/rooms/start', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId: props.room.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || (EN(lang) ? 'Failed' : '推进失败'));
    } catch (e: any) { setErr(e.message); setBusy(false); }
  }

  return (
    <div className="flex flex-col items-center justify-center gap-6 text-center max-w-md">
      <h1 className="text-2xl font-serif text-parchment">{props.room.name}</h1>
      <p className="text-parchment/60">
        {EN(lang) ? 'Play solo, or invite up to 6 investigators in total.' : '一个人也能开局，最多可邀请共 6 名调查员。'}（{count}/{CAP}）
      </p>

      <div className="flex flex-col items-center gap-4 w-full">
        <button onClick={start} disabled={busy}
          className="px-6 py-3 rounded bg-blood/80 hover:bg-blood text-parchment border border-blood disabled:opacity-50">
          {busy ? (EN(lang) ? 'Starting…' : '正在开始…') : (count <= 1 ? (EN(lang) ? 'Play solo →' : '单人开始 →') : (EN(lang) ? `Start (${count} players) →` : `开始（${count} 人）→`))}
        </button>
        {!full && (
          <>
            <div className="flex items-center gap-3 w-full">
              <span className="h-px flex-1 bg-eldritch/20" />
              <span className="text-xs text-parchment/40">{EN(lang) ? 'or invite more (up to 6)' : '或再叫人（最多 6）'}</span>
              <span className="h-px flex-1 bg-eldritch/20" />
            </div>
            <div className="flex flex-col items-center gap-3 w-full">
              <code className="text-xs px-3 py-2 rounded bg-fog border border-eldritch/30 text-eldritch break-all w-full">{url}</code>
              <button
                onClick={() => { navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
                className="px-5 py-2 rounded bg-eldritch/50 hover:bg-eldritch text-parchment text-sm">
                {copied ? (EN(lang) ? 'Copied' : '已复制') : (EN(lang) ? 'Copy invite link' : '复制邀请链接')}
              </button>
            </div>
          </>
        )}
      </div>

      {err && <p className="text-blood text-sm">{err}</p>}
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
