'use client';
import { stripMarks } from '@/lib/narrate';
import { useEffect, useRef, useState } from 'react';
import { setVoiceControl } from './voiceControl';

type Spoken = { kind: 'narrator' | 'character'; name?: string; gender?: 'male' | 'female'; text: string; audio?: string; urgent?: boolean } | null;
export type VoiceMode = 'off' | 'on';

const keep = (t: string) => String(t || '').replace(/[🔍🔒🗳️▶👍🔧⏱⚖🎨↻🎲💀🩸✔✘🔊🔈🎙️]/g, '').replace(/[ \t]+/g, ' ').trim();
const clean = (t: string) => stripMarks(String(t || '')).replace(/[🔍🔒🗳️▶👍🔧⏱⚖🎨↻🎲💀🩸✔✘🔊🔈🎙️]/g, '').replace(/\s+/g, ' ').trim();
function hashName(name: string) { let h = 0; for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0; return h; }

export function useTTS(opts: { lang?: string; messages: any[]; classify: (m: any) => Spoken; roomId?: string }) {
  const { lang, messages, classify, roomId } = opts;
  // 默认开（免费 Fish 语音）；玩家手动关过就记住；免费额度用完自动关
  const [mode, setMode] = useState<VoiceMode>('off');
  const modeRef = useRef<VoiceMode>('off'); modeRef.current = mode;
  const [quota, setQuota] = useState(false);
  const memberHint = useRef(false);
  const inited = useRef(false);
  useEffect(() => { let off = false; try { off = localStorage.getItem('mn_voice') === 'off'; } catch {} if (!off) setMode('on'); }, []);
  const spoken = useRef<Set<string>>(new Set());
  const queue = useRef<{ text: string; gender: string; narrator: boolean; seed: number; lang: string; audio?: string }[]>([]);
  const running = useRef(false);
  const curAudio = useRef<HTMLAudioElement | null>(null);

  function stopAll() {
    queue.current = [];
    running.current = false;
    if (curAudio.current) { try { curAudio.current.pause(); } catch {} curAudio.current = null; }
  }

  function cycle() {
    setMode((m) => {
      const next: VoiceMode = m === 'off' ? 'on' : 'off';
      try { localStorage.setItem('mn_voice', next); } catch {}
      stopAll();
      if (next !== 'off') { setQuota(false); messages.forEach((x) => x?.id && spoken.current.add(x.id)); }
      return next;
    });
  }

  async function worker() {
    if (running.current) return;
    running.current = true;
    while (queue.current.length && modeRef.current === 'on') {
      const task = queue.current.shift()!;
      try {
        let url = task.audio || '';
        if (!url) {
          const res = await fetch('/api/tts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ roomId, ...task }) });
          if (res.status === 429) { queue.current = []; setQuota(true); setMode('off'); break; }
          if (res.status === 402) { // 真人级配音是会员专属：这句跳过，提示一次
            if (!memberHint.current) { memberHint.current = true; try { window.dispatchEvent(new CustomEvent('mn-toast', { detail: { msg: lang === 'en' ? 'Fresh voiced narration is a member perk — saved story voices still play.' : '新的真人级配音旁白是会员专属——已经录好的故事配音照常播放。', kind: 'info' } })); } catch {} }
            continue;
          }
          if (!res.ok) continue;
          url = (await res.json())?.url || '';
        }
        if (!url) continue;
        await new Promise<void>((resolve) => {
          const a = new Audio(url);
          curAudio.current = a;
          const say = (on: boolean) => { try { window.dispatchEvent(new CustomEvent('mn-speaking', { detail: on })); } catch {} };
          a.onplay = () => say(true);
          a.onended = () => { say(false); resolve(); };
          a.onerror = () => { say(false); resolve(); };
          a.play().catch(() => resolve());
        });
      } catch { /* skip */ }
    }
    running.current = false;
  }

  useEffect(() => {
    if (typeof window === 'undefined') return;
    // 进房时已有的历史不念，只念之后新来的
    if (!inited.current) { inited.current = true; messages.forEach((x) => x?.id && spoken.current.add(x.id)); return; }
    if (mode === 'off') { messages.forEach((x) => x?.id && spoken.current.add(x.id)); return; }
    const zh = lang !== 'en';
    for (const m of messages) {
      if (!m?.id || spoken.current.has(m.id)) continue;
      spoken.current.add(m.id);
      const c = classify(m);
      if (!c) continue;
      const text = clean(c.text);
      if (!text) continue;
      const said = keep(c.text);
      const h = hashName(String(c.name || ''));

      {
        // 揭晓真相这类：打断正在念的和排队的，马上念
        if (c.urgent) { queue.current = []; if (curAudio.current) { try { curAudio.current.pause(); curAudio.current.onended?.(new Event('ended')); } catch {} } }
        queue.current.push({ text: said.slice(0, 900), gender: c.gender || '', narrator: c.kind === 'narrator', seed: h, lang: zh ? 'zh' : 'en', audio: c.audio });
        worker();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, mode]);

  useEffect(() => () => stopAll(), []);

  // 把控制权注册给悬浮音频条（AudioManager 渲染语音开关）
  const cycleRef = useRef(cycle); cycleRef.current = cycle;
  useEffect(() => {
    setVoiceControl({ mode, quota, cycle: () => cycleRef.current() });
    return () => setVoiceControl(null);
  }, [mode, quota]);

  return { mode, cycle };
}
