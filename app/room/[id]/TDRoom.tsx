'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { ShellProps } from './RoomShell';

const EN = (l?: string) => l === 'en';

export default function TDRoom(props: ShellProps) {
  const router = useRouter();
  const supabase = useRef(createClient()).current;
  const lang = props.room.language || 'zh';
  const en = EN(lang);
  const [messages, setMessages] = useState<any[]>(props.initialMessages);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [aiMode, setAiMode] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const [types, setTypes] = useState({ truth: true, dare: true });
  const [intensity, setIntensity] = useState('medium');
  const [environment, setEnvironment] = useState('');
  const [forbidden, setForbidden] = useState('');

  const state = props.room.game_state;
  const playing = state === 'playing';
  const settings = props.room.td_settings || {};
  const allowed: string[] = settings.types || ['truth', 'dare'];
  const inviteUrl = `${typeof window !== 'undefined' ? window.location.origin : props.siteUrl}/join/${props.inviteToken}`;
  const nameOf = (pid?: string | null) => {
    const p = props.initialPlayers.find((x) => x.id === pid);
    return props.initialUsers.find((u) => u.id === p?.user_id)?.display_name || (en ? 'Player' : '玩家');
  };

  useEffect(() => {
    const ch = supabase.channel(`td-msgs-${props.room.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `room_id=eq.${props.room.id}` },
        (payload: any) => setMessages((prev) => prev.some((m) => m.id === payload.new.id) ? prev : [...prev, payload.new]))
      .subscribe();
    const ch2 = supabase.channel(`td-room-${props.room.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms', filter: `id=eq.${props.room.id}` }, () => router.refresh())
      .subscribe();
    return () => { supabase.removeChannel(ch); supabase.removeChannel(ch2); };
  }, [props.room.id, supabase, router]);

  useEffect(() => { setMessages((prev) => { const ids = new Set(prev.map((m) => m.id)); const add = props.initialMessages.filter((m) => !ids.has(m.id)); return add.length ? [...prev, ...add] : prev; }); }, [props.initialMessages]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

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
      if (!res.ok) alert(d.error || (en ? 'Something went wrong' : '出错了'));
    } catch (e: any) { alert((en ? 'Failed: ' : '失败：') + e.message); }
    finally { setBusy(false); }
  }

  async function startGame() {
    const t = Object.entries(types).filter(([, v]) => v).map(([k]) => k);
    if (!t.length) return alert(en ? 'Pick at least one: Truth or Dare' : '至少选一种：真心话或大冒险');
    await call('/api/td/start', { roomId: props.room.id, settings: { types: t, intensity, environment, forbidden } });
  }
  async function draw(kind: 'truth' | 'dare') { await call('/api/td/draw', { roomId: props.room.id, kind, ai: aiMode }); }

  if (!playing) {
    const FIELD = 'w-full px-3 py-2 rounded bg-fog border border-eldritch/30 text-parchment placeholder:text-parchment/30 outline-none focus:border-eldritch';
    return (
      <main className="min-h-[100svh] flex flex-col items-center justify-center gap-5 px-6 py-8">
        <h1 className="text-2xl font-serif text-parchment">{en ? 'Truth or Dare' : '真心话大冒险'} · {props.room.name}</h1>
        <div className="w-full max-w-md space-y-4">
          <div>
            <div className="text-sm text-parchment/70 mb-2">{en ? 'What to play?' : '玩什么？'}</div>
            <div className="flex gap-2">
              {(['truth', 'dare'] as const).map((k) => (
                <button key={k} onClick={() => setTypes((p) => ({ ...p, [k]: !p[k] }))}
                  className={`flex-1 px-4 py-2 rounded text-sm border ${(types as any)[k] ? 'bg-blood/30 border-blood text-parchment' : 'bg-fog border-eldritch/30 text-parchment/60'}`}>{en ? (k === 'truth' ? 'Truth' : 'Dare') : (k === 'truth' ? '真心话' : '大冒险')}</button>
              ))}
            </div>
          </div>
          <label className="block text-sm text-parchment/70">{en ? 'Intensity' : '尺度'}
            <select value={intensity} onChange={(e) => setIntensity(e.target.value)} className={FIELD + ' mt-1'}>
              <option value="mild">{en ? 'Mild' : '轻松（mild）'}</option>
              <option value="medium">{en ? 'Medium' : '适中（medium）'}</option>
              <option value="bold">{en ? 'Bold (still wholesome)' : '大胆（bold，仍健康）'}</option>
            </select>
          </label>
          <label className="block text-sm text-parchment/70">{en ? 'Setting (affects what dares are possible)' : '所处环境（影响大冒险能做什么）'}
            <input value={environment} onChange={(e) => setEnvironment(e.target.value)} placeholder={en ? 'e.g. at home / bar / online voice / park' : '如：在家里 / 酒吧 / 线上语音 / 公园'} className={FIELD + ' mt-1'} />
          </label>
          <label className="block text-sm text-parchment/70">{en ? 'Off-limits (forbidden)' : '不想出现的内容（禁止项）'}
            <input value={forbidden} onChange={(e) => setForbidden(e.target.value)} placeholder={en ? 'e.g. nothing too embarrassing, no exes' : '如：不要太社死、不要涉及前任'} className={FIELD + ' mt-1'} />
          </label>

          <div className="pt-1 space-y-2 text-center">
            <div className="text-xs text-parchment/50">{en ? 'Playing with others? Send the link:' : '多人一起玩？把链接发给同伴：'}</div>
            <code className="block text-xs px-3 py-2 rounded bg-fog border border-eldritch/30 text-eldritch break-all">{inviteUrl}</code>
            <button onClick={() => { navigator.clipboard.writeText(inviteUrl); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
              className="px-4 py-1.5 rounded bg-eldritch/40 hover:bg-eldritch text-parchment text-xs">{copied ? (en ? 'Copied' : '已复制') : (en ? 'Copy invite link' : '复制邀请链接')}</button>
          </div>

          <button onClick={startGame} disabled={busy}
            className="w-full px-6 py-3 rounded bg-blood/80 hover:bg-blood text-parchment border border-blood disabled:opacity-50">{busy ? (en ? 'Starting…' : '开始中…') : (en ? 'Start' : '开始游戏')}</button>
        </div>
      </main>
    );
  }

  return (
    <main className="h-[100svh] flex flex-col overflow-hidden">
      <header className="px-4 py-3 border-b border-eldritch/20 flex items-center justify-between">
        <span className="font-serif text-parchment">{en ? 'Truth or Dare' : '真心话大冒险'} · {props.room.name}</span>
        <span className="text-xs text-parchment/50">{en ? 'Intensity' : '尺度'} {settings.intensity}{settings.environment ? ` · ${settings.environment}` : ''}</span>
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-3 max-w-2xl w-full mx-auto">
        {messages.map((m) => {
          const type = m.payload?.type;
          if (type === 'td') return <div key={m.id} className="mx-auto max-w-xl rounded-lg bg-blood/15 border border-blood/40 px-4 py-3 text-parchment leading-relaxed">{m.content}</div>;
          if (m.sender_type === 'system') return <div key={m.id} className="text-center text-sm text-parchment/50">{m.content}</div>;
          return <div key={m.id} className="text-center text-sm text-parchment/70">{nameOf(m.sender_player_id)}：{m.content}</div>;
        })}
        {busy && <div className="text-center text-parchment/40 italic text-sm">{en ? 'Drawing…' : '抽题中……'}</div>}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-eldritch/20 px-4 py-3 space-y-2 max-w-2xl w-full mx-auto" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
        <label className="flex items-center justify-center gap-2 text-xs text-parchment/60">
          <input type="checkbox" checked={aiMode} onChange={(e) => setAiMode(e.target.checked)} />
          {en ? '✨ Let AI write a fresh one for this game’s settings (saved to the pool, free to reuse)' : '✨ 让 AI 按本局设置现编一题（会存进题库，下次免费复用）'}
        </label>
        <div className="flex gap-2">
          {allowed.includes('truth') && (
            <button onClick={() => draw('truth')} disabled={busy} className="flex-1 px-4 py-3 rounded bg-eldritch/60 hover:bg-eldritch text-parchment disabled:opacity-50">{en ? 'Draw Truth' : '抽真心话'}</button>
          )}
          {allowed.includes('dare') && (
            <button onClick={() => draw('dare')} disabled={busy} className="flex-1 px-4 py-3 rounded bg-blood/70 hover:bg-blood text-parchment disabled:opacity-50">{en ? 'Draw Dare' : '抽大冒险'}</button>
          )}
        </div>
      </div>
    </main>
  );
}
