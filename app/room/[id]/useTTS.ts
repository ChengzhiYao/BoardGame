'use client';
import { useEffect, useRef, useState } from 'react';

// 共享语音系统：朗读旁白与角色发言。旁白用统一叙述嗓音，角色按名字哈希固定一种音高/语速，听感各异。
// classify(m) 返回 { kind:'narrator'|'character', name?, text } 或 null（不读）。
type Spoken = { kind: 'narrator' | 'character'; name?: string; text: string } | null;

export function useTTS(opts: { lang?: string; messages: any[]; classify: (m: any) => Spoken }) {
  const { lang, messages, classify } = opts;
  const [voiceOn, setVoiceOn] = useState(false);
  const voicesRef = useRef<SpeechSynthesisVoice[]>([]);
  const spoken = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    const load = () => { voicesRef.current = window.speechSynthesis.getVoices(); };
    load();
    window.speechSynthesis.onvoiceschanged = load;
    return () => { try { window.speechSynthesis.cancel(); } catch {} };
  }, []);

  function toggle() {
    setVoiceOn((v) => {
      const nv = !v;
      if (nv) messages.forEach((m) => m?.id && spoken.current.add(m.id));
      else window.speechSynthesis?.cancel();
      return nv;
    });
  }

  useEffect(() => {
    if (!voiceOn || typeof window === 'undefined' || !window.speechSynthesis) return;
    const zh = lang !== 'en';
    for (const m of messages) {
      if (!m?.id || spoken.current.has(m.id)) continue;
      spoken.current.add(m.id);
      const c = classify(m);
      if (!c) continue;
      const text = String(c.text || '').replace(/[🔍🔒🗳️▶👍🔧⏱⚖🎨↻🎲💀🩸✔✘]/g, '').replace(/\s+/g, ' ').trim();
      if (!text) continue;
      const all = voicesRef.current || [];
      const pool = all.filter((v) => v.lang.toLowerCase().startsWith(zh ? 'zh' : 'en'));
      const list = pool.length ? pool : all;
      const u = new SpeechSynthesisUtterance(text.slice(0, 600));
      u.lang = zh ? 'zh-CN' : 'en-US';
      if (c.kind === 'narrator') {
        u.voice = list[0] || null; u.pitch = 0.92; u.rate = 0.98;
      } else {
        const name = String(c.name || '');
        let h = 0; for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
        u.voice = list.length ? list[h % list.length] : null;
        u.pitch = 0.8 + (h % 40) / 100;
        u.rate = 0.95 + ((h >> 3) % 20) / 100;
      }
      window.speechSynthesis.speak(u);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, voiceOn]);

  return { voiceOn, toggle };
}
