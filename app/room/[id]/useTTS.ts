'use client';
import { useEffect, useRef, useState } from 'react';

// 共享语音系统：三档 —— off(关) / browser(免费浏览器语音) / openai(高音质真人声)。
// classify(m) 返回 { kind:'narrator'|'character', name?, text } 或 null（不读）。
type Spoken = { kind: 'narrator' | 'character'; name?: string; text: string } | null;
export type VoiceMode = 'off' | 'browser' | 'openai';

const OAI_CHAR_VOICES = ['alloy', 'echo', 'fable', 'nova', 'shimmer'];
const OAI_NARRATOR = 'onyx';

const clean = (t: string) => String(t || '').replace(/[🔍🔒🗳️▶👍🔧⏱⚖🎨↻🎲💀🩸✔✘🔊🔈🎙️]/g, '').replace(/\s+/g, ' ').trim();
function hashName(name: string) { let h = 0; for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0; return h; }

export function useTTS(opts: { lang?: string; messages: any[]; classify: (m: any) => Spoken; roomId?: string }) {
  const { lang, messages, classify, roomId } = opts;
  const [mode, setMode] = useState<VoiceMode>('off');
  const modeRef = useRef<VoiceMode>('off'); modeRef.current = mode;
  const voicesRef = useRef<SpeechSynthesisVoice[]>([]);
  const spoken = useRef<Set<string>>(new Set());
  const queue = useRef<{ text: string; voice: string }[]>([]);
  const running = useRef(false);
  const curAudio = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    const load = () => { voicesRef.current = window.speechSynthesis.getVoices(); };
    load();
    window.speechSynthesis.onvoiceschanged = load;
    return () => { try { window.speechSynthesis.cancel(); } catch {} };
  }, []);

  function stopAll() {
    try { window.speechSynthesis?.cancel(); } catch {}
    queue.current = [];
    running.current = false;
    if (curAudio.current) { try { curAudio.current.pause(); } catch {} curAudio.current = null; }
  }

  function cycle() {
    setMode((m) => {
      const next: VoiceMode = m === 'off' ? 'browser' : m === 'browser' ? 'openai' : 'off';
      stopAll();
      if (next !== 'off') messages.forEach((x) => x?.id && spoken.current.add(x.id));
      return next;
    });
  }

  async function worker() {
    if (running.current) return;
    running.current = true;
    while (queue.current.length && modeRef.current === 'openai') {
      const task = queue.current.shift()!;
      try {
        const res = await fetch('/api/tts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ roomId, text: task.text, voice: task.voice }) });
        if (!res.ok) continue;
        const { url } = await res.json();
        if (!url) continue;
        await new Promise<void>((resolve) => {
          const a = new Audio(url);
          curAudio.current = a;
          a.onended = () => resolve();
          a.onerror = () => resolve();
          a.play().catch(() => resolve());
        });
      } catch { /* skip */ }
    }
    running.current = false;
  }

  useEffect(() => {
    if (mode === 'off' || typeof window === 'undefined') return;
    const zh = lang !== 'en';
    for (const m of messages) {
      if (!m?.id || spoken.current.has(m.id)) continue;
      spoken.current.add(m.id);
      const c = classify(m);
      if (!c) continue;
      const text = clean(c.text);
      if (!text) continue;

      if (mode === 'browser') {
        if (!window.speechSynthesis) continue;
        const all = voicesRef.current || [];
        const pool = all.filter((v) => v.lang.toLowerCase().startsWith(zh ? 'zh' : 'en'));
        const list = pool.length ? pool : all;
        const u = new SpeechSynthesisUtterance(text.slice(0, 600));
        u.lang = zh ? 'zh-CN' : 'en-US';
        if (c.kind === 'narrator') { u.voice = list[0] || null; u.pitch = 0.92; u.rate = 0.98; }
        else { const h = hashName(String(c.name || '')); u.voice = list.length ? list[h % list.length] : null; u.pitch = 0.8 + (h % 40) / 100; u.rate = 0.95 + ((h >> 3) % 20) / 100; }
        window.speechSynthesis.speak(u);
      } else {
        const voice = c.kind === 'narrator' ? OAI_NARRATOR : OAI_CHAR_VOICES[hashName(String(c.name || '')) % OAI_CHAR_VOICES.length];
        queue.current.push({ text: text.slice(0, 900), voice });
        worker();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, mode]);

  useEffect(() => () => stopAll(), []);

  return { mode, cycle };
}
