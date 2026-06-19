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
import AudioManager from './AudioManager';

const EN = (l?: string) => l === 'en';

function jbsAudioState(room: any): string {
  const phase = room.jbs_phase;
  if (room.game_state === 'ended' || phase === 'reveal') return 'TRUTH_REVEAL';
  if (phase === 'vote') return 'FINAL_CONFRONTATION';
  if (phase === 'playing') return (room.jbs_act || 1) >= 3 ? 'EXPLORATION_DANGEROUS' : 'EXPLORATION_SAFE';
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
  botcPlayers?: any[];
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

  if (props.room.mode === 'soup') return <SoupRoom {...props} />;
  if (props.room.mode === 'td') return <TDRoom {...props} />;
  if (props.room.mode === 'jbs') return (<><AudioManager state={jbsAudioState(props.room)} /><JbsRoom {...props} /></>);
  if (props.room.mode === 'botc') return <BotcRoom {...props} />;

  const state = props.room.game_state || 'lobby';
  const audioState = audioStateFor(props.room);
  const playing = state === 'playing' || state === 'ended';
  const lang = props.room.language || 'zh';

  return (
    <>
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
