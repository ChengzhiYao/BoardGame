'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { ShellProps } from './RoomShell';

const EN = (l?: string) => l === 'en';
const ACTS_ZH = ['', '案件开场', '搜证', '人物关系', '关键证据', '推理讨论', '最终指认', '真相揭晓'];
const ACTS_EN = ['', 'Opening', 'Investigate', 'Relationships', 'Key Evidence', 'Discussion', 'Accusation', 'Reveal'];

export default function JbsRoom(props: ShellProps) {
  const router = useRouter();
  const supabase = useRef(createClient()).current;
  const lang = props.room.language || 'zh';
  const en = EN(lang);
  const [messages, setMessages] = useState<any[]>(props.initialMessages);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [headcount, setHeadcount] = useState(6);
  const [showRole, setShowRole] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const phase = props.room.jbs_phase as string | undefined;
  const act = props.room.jbs_act || 1;
  const generating = props.room.modules_generating;
  const isHost = props.room.host_user_id === props.userId;
  const chars = props.jbsCharacters || [];
  const myChar = chars.find((c: any) => c.assigned_seat === props.mySeat);
  const inviteUrl = `${typeof window !== 'undefined' ? window.location.origin : props.siteUrl}/join/${props.inviteToken}`;
  const roleMsgs = messages.filter((m) => m.payload?.type === 'jbs_role');

  useEffect(() => {
    const ch = supabase.channel(`jbs-msgs-${props.room.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `room_id=eq.${props.room.id}` },
        (payload: any) => setMessages((prev) => prev.some((m) => m.id === payload.new.id) ? prev : [...prev, payload.new]))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [props.room.id, supabase]);

  useEffect(() => { setMessages((prev) => { const ids = new Set(prev.map((m) => m.id)); const add = props.initialMessages.filter((m) => !ids.has(m.id)); return add.length ? [...prev, ...add] : prev; }); }, [props.initialMessages]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  async function call(url: string, body: any) {
    setBusy(true);
    try {
      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const d = await res.json();
      if (!res.ok) { alert(d.error || (en ? 'Error' : '出错了')); return null; }
      return d;
    } catch (e: any) { alert((en ? 'Failed: ' : '失败：') + e.message); return null; }
    finally { setBusy(false); }
  }

  async function genScripts() { await call('/api/jbs/scripts', { roomId: props.room.id, headcount }); }
  async function startScript(id: string) { await call('/api/jbs/start', { roomId: props.room.id, scriptId: id }); }
  async function act_(content: string) { const c = content.trim(); if (!c) return; setText(''); await call('/api/jbs/act', { roomId: props.room.id, content: c }); }
  async function vote(target: string) { if (!confirm((en ? 'Accuse ' : '指认 ') + target + '?')) return; await call('/api/jbs/vote', { roomId: props.room.id, target }); }
  async function replay() {
    setBusy(true);
    try {
      const res = await fetch('/api/rooms/replay', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ roomId: props.room.id }) });
      if (res.status === 402) { router.push('/upgrade'); return; }
      const d = await res.json();
      if (!res.ok) { alert(d.error || (en ? 'Error' : '出错了')); return; }
      router.refresh();
    } catch (e: any) { alert((en ? 'Failed: ' : '失败：') + e.message); }
    finally { setBusy(false); }
  }

  // ===== 大厅 / 出本 =====
  if (!phase || phase === 'lobby') {
    return (
      <main className="min-h-[100svh] flex flex-col items-center justify-center gap-6 px-6 text-center">
        <h1 className="text-2xl font-serif text-parchment">{en ? 'Murder Mystery' : '剧本杀'} · {props.room.name}</h1>
        <p className="text-parchment/60 max-w-md">{en ? '2 real players + AI-played characters fill the cast. Everyone gets a secret role; investigate, discuss, and finally accuse the killer.' : '2 名真人 + AI 扮演其余角色补满人数。每人一个隐藏身份，搜证、讨论，最后指认真凶。'}</p>
        <div className="flex flex-col items-center gap-3 w-full max-w-md">
          <span className="text-sm text-parchment/50">{en ? 'Invite your partner:' : '把链接发给同伴：'}</span>
          <code className="text-xs px-3 py-2 rounded bg-fog border border-eldritch/30 text-eldritch break-all w-full">{inviteUrl}</code>
          <button onClick={() => { navigator.clipboard.writeText(inviteUrl); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
            className="px-4 py-1.5 rounded bg-eldritch/40 hover:bg-eldritch text-parchment text-sm">{copied ? (en ? 'Copied' : '已复制') : (en ? 'Copy invite link' : '复制邀请链接')}</button>
        </div>
        {isHost ? (
          <div className="flex flex-col items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-sm text-parchment/60">{en ? 'Total cast:' : '总人数：'}</span>
              {[4, 6, 8].map((n) => (
                <button key={n} onClick={() => setHeadcount(n)}
                  className={`px-3 py-1.5 rounded border text-sm ${headcount === n ? 'bg-eldritch/60 border-eldritch text-parchment' : 'bg-fog border-eldritch/30 text-parchment/60'}`}>{n}</button>
              ))}
            </div>
            <button onClick={genScripts} disabled={busy || generating}
              className="px-6 py-3 rounded bg-blood/80 hover:bg-blood text-parchment border border-blood disabled:opacity-50">
              {busy || generating ? (en ? 'Writing scripts…' : '正在出本…') : (en ? 'Generate scripts' : '生成剧本')}
            </button>
          </div>
        ) : <p className="text-parchment/40 text-sm">{en ? 'Waiting for the host to pick a script…' : '等待房主出本……'}</p>}
      </main>
    );
  }

  // ===== 剧本选择 =====
  if (phase === 'script') {
    const opts = props.room.jbs_options || [];
    return (
      <main className="min-h-[100svh] flex flex-col items-center px-4 py-8 gap-6">
        <h1 className="text-xl font-serif text-parchment">{en ? 'Choose a script' : '选择剧本'}</h1>
        {generating && <p className="text-parchment/40 text-sm">{en ? 'Generating…' : '生成中…'}</p>}
        <div className="grid gap-4 w-full max-w-4xl md:grid-cols-3">
          {opts.map((s: any) => (
            <div key={s.id} className="rounded-lg bg-fog border border-eldritch/30 p-4 flex flex-col gap-2">
              <span className="text-xs px-2 py-0.5 rounded-full bg-eldritch/20 text-eldritch self-start">{s.type}</span>
              <h2 className="font-serif text-parchment text-lg">{s.title}</h2>
              <p className="text-parchment/50 text-xs">{s.era} · {s.place} · {s.headcount}{en ? 'P' : '人'} · {s.duration}</p>
              <p className="text-eldritch/80 text-sm italic">{s.tagline}</p>
              <p className="text-parchment/70 text-sm leading-relaxed flex-1">{s.hook}</p>
              <p className="text-parchment/40 text-xs">{en ? 'Difficulty' : '难度'}: {s.difficulty} · {en ? 'Emotion' : '情感'}: {s.emotion}</p>
              {isHost && <button onClick={() => startScript(s.id)} disabled={busy}
                className="mt-1 px-4 py-2 rounded bg-blood/80 hover:bg-blood text-parchment text-sm disabled:opacity-50">{busy ? (en ? 'Opening…' : '开本中…') : (en ? 'Play this' : '选这个')}</button>}
            </div>
          ))}
        </div>
        {isHost && <button onClick={genScripts} disabled={busy || generating} className="text-parchment/40 text-sm underline">{en ? 'Reroll scripts' : '换一批'}</button>}
      </main>
    );
  }

  // ===== 生成中 =====
  if (phase === 'locking' || phase === 'revealing') {
    return (
      <main className="min-h-[100svh] flex flex-col items-center justify-center gap-4 text-center px-6">
        <div className="w-8 h-8 border-2 border-eldritch/30 border-t-eldritch rounded-full animate-spin" />
        <p className="text-parchment/70">{phase === 'locking' ? (en ? 'Building the case & casting roles…' : '正在编排案件、分配角色……') : (en ? 'Tallying votes & revealing the truth…' : '正在统计投票、揭晓真相……')}</p>
      </main>
    );
  }

  // ===== 游戏中 / 投票 / 揭晓 =====
  const voting = phase === 'vote';
  const ended = phase === 'reveal' || props.room.game_state === 'ended';
  const candidates = chars.filter((c: any) => c.name !== myChar?.name);

  return (
    <main className="h-[100svh] flex flex-col overflow-hidden">
      <header className="px-4 py-2.5 border-b border-eldritch/20 flex items-center justify-between gap-2">
        <span className="font-serif text-parchment text-sm truncate">{en ? 'Murder Mystery' : '剧本杀'} · {props.room.name}</span>
        <div className="flex items-center gap-2 shrink-0">
          {!ended && <span className="text-xs text-eldritch/80">{en ? `Act ${act} · ${ACTS_EN[act] || ''}` : `第${act}幕 · ${ACTS_ZH[act] || ''}`}</span>}
          {myChar && <button onClick={() => setShowRole((v) => !v)} className="text-xs px-2 py-1 rounded bg-eldritch/30 text-parchment">{en ? 'My role' : '我的角色'}</button>}
        </div>
      </header>

      {showRole && (
        <div className="px-4 py-3 bg-blood/10 border-b border-blood/30 max-w-3xl w-full mx-auto text-sm text-parchment/85 whitespace-pre-line">
          {roleMsgs.length ? roleMsgs.map((m) => <div key={m.id} className="mb-2">{m.content}</div>) : (en ? 'Your secret role is private to you.' : '你的隐藏身份只有你能看到。')}
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-3 max-w-3xl w-full mx-auto">
        {messages.map((m) => <JbsMsg key={m.id} m={m} en={en} mine={m.sender_player_id === props.myPlayerId} />)}
        {busy && <div className="text-center text-parchment/40 italic text-sm">{en ? 'The host is narrating…' : '主持人推进中……'}</div>}
        <div ref={bottomRef} />
      </div>

      {ended ? (
        <div className="border-t border-blood/40 px-4 py-3 flex flex-col items-center gap-2 max-w-3xl w-full mx-auto" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
          <span className="text-parchment/70 text-sm">{en ? 'The case is closed.' : '本局结束。'}</span>
          {isHost && (
            <button onClick={replay} disabled={busy}
              className="px-5 py-2 rounded bg-blood/80 hover:bg-blood text-parchment border border-blood text-sm disabled:opacity-50">
              {busy ? (en ? 'Resetting…' : '重置中…') : (en ? '↻ Play again (new script)' : '↻ 再来一局（换新本）')}
            </button>
          )}
        </div>
      ) : voting ? (
        <div className="border-t border-eldritch/20 px-4 py-3 max-w-3xl w-full mx-auto space-y-2" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
          <p className="text-center text-parchment/70 text-sm">{en ? 'Final accusation — who is the culprit?' : '最终指认 —— 谁是真凶？'}</p>
          <div className="flex flex-wrap justify-center gap-2">
            {candidates.map((c: any) => (
              <button key={c.name} onClick={() => vote(c.name)} disabled={busy}
                className="px-3 py-1.5 rounded bg-blood/30 hover:bg-blood/60 border border-blood/50 text-parchment text-sm disabled:opacity-50">
                {c.name}{c.is_ai ? '' : ' ·' + (en ? 'player' : '真人')}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="border-t border-eldritch/20 px-4 py-3 flex gap-2 max-w-3xl w-full mx-auto" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
          <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && act_(text)}
            placeholder={en ? 'Investigate, question, accuse, speak…' : '搜证、询问、对质、发言…'} disabled={busy}
            className="flex-1 min-w-0 px-4 py-2 rounded bg-fog border border-eldritch/30 text-parchment placeholder:text-parchment/30 outline-none focus:border-eldritch disabled:opacity-50" />
          <button onClick={() => act_(text)} disabled={busy} className="px-5 py-2 rounded bg-eldritch/60 hover:bg-eldritch text-parchment disabled:opacity-50 shrink-0">{en ? 'Act' : '行动'}</button>
        </div>
      )}
    </main>
  );
}

function JbsMsg({ m, en, mine }: { m: any; en: boolean; mine: boolean }) {
  const type = m.payload?.type;
  if (type === 'jbs_roster') {
    return <div className="mx-auto max-w-2xl rounded-lg bg-eldritch/10 border border-eldritch/40 px-4 py-3 text-parchment/85 leading-relaxed whitespace-pre-line text-sm">{m.content}</div>;
  }
  if (type === 'jbs_reveal') {
    return <div className="mx-auto max-w-2xl rounded-lg bg-blood/20 border border-blood/50 px-4 py-3 text-parchment leading-relaxed whitespace-pre-line">{m.content}</div>;
  }
  if (type === 'jbs_dm') {
    return <div className="mx-auto max-w-2xl text-parchment/90 leading-relaxed whitespace-pre-line border-l-2 border-eldritch/50 pl-3">{m.content}</div>;
  }
  if (type === 'jbs_ai') {
    return (
      <div className="flex flex-col items-start">
        <span className="text-xs text-eldritch/80 mb-1">{m.payload?.name}{en ? ' (AI)' : '（AI）'}</span>
        <div className="max-w-[80%] px-4 py-2 rounded-lg bg-fog border border-eldritch/30 text-parchment/90">{m.content}</div>
      </div>
    );
  }
  if (type === 'jbs_evidence') {
    return <div className="mx-auto max-w-2xl rounded bg-amber-500/10 border border-amber-500/30 px-3 py-2 text-amber-200/90 text-sm whitespace-pre-line">{m.content}</div>;
  }
  if (type === 'private') {
    return <div className="mx-auto max-w-2xl rounded bg-blood/10 border border-blood/30 px-3 py-2 text-parchment/70 text-sm italic whitespace-pre-line">🔒 {m.content}</div>;
  }
  if (type === 'jbs_vote') {
    return <div className="text-center text-sm text-parchment/60 whitespace-pre-line">{m.content}</div>;
  }
  if (m.sender_type === 'system') {
    return <div className="text-center text-sm text-parchment/50 whitespace-pre-line">{m.content}</div>;
  }
  return (
    <div className={`flex flex-col ${mine ? 'items-end' : 'items-start'}`}>
      <div className={`max-w-[80%] px-4 py-2 rounded-lg ${mine ? 'bg-blood/25 border border-blood/40' : 'bg-fog border border-parchment/20'} text-parchment/90`}>{m.content}</div>
    </div>
  );
}
