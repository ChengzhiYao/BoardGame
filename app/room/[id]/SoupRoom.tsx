'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { ShellProps } from './RoomShell';

export default function SoupRoom(props: ShellProps & { soupSurface?: string }) {
  const router = useRouter();
  const supabase = useRef(createClient()).current;
  const [messages, setMessages] = useState<any[]>(props.initialMessages);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [guessing, setGuessing] = useState(false);
  const [guess, setGuess] = useState('');
  const [copied, setCopied] = useState(false);
  const [surfaceOpen, setSurfaceOpen] = useState(true);
  const [difficulty, setDifficulty] = useState('普通');
  const [supernatural, setSupernatural] = useState('any');
  const [gore, setGore] = useState('any');
  const [tone, setTone] = useState('any');
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

  async function start() { await call('/api/soup/generate', { roomId: props.room.id, difficulty, supernatural, gore, tone }); }
  async function ask() { const q = text.trim(); if (!q) return; setText(''); await call('/api/soup/ask', { roomId: props.room.id, question: q }); }
  async function submitGuess() { const g = guess.trim(); if (!g) return; setGuess(''); setGuessing(false); await call('/api/soup/guess', { roomId: props.room.id, guess: g }); }
  async function reveal() { if (!confirm('确定要看汤底吗？看了这局就结束了。')) return; await call('/api/soup/reveal', { roomId: props.room.id }); }

  // 大厅：还没出题
  if (state === 'lobby' || (!playing && !ended)) {
    return (
      <main className="min-h-[100svh] flex flex-col items-center justify-center gap-6 px-6 text-center">
        <h1 className="text-2xl font-serif text-parchment">海龟汤 · {props.room.name}</h1>
        <p className="text-parchment/60 max-w-md">主持人会给出一个诡异的「汤面」，你们靠提**是非题**逼近真相，想到了就揭晓。可以叫朋友一起来问。</p>
        <div className="flex flex-col items-center gap-3 w-full max-w-md">
          <span className="text-sm text-parchment/50">想多人一起玩，把链接发给同伴：</span>
          <code className="text-xs px-3 py-2 rounded bg-fog border border-eldritch/30 text-eldritch break-all w-full">{inviteUrl}</code>
          <button onClick={() => { navigator.clipboard.writeText(inviteUrl); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
            className="px-4 py-1.5 rounded bg-eldritch/40 hover:bg-eldritch text-parchment text-sm">{copied ? '已复制' : '复制邀请链接'}</button>
        </div>
        <div className="w-full max-w-md space-y-3 text-left rounded-lg border border-eldritch/20 bg-fog/40 p-4">
          <div className="text-sm text-parchment/70">出题设置</div>
          <SoupOptRow label="难度" value={difficulty} set={setDifficulty} opts={[['普通', '普通'], ['困难', '困难'], ['地狱', '地狱']]} />
          <SoupOptRow label="灵异" value={supernatural} set={setSupernatural} opts={[['any', '不限'], ['allow', '可灵异'], ['real', '纯现实']]} />
          <SoupOptRow label="血腥" value={gore} set={setGore} opts={[['any', '不限'], ['gore', '可血腥'], ['none', '不血腥']]} />
          <SoupOptRow label="基调" value={tone} set={setTone} opts={[['any', '不限'], ['悬疑', '悬疑'], ['惊悚', '惊悚'], ['温情', '温情'], ['黑色幽默', '黑色幽默'], ['搞笑', '搞笑']]} />
        </div>
        <button onClick={start} disabled={busy || generating}
          className="px-6 py-3 rounded bg-blood/80 hover:bg-blood text-parchment border border-blood disabled:opacity-50">
          {busy || generating ? '正在出题…' : '开始 · 来一道海龟汤'}
        </button>
      </main>
    );
  }

  return (
    <main className="h-[100svh] flex flex-col overflow-hidden">
      <header className="px-4 py-3 border-b border-eldritch/20 flex items-center justify-between">
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
        <div className="border-t border-eldritch/20 px-4 py-3 space-y-2 max-w-3xl w-full mx-auto" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
          {guessing ? (
            <div className="space-y-2">
              <textarea value={guess} onChange={(e) => setGuess(e.target.value)} placeholder="说出你认为的完整真相（汤底）…"
                className="w-full px-3 py-2 rounded bg-fog border border-eldritch/30 text-parchment placeholder:text-parchment/30 outline-none focus:border-eldritch" rows={3} />
              <div className="flex gap-2">
                <button onClick={submitGuess} disabled={busy} className="flex-1 px-4 py-2 rounded bg-blood/80 hover:bg-blood text-parchment disabled:opacity-50">提交答案</button>
                <button onClick={() => setGuessing(false)} className="px-4 py-2 rounded bg-fog border border-parchment/30 text-parchment/70">返回提问</button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex gap-2">
                <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && ask()}
                  placeholder="提一个是非题…" disabled={busy}
                  className="flex-1 min-w-0 px-4 py-2 rounded bg-fog border border-eldritch/30 text-parchment placeholder:text-parchment/30 outline-none focus:border-eldritch disabled:opacity-50" />
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
  if (type === 'soup_surface') {
    return <div className="mx-auto max-w-2xl rounded-lg bg-eldritch/10 border border-eldritch/40 px-4 py-3 text-parchment/90 leading-relaxed whitespace-pre-line">{m.content}</div>;
  }
  if (type === 'soup_reveal') {
    return <div className="mx-auto max-w-2xl rounded-lg bg-blood/20 border border-blood/50 px-4 py-3 text-parchment leading-relaxed whitespace-pre-line">{m.content}</div>;
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

function SoupOptRow({ label, value, set, opts }: { label: string; value: string; set: (v: string) => void; opts: [string, string][] }) {
  return (
    <div>
      <div className="text-xs text-parchment/50 mb-1.5">{label}</div>
      <div className="flex flex-wrap gap-2">
        {opts.map(([v, t]) => (
          <button key={v} onClick={() => set(v)}
            className={`px-3 py-1 rounded-full text-sm border transition-colors ${value === v ? 'bg-eldritch text-parchment border-eldritch' : 'bg-fog border-eldritch/30 text-parchment/55 hover:border-eldritch/60'}`}>
            {t}
          </button>
        ))}
      </div>
    </div>
  );
}
