'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ensureSession } from '@/lib/auth';

export default function Home() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [mode, setMode] = useState<'idle' | 'join'>('idle');
  const [gameMode, setGameMode] = useState<'coc' | 'soup' | 'td'>('coc');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function createRoom() {
    if (!name.trim()) return setErr('先填一个调查员代号');
    setBusy(true);
    setErr('');
    try {
      await ensureSession(name.trim());
      const res = await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: `${name.trim()} 的${gameMode === 'soup' ? '海龟汤' : gameMode === 'td' ? '真心话大冒险' : '调查'}`, displayName: name.trim(), mode: gameMode }),
      });
      const data = await res.json();
      if (res.status === 402) { router.push('/upgrade'); return; }
      if (!res.ok) throw new Error(data.error || '创建失败');
      router.push(`/room/${data.roomId}`);
    } catch (e: any) {
      setErr(e.message);
      setBusy(false);
    }
  }

  async function joinRoom() {
    if (!name.trim()) return setErr('先填一个调查员代号');
    if (!joinCode.trim()) return setErr('粘贴邀请码');
    setBusy(true);
    setErr('');
    try {
      await ensureSession(name.trim());
      router.push(`/join/${joinCode.trim()}`);
    } catch (e: any) {
      setErr(e.message);
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-7 px-6 text-center">
      <h1 className="text-4xl md:text-5xl font-serif tracking-wide text-parchment">克苏鲁调查团</h1>
      <p className="max-w-md text-parchment/70 leading-relaxed">
        两名调查员，一条邀请链接，一位永不迷路、真相绝不更改的 AI 守秘人。
        你们将拼凑彼此手中的线索，直面不可名状之物。
      </p>

      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="你的调查员代号"
        className="w-72 px-4 py-3 rounded bg-fog border border-eldritch/40 text-parchment placeholder:text-parchment/30 outline-none focus:border-eldritch"
      />

      {mode === 'idle' && (
        <div className="flex gap-2 flex-wrap justify-center">
          {([['coc', '调查跑团（CoC）'], ['soup', '海龟汤'], ['td', '真心话大冒险']] as const).map(([k, label]) => (
            <button key={k} onClick={() => setGameMode(k)}
              className={`px-4 py-2 rounded text-sm border ${gameMode === k ? 'bg-blood/30 border-blood text-parchment' : 'bg-fog border-eldritch/30 text-parchment/60'}`}>
              {label}
            </button>
          ))}
        </div>
      )}

      {mode === 'idle' ? (
        <div className="flex gap-4">
          <button
            onClick={createRoom}
            disabled={busy}
            className="px-6 py-3 rounded bg-blood/80 hover:bg-blood text-parchment border border-blood disabled:opacity-50"
          >
            {busy ? '正在开启…' : (gameMode === 'soup' ? '创建海龟汤' : gameMode === 'td' ? '创建真心话大冒险' : '创建调查')}
          </button>
          <button
            onClick={() => setMode('join')}
            disabled={busy}
            className="px-6 py-3 rounded bg-fog hover:bg-eldritch/40 text-parchment border border-eldritch/50"
          >
            输入邀请码加入
          </button>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3">
          <input
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value)}
            placeholder="粘贴邀请码"
            className="w-72 px-4 py-3 rounded bg-fog border border-eldritch/40 text-parchment placeholder:text-parchment/30 outline-none focus:border-eldritch"
          />
          <div className="flex gap-4">
            <button
              onClick={joinRoom}
              disabled={busy}
              className="px-6 py-3 rounded bg-eldritch/70 hover:bg-eldritch text-parchment border border-eldritch disabled:opacity-50"
            >
              {busy ? '正在加入…' : '加入'}
            </button>
            <button
              onClick={() => setMode('idle')}
              className="px-6 py-3 rounded bg-fog text-parchment/70 border border-parchment/20"
            >
              返回
            </button>
          </div>
        </div>
      )}

      {err && <p className="text-blood text-sm">{err}</p>}
      <a href="/upgrade" className="text-parchment/40 hover:text-parchment text-sm underline">开房说明 · 我的局数 →</a>
    </main>
  );
}
