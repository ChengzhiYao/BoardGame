'use client';
import Narration from '@/components/Narration';
import MicButton from '@/components/MicButton';
import CompanionWaiting from '@/components/CompanionWaiting';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { ShellProps } from './RoomShell';
import { useTTS } from './useTTS';

const fresh = (m: any) => !!m?.created_at && Date.now() - new Date(m.created_at).getTime() < 90000;
export default function SoupRoom(props: ShellProps & { soupSurface?: string }) {
  const router = useRouter();
  const supabase = useRef(createClient()).current;
  const [messages, setMessages] = useState<any[]>(props.initialMessages);
  useTTS({ lang: props.room.language, messages, roomId: props.room.id, classify: (m: any) => { const t = m.payload?.type; if (t === 'soup_surface' || t === 'soup_reveal' || m.sender_type === 'kp') return { kind: 'narrator' as const, text: m.content }; return null; } });
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [guessing, setGuessing] = useState(false);
  const [guess, setGuess] = useState('');
  const [copied, setCopied] = useState(false);
  const [surfaceOpen, setSurfaceOpen] = useState(true);
  const [difficulty, setDifficulty] = useState('普通');
  const [supernatural, setSupernatural] = useState('any');
  const [tone, setTone] = useState('any');
  const [gore, setGore] = useState(0);
  const [horror, setHorror] = useState(0);
  const [edge, setEdge] = useState(40);
  const bottomRef = useRef<HTMLDivElement>(null);

  const en = props.room.language === 'en';
  // 汤面：优先取聊天流里的 soup_surface 消息，兜底用 prop。置顶展示，不再随聊天滚走。
  const surface = messages.find((m) => m.payload?.type === 'soup_surface')?.content || props.soupSurface || '';

  const state = props.room.game_state;
  const generating = props.room.modules_generating;
  const ended = state === 'ended';
  const playing = state === 'playing';
  const nameOf = (pid?: string | null) => {
    const p = props.initialPlayers.find((x) => x.id === pid);
    return props.initialUsers.find((u) => u.id === p?.user_id)?.display_name || '玩家';
  };
  const inviteUrl = `${typeof window !== 'undefined' ? window.location.origin : props.siteUrl}/join/${props.inviteToken}`;

  useEffect(() => {
    const ch = supabase.channel(`soup-msgs-${props.room.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `room_id=eq.${props.room.id}` },
        (payload: any) => setMessages((prev) => prev.some((m) => m.id === payload.new.id) ? prev : [...prev, payload.new]))
      .subscribe();
    const ch2 = supabase.channel(`soup-room-${props.room.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms', filter: `id=eq.${props.room.id}` }, () => router.refresh())
      .subscribe();
    return () => { supabase.removeChannel(ch); supabase.removeChannel(ch2); };
  }, [props.room.id, supabase, router]);

  useEffect(() => { setMessages((prev) => { const ids = new Set(prev.map((m) => m.id)); const add = props.initialMessages.filter((m) => !ids.has(m.id)); return add.length ? [...prev, ...add] : prev; }); }, [props.initialMessages]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  // 轮询兜底：被邀请的匿名玩家realtime可能被RLS过滤，定时主动拉消息+房间状态保证同步。
  useEffect(() => {
    const tick = async () => {
      if (typeof document !== 'undefined' && document.hidden) return;
      const { data } = await supabase.from('messages').select('*').eq('room_id', props.room.id).order('created_at', { ascending: true }).limit(300);
      if (data) setMessages((prev) => { const ids = new Set(prev.map((m) => m.id)); const add = data.filter((m: any) => !ids.has(m.id)); return add.length ? [...prev, ...add] : prev; });
      const { data: r } = await supabase.from('rooms').select('game_state').eq('id', props.room.id).maybeSingle();
      if (r && r.game_state !== props.room.game_state) router.refresh();
    };
    const id = setInterval(tick, 4000);
    return () => clearInterval(id);
  }, [props.room.id, props.room.game_state, supabase, router]);

  // Linger 伴侣一起玩:自动开一道题;你问完之后 TA 也会时不时插一句/提问/猜
  const comp = props.room.companion && props.room.companion.name ? props.room.companion : null;
  const isHost = props.room.host_user_id === props.userId;
  const compBusy = useRef(false);
  const autoStarted = useRef(false);
  useEffect(() => {
    if (!comp || !isHost || autoStarted.current) return;
    if (state !== 'playing' && state !== 'ended' && !generating && !surface) { autoStarted.current = true; fetch('/api/soup/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ roomId: props.room.id, difficulty: comp.picks?.difficulty || '普通', supernatural: 'any', tone: 'any', gore: 0, horror: comp.picks?.horror ?? 20, edge: 40 }) }).then(() => router.refresh()).catch(() => {}); }
  }, [comp, isHost, state, generating, surface]);
  const compTurn = () => {
    if (!comp || !isHost || compBusy.current) return;
    compBusy.current = true;
    fetch('/api/linger/soup-turn', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ roomId: props.room.id }) }).catch(() => {}).finally(() => { compBusy.current = false; });
  };
  // 主持人刚回答了你的问题 → TA 有时接着问;你半天没动静 → TA 自己问
  useEffect(() => {
    if (!comp || !isHost || !playing) return;
    const last = messages[messages.length - 1];
    const prev = messages[messages.length - 2];
    let t: any;
    if (last?.sender_type === 'kp' && last?.payload?.type === 'soup_answer' && prev?.sender_type === 'player' && Math.random() < 0.55) t = setTimeout(compTurn, 3500 + Math.random() * 5000);
    else t = setTimeout(compTurn, 40000 + Math.random() * 25000);
    return () => clearTimeout(t);
  }, [messages.length, playing]);

  async function call(url: string, body: any) {
    setBusy(true);
    try {
      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const d = await res.json();
      if (!res.ok) alert(d.error || '出错了');
      return d;
    } catch (e: any) { alert('失败：' + e.message); }
    finally { setBusy(false); }
  }

  // 首页「马上开玩」进来的：房主自动用默认设置出题，不用再点
  const quick = useRef(false);
  useEffect(() => {
    if (quick.current || !isHost || state !== 'lobby' || props.room.companion?.name) return;
    try { if (new URLSearchParams(window.location.search).get('quick') !== '1') return; } catch { return; }
    quick.current = true; start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHost, state]);
  async function start() { await call('/api/soup/generate', { roomId: props.room.id, difficulty, supernatural, tone, gore, horror, edge }); }
  async function ask() { const q = text.trim(); if (!q) return; setText(''); await call('/api/soup/ask', { roomId: props.room.id, question: q }); if (comp) fetch('/api/linger/react', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ roomId: props.room.id }) }).catch(() => {}); }
  async function submitGuess() { const g = guess.trim(); if (!g) return; setGuess(''); setGuessing(false); await call('/api/soup/guess', { roomId: props.room.id, guess: g }); }
  async function reveal() { if (!confirm('确定要看汤底吗？看了这局就结束了。')) return; await call('/api/soup/reveal', { roomId: props.room.id }); }

  // 和 Linger 伴侣的局:TA 在出题,不显示大厅
  if (props.room.companion?.name && (state === 'lobby' || (!playing && !ended))) {
    return <CompanionWaiting comp={props.room.companion} en={props.room.language === 'en'} title={props.room.language === 'en' ? `${props.room.companion.name} is picking a puzzle…` : `${props.room.companion.name} 正在挑一道海龟汤…`} sub={props.room.language === 'en' ? 'Ask yes/no questions together to figure out what really happened.' : '你们一起问是非题,猜出真相。'} onStart={start} busy={busy || generating} />;
  }
  // 大厅：还没出题
  if (state === 'lobby' || (!playing && !ended)) {
    const pickLv = (v: number, lv: string[]) => lv[Math.min(lv.length - 1, Math.max(0, Math.round((v / 100) * (lv.length - 1))))];
    const summary = [difficulty, { any: '灵异不限', allow: '可灵异', real: '纯现实' }[supernatural as 'any'] || '', pickLv(gore, GORE), pickLv(horror, HORROR), pickLv(edge, EDGE), tone === 'any' ? '基调不限' : tone].filter(Boolean).join(' · ');
    return (
      <main className="min-h-[100svh] flex flex-col items-center px-5 pb-32 text-center" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 76px)' }}>
        <div className="text-[10px] tracking-[.5em] pl-[.5em] uppercase text-[#c9a96e]/75">Lateral Soup</div>
        <h1 className="mt-2 font-serif font-semibold text-[30px] sm:text-4xl tracking-[.1em] pl-[.1em] text-[#efe6d2]">海龟汤</h1>
        <div className="mt-1 text-[13px] text-parchment/45 truncate max-w-full">{props.room.name}</div>
        <p className="mt-5 max-w-sm font-serif text-[15px] leading-[1.9] text-parchment/80">AI 守着一个诡异的真相。<br />你们只能问「是 / 不是」的问题，一步步逼近它。</p>
        <div className="mt-5 flex items-center justify-center gap-2.5 text-[12px] tracking-wider text-parchment/55">
          <span>听汤面</span><span className="w-[3px] h-[3px] rotate-45 bg-[#c9a96e]/60" /><span>问是非题</span><span className="w-[3px] h-[3px] rotate-45 bg-[#c9a96e]/60" /><span>说出真相</span>
        </div>

        <button onClick={start} disabled={busy || generating}
          className="mt-7 w-full max-w-sm py-3.5 rounded-xl bg-[#7d1d1d] hover:bg-[#8e2323] border border-[#a83232]/60 text-[#f2ead9] font-serif font-semibold tracking-[.2em] text-[17px] shadow-[0_10px_40px_-10px_rgba(125,29,29,.7)] disabled:opacity-50">
          {busy || generating ? '正在出题…' : '开始出题'}
        </button>

        <div className="mt-4 w-full max-w-sm flex items-center gap-2 rounded-xl border border-[#d8c7a8]/[0.13] bg-[#0b0c0f]/60 px-4 py-2.5 text-left">
          <span className="flex-1 text-[13px] text-parchment/70">叫朋友一起问 <span className="text-parchment/35">· 人多更好猜</span></span>
          <button onClick={() => { navigator.clipboard.writeText(inviteUrl); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
            className="shrink-0 text-[13px] text-[#c9a96e] border-b border-[#c9a96e]/40">{copied ? '已复制' : '复制链接'}</button>
          <button onClick={() => { try { (navigator as any).share ? (navigator as any).share({ title: '来一起喝海龟汤', url: inviteUrl }) : navigator.clipboard.writeText(inviteUrl); } catch {} }}
            className="shrink-0 ml-2 text-[13px] text-parchment/60">分享</button>
        </div>

        <details className="mt-3 w-full max-w-sm group rounded-xl border border-[#d8c7a8]/[0.13] bg-[#0b0c0f]/60 text-left [&_summary::-webkit-details-marker]:hidden">
          <summary className="list-none cursor-pointer px-4 py-3 flex items-center gap-2">
            <span className="text-[13px] text-parchment/75 shrink-0">出题设置</span>
            <span className="flex-1 min-w-0 truncate text-[12px] text-parchment/40">{summary}</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 text-parchment/40 transition-transform group-open:rotate-180"><path d="M6 9l6 6 6-6" /></svg>
          </summary>
          <div className="px-4 pb-4 pt-1 space-y-3.5 border-t border-[#d8c7a8]/[0.08]">
            <SoupOptRow label="难度" value={difficulty} set={setDifficulty} opts={[['普通', '普通'], ['困难', '困难'], ['地狱', '地狱']]} />
            <SoupOptRow label="灵异" value={supernatural} set={setSupernatural} opts={[['any', '不限'], ['allow', '可灵异'], ['real', '纯现实']]} />
            <SoupSlider label="血腥" value={gore} set={setGore} levels={GORE} />
            <SoupSlider label="恐怖" value={horror} set={setHorror} levels={HORROR} />
            <SoupSlider label="尺度 · 暗黑 / 成人向" value={edge} set={setEdge} levels={EDGE} />
            <SoupOptRow label="基调" value={tone} set={setTone} opts={[['any', '不限'], ['悬疑', '悬疑'], ['惊悚', '惊悚'], ['温情', '温情'], ['黑色幽默', '黑幽默'], ['搞笑', '搞笑']]} />
          </div>
        </details>
      </main>
    );
  }

  return (
    <main className="h-[100svh] flex flex-col overflow-hidden">
      <header className="mn-header px-4 py-3 border-b border-eldritch/20 flex items-center justify-between">
        <span className="font-serif text-parchment">海龟汤 · {props.room.name}</span>
        <span className="text-xs text-parchment/50">{ended ? '已结束' : '提是非题 → 我答 是/不是/无关/是也不是'}</span>
      </header>

      {surface && (
        <div className="border-b border-eldritch/30 bg-eldritch/10 max-w-3xl w-full mx-auto">
          <button onClick={() => setSurfaceOpen((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-2 text-left">
            <span className="text-xs font-medium tracking-wide text-eldritch">📌 {en ? 'THE CASE (soup surface)' : '汤面 · 谜题'}</span>
            <span className="text-xs text-parchment/50">{surfaceOpen ? (en ? 'hide ▲' : '收起 ▲') : (en ? 'show ▼' : '展开 ▼')}</span>
          </button>
          {surfaceOpen && (
            <div className="px-4 pb-3 -mt-1 max-h-[34vh] overflow-y-auto text-parchment/90 leading-relaxed whitespace-pre-line text-sm">
              {surface}
            </div>
          )}
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-3 max-w-3xl w-full mx-auto">
        {messages.filter((m) => m.payload?.type !== 'soup_surface').map((m) => <SoupMsg key={m.id} m={m} mine={m.sender_player_id === props.myPlayerId} who={nameOf(m.sender_player_id)} />)}
        {busy && <div className="text-center text-parchment/40 italic text-sm">主持人思考中……</div>}
        <div ref={bottomRef} />
      </div>

      {!ended ? (
        <div className="mn-composer border-t border-eldritch/20 px-4 py-3 space-y-2 max-w-3xl w-full mx-auto" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
          {guessing ? (
            <div className="space-y-2">
              <textarea value={guess} onChange={(e) => setGuess(e.target.value)} placeholder="说出你认为的完整真相（汤底）…"
                className="w-full px-3 py-2 rounded bg-fog border border-eldritch/30 text-parchment placeholder:text-parchment/30 outline-none focus:border-eldritch" rows={3} />
              <div className="flex gap-2"><MicButton value={guess} onChange={setGuess} en={en} compact={false} />
                <button onClick={submitGuess} disabled={busy} className="flex-1 px-4 py-2 rounded bg-blood/80 hover:bg-blood text-parchment disabled:opacity-50">提交答案</button>
                <button onClick={() => setGuessing(false)} className="px-4 py-2 rounded bg-fog border border-parchment/30 text-parchment/70">返回提问</button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex gap-2">
                <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && ask()}
                  placeholder="提一个是非题…" disabled={busy}
                  className="flex-1 min-w-0 px-4 py-2 rounded bg-fog border border-eldritch/30 text-parchment placeholder:text-parchment/30 outline-none focus:border-eldritch disabled:opacity-50" /> <MicButton value={text} onChange={setText} en={en} compact={false} />
                <button onClick={ask} disabled={busy} className="px-5 py-2 rounded bg-eldritch/60 hover:bg-eldritch text-parchment disabled:opacity-50 shrink-0">提问</button>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setGuessing(true)} className="flex-1 px-4 py-2 rounded bg-blood/70 hover:bg-blood text-parchment text-sm">揭晓答案</button>
                <button onClick={reveal} className="px-4 py-2 rounded bg-fog border border-parchment/30 text-parchment/60 text-sm">看汤底（放弃）</button>
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="border-t border-blood/40 px-4 py-3 text-center max-w-3xl w-full mx-auto" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
          <span className="text-parchment/70 text-sm">这局结束了。想再来一道？回首页创建新的海龟汤房间。</span>
        </div>
      )}
    </main>
  );
}

function SoupMsg({ m, mine, who }: { m: any; mine: boolean; who: string }) {
  const type = m.payload?.type;
  if (type === 'companion') {
    return (
      <div className="flex items-start gap-2">
        {m.payload?.avatar ? <img src={m.payload.avatar} alt="" className="w-8 h-8 rounded-full object-cover border border-eldritch/40 shrink-0" /> : <span className="w-8 h-8 rounded-full bg-eldritch/40 shrink-0" />}
        <div className="flex flex-col items-start">
          <span className="text-xs text-parchment/40 mb-1">{m.payload?.name}</span>
          <div className="max-w-[80%] px-4 py-2 rounded-lg bg-fog border border-eldritch/40 text-parchment/90">{m.content}</div>
        </div>
      </div>
    );
  }
  if (type === 'soup_surface') {
    return <Narration text={m.content} fresh={fresh(m)} label="汤面" collapse={false} />;
  }
  if (type === 'soup_reveal') {
    return <Narration text={m.content} fresh={fresh(m)} tone="reveal" label="汤底" collapse={false} />;
  }
  if (m.sender_type === 'kp') {
    return <div className="text-center"><span className="inline-block px-3 py-1.5 rounded-full bg-fog border border-eldritch/40 text-parchment/90 text-sm">主持人：{m.content}</span></div>;
  }
  if (m.sender_type === 'system') {
    return <div className="text-center text-sm text-parchment/50">{m.content}</div>;
  }
  return (
    <div className="flex flex-col items-end">
      <span className="text-xs text-parchment/40 mb-1">{who}{mine ? '（你）' : ''}</span>
      <div className="max-w-[80%] px-4 py-2 rounded-lg bg-blood/25 border border-blood/40 text-parchment/90">{m.content}</div>
    </div>
  );
}

const GORE = ['不血腥', '轻微', '中等', '较重', '极重'];
const HORROR = ['不吓人', '微悬', '惊悚', '恐怖', '极致'];
const EDGE = ['轻松', '日常', '偏暗', '黑暗', '致郁'];

function Seg({ items, active, onPick }: { items: string[]; active: number; onPick: (i: number) => void }) {
  return (
    <div className="flex rounded-lg border border-[#d8c7a8]/[0.14] overflow-hidden">
      {items.map((t, i) => (
        <button key={i} onClick={() => onPick(i)}
          className={`flex-1 min-w-0 px-1 py-2 text-[12.5px] truncate transition-colors ${i > 0 ? 'border-l border-[#d8c7a8]/[0.1]' : ''} ${i === active ? 'bg-[#c9a96e]/[0.16] text-[#efe6d2]' : 'text-parchment/50 hover:text-parchment/80'}`}>{t}</button>
      ))}
    </div>
  );
}

function SoupSlider({ label, value, set, levels }: { label: string; value: number; set: (v: number) => void; levels: string[] }) {
  const idx = Math.min(levels.length - 1, Math.max(0, Math.round((value / 100) * (levels.length - 1))));
  return (
    <div>
      <div className="text-[12px] tracking-wider text-parchment/45 mb-1.5">{label}</div>
      <Seg items={levels} active={idx} onPick={(i) => set(Math.round((i / (levels.length - 1)) * 100))} />
    </div>
  );
}

function SoupOptRow({ label, value, set, opts }: { label: string; value: string; set: (v: string) => void; opts: [string, string][] }) {
  return (
    <div>
      <div className="text-[12px] tracking-wider text-parchment/45 mb-1.5">{label}</div>
      <Seg items={opts.map((o) => o[1])} active={Math.max(0, opts.findIndex((o) => o[0] === value))} onPick={(i) => set(opts[i][0])} />
    </div>
  );
}
