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
  useTTS({ lang: props.room.language, messages, roomId: props.room.id, classify: (m: any) => { const t = m.payload?.type; if (t === 'soup_surface' || t === 'soup_reveal' || m.sender_type === 'kp') return { kind: 'narrator' as const, text: m.content, audio: m.payload?.audio }; return null; } });
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

  const answers = messages.filter((m) => m.sender_type === 'kp' && m.payload?.type === 'soup_answer');
  const heats = answers.map((m) => Number(m.payload?.heat)).filter((n) => !isNaN(n) && n > 0);
  const recent = heats.slice(-3);
  const heat = ended ? 100 : recent.length ? Math.round(Math.max(...recent) * 0.6 + recent[recent.length - 1] * 0.4) : 0;
  const qCount = messages.filter((m) => m.sender_type === 'player').length;
  const heatWord = heat >= 85 ? '就差一步' : heat >= 65 ? '滚烫' : heat >= 35 ? '变暖了' : heat > 0 ? '还很冷' : '未开始';
  useEffect(() => { try { window.dispatchEvent(new CustomEvent('mn-tension', { detail: heat })); } catch {} }, [heat]);
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

  const cleanSurface = String(surface).replace(/^【汤面】/, '').replace(/\n\n你们可以提是非题[\s\S]*$/, '').trim();

  return (
    <main className="h-[100svh] flex flex-col overflow-hidden relative">
      {/* 氛围：离真相越近，四周越暗、越红，最后会慢慢“呼吸” */}
      <div aria-hidden className={`pointer-events-none fixed inset-0 -z-10 transition-[background] duration-[2500ms] ${heat >= 85 && !ended ? 'mn-breathe' : ''}`}
        style={{ background: `radial-gradient(120% 90% at 50% 35%, rgba(12,13,16,0) 30%, rgba(${Math.round(12 + heat * 0.9)},${Math.round(13 - heat * 0.05)},16,${0.55 + heat / 400}) 100%), #0c0d10` }} />
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 mn-fog opacity-60" />

      <header className="mn-header px-4 py-3 border-b flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="font-serif text-[17px] leading-tight text-[#efe6d2]">海龟汤</div>
          <div className="text-[11px] text-parchment/40 truncate">{props.room.name}</div>
        </div>
        <div className="shrink-0 text-right mr-11">
          <div className="text-[10.5px] tracking-[.25em] text-parchment/40">{ended ? '已结束' : `第 ${qCount} 问`}</div>
        </div>
      </header>

      {cleanSurface && (
        <div className="max-w-3xl w-full mx-auto px-4 pt-3">
          <div className="rounded-xl border border-[#d8c7a8]/[0.12] bg-[#0b0c0f]/70 backdrop-blur-md">
            <button onClick={() => setSurfaceOpen((v) => !v)} className="w-full flex items-center gap-3 px-4 py-2.5 text-left">
              <span className="text-[10.5px] tracking-[.35em] text-[#c9a96e]/80 shrink-0">汤面</span>
              {!surfaceOpen && <span className="flex-1 min-w-0 truncate font-serif text-[13.5px] text-parchment/60">{cleanSurface}</span>}
              {surfaceOpen && <span className="flex-1" />}
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`shrink-0 text-parchment/40 transition-transform ${surfaceOpen ? 'rotate-180' : ''}`}><path d="M6 9l6 6 6-6" /></svg>
            </button>
            {surfaceOpen && <div className="px-4 pb-4 max-h-[32vh] overflow-y-auto"><Narration text={cleanSurface} collapse={false} /></div>}
          </div>
          {/* 真相温度 */}
          <div className="mt-2.5 flex items-center gap-3 px-1">
            <span className="text-[10.5px] tracking-[.3em] text-parchment/40 shrink-0">真相</span>
            <div className="relative flex-1 h-[3px] rounded-full bg-white/[0.07] overflow-hidden">
              <div className="absolute inset-y-0 left-0 rounded-full transition-all duration-[1500ms] ease-out"
                style={{ width: `${Math.max(3, heat)}%`, background: 'linear-gradient(90deg,#3f7d70,#c9a96e 55%,#c0453f)', boxShadow: heat >= 65 ? '0 0 12px rgba(192,69,63,.8)' : 'none' }} />
            </div>
            <span className={`text-[11.5px] font-serif shrink-0 w-14 text-right transition-colors ${heat >= 85 ? 'text-[#e06060] animate-pulse' : heat >= 65 ? 'text-[#e08a5a]' : heat >= 35 ? 'text-[#c9a96e]' : 'text-parchment/45'}`}>{heatWord}</span>
          </div>
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-5 space-y-4 max-w-3xl w-full mx-auto">
        {qCount === 0 && !ended && (
          <div className="text-center pt-6 space-y-2">
            <div className="font-serif text-[15px] text-parchment/60">问一个只能回答「是」或「不是」的问题</div>
            <div className="text-[12px] text-parchment/35">比如：「他是故意的吗？」「这件事发生在晚上？」</div>
          </div>
        )}
        {messages.filter((m) => m.payload?.type !== 'soup_surface').map((m) => <SoupMsg key={m.id} m={m} mine={m.sender_player_id === props.myPlayerId} who={nameOf(m.sender_player_id)} />)}
        {busy && <div className="flex justify-center py-2"><span className="inline-flex gap-1.5">{[0, 1, 2].map((d) => <span key={d} className="w-1.5 h-1.5 rounded-full bg-[#c9a96e]/70 animate-bounce" style={{ animationDelay: `${d * 140}ms` }} />)}</span></div>}
        <div ref={bottomRef} />
      </div>

      {!ended ? (
        <div className="mn-composer border-t px-4 pt-3 space-y-2.5 max-w-3xl w-full mx-auto" style={{ paddingBottom: 'max(0.85rem, env(safe-area-inset-bottom))' }}>
          {guessing ? (
            <div className="space-y-2.5">
              <div className="text-[11px] tracking-[.3em] text-[#c9a96e]/80">说出你认为的真相</div>
              <textarea value={guess} onChange={(e) => setGuess(e.target.value)} placeholder="把整件事完整讲出来，不用怕错…"
                className="w-full px-4 py-3 rounded-xl bg-[#121318] border border-[#d8c7a8]/15 text-parchment font-serif placeholder:text-parchment/30 outline-none focus:border-[#c9a96e]/50" rows={3} />
              <div className="flex gap-2 items-center">
                <MicButton value={guess} onChange={setGuess} en={en} compact={false} />
                <button onClick={submitGuess} disabled={busy || !guess.trim()} className="flex-1 py-3 rounded-xl bg-[#7d1d1d] border border-[#a83232]/60 text-[#f2ead9] font-serif tracking-[.15em] disabled:opacity-50">揭晓</button>
                <button onClick={() => setGuessing(false)} className="px-3 py-3 text-[13px] text-parchment/50">再问问</button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex gap-2 items-center">
                <div className="flex-1 min-w-0 flex items-center rounded-xl bg-[#121318] border border-[#d8c7a8]/15 focus-within:border-[#c9a96e]/50 pr-1">
                  <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && ask()}
                    placeholder="问一个是非题…" disabled={busy}
                    className="flex-1 min-w-0 bg-transparent border-0 px-4 py-3 text-parchment placeholder:text-parchment/30 outline-none disabled:opacity-50" style={{ boxShadow: 'none' }} />
                  <MicButton value={text} onChange={setText} en={en} />
                </div>
                <button onClick={ask} disabled={busy || !text.trim()} className="shrink-0 h-[46px] px-5 rounded-xl bg-[#c9a96e] text-[#0b0c0f] font-medium disabled:opacity-40">问</button>
              </div>
              <div className="flex items-center justify-between px-1">
                <button onClick={() => setGuessing(true)} className={`text-[13.5px] font-serif tracking-wide ${heat >= 65 ? 'text-[#e8b07a] animate-pulse' : 'text-[#c9a96e]'}`}>我知道了 · 说出真相 →</button>
                <button onClick={reveal} className="text-[12px] text-parchment/35 hover:text-parchment/60">放弃，看汤底</button>
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="mn-composer border-t px-4 py-4 max-w-3xl w-full mx-auto flex gap-2.5" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
          <button onClick={async () => { const { startRoom } = await import('@/lib/startRoom'); let n = '玩家'; try { n = localStorage.getItem('name') || n; } catch {} const r = await startRoom('soup', n, en ? 'en' : 'zh', { quick: true }); if (r.url) window.location.href = r.url; else if (r.login || r.upgrade) window.location.href = '/play'; }}
            className="flex-1 py-3 rounded-xl bg-[#7d1d1d] border border-[#a83232]/60 text-[#f2ead9] font-serif tracking-[.15em]">再来一碗</button>
          <a href="/play" className="px-5 py-3 rounded-xl border border-[#d8c7a8]/15 text-parchment/70 text-[14px]">回到大厅</a>
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
    const raw = String(m.content || '');
    const v = (m.payload?.verdict as string) || (['是也不是', '不是', '无关', '是'].find((x) => raw.startsWith(x)) || '');
    const note = v ? raw.slice(v.length).replace(/^\s*[—-]\s*/, '') : '';
    const right = /^✅/.test(raw), wrong = /^❌/.test(raw);
    const word = v || (right ? '答对了' : wrong ? '还差一点' : '');
    if (!word) return <div className="text-center text-[13px] text-parchment/60 font-serif">{raw}</div>;
    const tone = word === '是' || right ? 'mn-stamp-yes' : word === '不是' || wrong ? 'mn-stamp-no' : word === '是也不是' ? 'mn-stamp-mid' : 'mn-stamp-void';
    const rest = right || wrong ? raw.replace(/^[✅❌]\s*(答对了！|还差一点。|Correct!|Not quite\.)?\s*/, '') : note;
    return (
      <div className="flex flex-col items-center gap-1.5 py-1">
        <span className={`mn-stamp ${tone} ${fresh(m) ? 'mn-stamp-in' : ''}`}>{word}</span>
        {rest && <span className="max-w-[85%] text-center text-[12.5px] font-serif text-parchment/55">{rest}</span>}
      </div>
    );
  }
  if (m.sender_type === 'system') {
    return <div className="text-center text-sm text-parchment/50">{m.content}</div>;
  }
  return (
    <div className={`flex flex-col ${mine ? 'items-end' : 'items-start'}`}>
      <span className="text-[11px] text-parchment/35 mb-1 px-1">{who}{mine ? '（你）' : ''}</span>
      <div className={`max-w-[82%] px-4 py-2.5 rounded-2xl ${mine ? 'rounded-br-md bg-[#2a1416]/90 border border-[#7d1d1d]/50' : 'rounded-bl-md bg-white/[0.04] border border-[#d8c7a8]/10'} text-[15px] text-parchment/90`}>{m.content}</div>
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
