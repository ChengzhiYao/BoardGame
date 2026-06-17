'use client';
import { useEffect, useRef, useState } from 'react';
import { AUDIO_MAP, ONE_SHOT, SCARE, STINGERS, SCARE_BOOST, isCategory, type AudioCategory } from '@/lib/audio/manifest';
import { audioBus } from '@/lib/audio/bus';

// 前端音乐状态机：AI 只返回 scene_state，这里负责淡入淡出、循环、单次、惊吓、音量。
export default function AudioManager({ state }: { state: string }) {
  const cat = (isCategory((state || '').toUpperCase()) ? state.toUpperCase() : 'MENU') as AudioCategory;
  const [enabled, setEnabled] = useState(false);
  const [muted, setMuted] = useState(false);
  const [vol, setVol] = useState(0.6);

  const bedRef = useRef<HTMLAudioElement | null>(null);
  const fadeRef = useRef<any>(null);
  const lastLoopCat = useRef<AudioCategory | null>(null);
  const lastTrack = useRef<Record<string, string>>({});
  const volRef = useRef(vol);
  const mutedRef = useRef(muted);
  volRef.current = vol;
  mutedRef.current = muted;

  function pick(list: string[], key: string): string | null {
    if (!list.length) return null;
    let t = list[0];
    for (let i = 0; i < 6; i++) {
      t = list[Math.floor(Math.random() * list.length)];
      if (list.length === 1 || t !== lastTrack.current[key]) break;
    }
    lastTrack.current[key] = t;
    return t;
  }

  function bedVolume(c: AudioCategory) {
    const boost = SCARE.includes(c) ? SCARE_BOOST : 1;
    return mutedRef.current ? 0 : Math.min(1, volRef.current * boost);
  }

  function playStinger() {
    const url = pick(STINGERS, 'stinger');
    if (!url) return;
    const a = new Audio(url);
    a.volume = mutedRef.current ? 0 : Math.min(1, volRef.current * SCARE_BOOST);
    a.play().catch(() => {});
  }

  function crossfadeTo(url: string, target: number) {
    const old = bedRef.current;
    const oldStart = old ? old.volume : 0;
    const next = new Audio(url);
    next.loop = true;
    next.volume = 0;
    bedRef.current = next;
    next.play().catch(() => {});
    if (fadeRef.current) clearInterval(fadeRef.current);
    const steps = 30, dt = 50;
    let i = 0;
    fadeRef.current = setInterval(() => {
      i++;
      const p = i / steps;
      next.volume = mutedRef.current ? 0 : target * p;
      if (old) old.volume = mutedRef.current ? 0 : oldStart * (1 - p);
      if (i >= steps) {
        clearInterval(fadeRef.current);
        if (old) old.pause();
      }
    }, dt);
  }

  // 状态切换
  useEffect(() => {
    if (!enabled) return;

    if (ONE_SHOT.includes(cat)) {
      // 单次：在床乐之上播一遍，不改变床乐
      const url = pick(AUDIO_MAP[cat], cat);
      if (url) {
        const a = new Audio(url);
        a.volume = mutedRef.current ? 0 : Math.min(1, volRef.current);
        a.play().catch(() => {});
      }
      return;
    }

    if (SCARE.includes(cat)) playStinger(); // 惊吓一击（+50%）

    if (lastLoopCat.current === cat) {
      if (bedRef.current) bedRef.current.volume = bedVolume(cat);
      return;
    }
    const url = pick(AUDIO_MAP[cat], cat);
    if (url) {
      crossfadeTo(url, bedVolume(cat));
      lastLoopCat.current = cat;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cat, enabled]);

  // 音量 / 静音 实时调整床乐，并同步到共享 bus（音效层读取）
  useEffect(() => {
    audioBus.muted = muted;
    audioBus.musicVol = vol;
    if (bedRef.current && lastLoopCat.current) bedRef.current.volume = bedVolume(lastLoopCat.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [muted, vol]);

  // 浏览器自动播放限制：首次任意交互后解锁
  useEffect(() => {
    if (enabled) return;
    const unlock = () => setEnabled(true);
    document.addEventListener('click', unlock, { once: true });
    document.addEventListener('keydown', unlock, { once: true });
    return () => {
      document.removeEventListener('click', unlock);
      document.removeEventListener('keydown', unlock);
    };
  }, [enabled]);

  useEffect(() => () => { if (bedRef.current) bedRef.current.pause(); }, []);

  return (
    <div className="fixed right-2 top-2 lg:top-auto lg:bottom-3 lg:right-3 z-50 flex items-center gap-2 bg-fog/90 border border-eldritch/30 rounded-full px-3 py-1.5 backdrop-blur">
      <button onClick={() => setMuted((m) => !m)} className="text-parchment/80 text-sm" title="静音">
        {muted ? '🔇' : '🔊'}
      </button>
      <input type="range" min={0} max={1} step={0.05} value={vol} onChange={(e) => setVol(+e.target.value)} className="w-16 accent-eldritch" />
      {!enabled && <span className="text-[10px] text-parchment/50">点任意处开启音乐</span>}
    </div>
  );
}
