'use client';
import { useEffect, useRef, useState } from 'react';
import { AUDIO_MAP, ONE_SHOT, SCARE, STINGERS, SCARE_BOOST, isCategory, type AudioCategory } from '@/lib/audio/manifest';
import { audioBus } from '@/lib/audio/bus';
import { subscribeVoiceControl, getVoiceControl, type VCtrl } from './voiceControl';
import { playSfx } from '@/lib/audio/sfx';

// 旁白内容 → 情绪（服务端给的状态是底，旁白里的事件临时盖上去，约 2 分钟后回落）
const MOOD: [RegExp, AudioCategory][] = [
  [/尸体|血迹|鲜血|死了|惨叫|尖叫|corpse|blood|scream|dead body/i, 'MONSTER_REVEAL'],
  [/追|快跑|逃|冲过来|扑过来|chase|run!|rushes? at|lunges/i, 'CHASE_SEQUENCE'],
  [/打斗|搏斗|开枪|刀|厮打|fight|gunshot|stab|attack/i, 'COMBAT'],
  [/低语|耳语|影子|镜子|幻觉|不对劲|whisper|shadow|mirror|something.?s wrong/i, 'PARANORMAL_EVENT'],
  [/真相|原来|终于明白|水落石出|the truth|finally understand/i, 'TRUTH_REVEAL'],
  [/发现|线索|找到了|注意到|clue|you find|you notice/i, 'INVESTIGATION_BREAKTHROUGH'],
];
// [[拟声]] → 音效
const SFX_WORDS: [RegExp, string][] = [
  [/吱呀|门|creak|door/i, 'creaking_door'],
  [/吼|咆哮|growl|roar/i, 'monster_growl'],
  [/风|呼——|呼呼|wind|howl/i, 'ambient_wind'],
  [/楼梯|stairs/i, 'footsteps_stairs'],
  [/脚步|嗒|踏|footstep|step/i, 'footsteps_wood'],
];

// 前端音乐状态机：AI 只返回 scene_state，这里负责淡入淡出、循环、单次、惊吓、音量。
export default function AudioManager({ state }: { state: string }) {
  const base = (isCategory((state || '').toUpperCase()) ? state.toUpperCase() : 'MENU') as AudioCategory;
  const [over, setOver] = useState<{ c: AudioCategory; until: number } | null>(null);
  const [tick, setTick] = useState(0);
  const cat: AudioCategory = over && Date.now() < over.until && !/ENDING|TRUTH_REVEAL|MENU|CHARACTER/.test(base) ? over.c : base;
  const [enabled, setEnabled] = useState(false);
  const [muted, setMuted] = useState(false);
  const [vol, setVol] = useState(0.6);
  const [voice, setVoice] = useState<VCtrl>(getVoiceControl());
  useEffect(() => subscribeVoiceControl(setVoice), []);

  // 可拖动：玩家自由把悬浮条拖到不挡屏幕的位置，记住坐标
  const barRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const posRef = useRef<{ x: number; y: number } | null>(null);
  const dragRef = useRef<{ dx: number; dy: number } | null>(null);
  useEffect(() => { try { const s = localStorage.getItem('audiobar_pos'); if (s) { const p = JSON.parse(s); if (p.x < 140 && p.y < 70) { localStorage.removeItem('audiobar_pos'); return; } if (p.x > window.innerWidth - 60 || p.y > window.innerHeight - 40) return; setPos(p); posRef.current = p; } } catch {} }, []); // 别压住左上角的「离开」
  function onGripDown(e: any) {
    const r = barRef.current?.getBoundingClientRect(); if (!r) return;
    dragRef.current = { dx: e.clientX - r.left, dy: e.clientY - r.top };
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}
    e.preventDefault();
  }
  function onGripMove(e: any) {
    if (!dragRef.current) return;
    const w = barRef.current?.offsetWidth || 160, h = barRef.current?.offsetHeight || 36;
    const W = typeof window !== 'undefined' ? window.innerWidth : 9999, H = typeof window !== 'undefined' ? window.innerHeight : 9999;
    const x = Math.max(4, Math.min(W - w - 4, e.clientX - dragRef.current.dx));
    let y = Math.max(4, Math.min(H - h - 4, e.clientY - dragRef.current.dy));
    if (x < 140 && y < 56) y = 56;
    const p = { x, y }; posRef.current = p; setPos(p);
  }
  function onGripUp() { if (dragRef.current) { dragRef.current = null; try { localStorage.setItem('audiobar_pos', JSON.stringify(posRef.current)); } catch {} } }

  const bedRef = useRef<HTMLAudioElement | null>(null);
  const fadeRef = useRef<any>(null);
  const lastLoopCat = useRef<AudioCategory | null>(null);
  const lastTrack = useRef<Record<string, string>>({});
  const volRef = useRef(vol);
  const duckRef = useRef(false);
  const bedStart = useRef(0);
  const enabledRef = useRef(false);
  const mutedRef = useRef(muted);
  volRef.current = vol;
  mutedRef.current = muted;
  enabledRef.current = enabled;

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
    const duck = duckRef.current ? 0.35 : 1; // 旁白说话时把音乐压低
    return mutedRef.current ? 0 : Math.min(1, volRef.current * boost * duck);
  }

  function fadeVol(a: HTMLAudioElement, to: number) {
    const from = a.volume; let i = 0;
    const iv = setInterval(() => { i++; a.volume = Math.max(0, Math.min(1, from + (to - from) * (i / 12))); if (i >= 12) clearInterval(iv); }, 50);
  }

  function playStinger(mult = SCARE_BOOST) {
    const url = pick(STINGERS, 'stinger');
    if (!url) return;
    const a = new Audio(url);
    a.volume = mutedRef.current ? 0 : Math.min(1, volRef.current * mult);
    a.play().catch(() => {});
  }

  function crossfadeTo(url: string, target: number) {
    const old = bedRef.current;
    const oldStart = old ? old.volume : 0;
    const next = new Audio(url);
    next.loop = true;
    next.volume = 0;
    bedRef.current = next;
    bedStart.current = Date.now();
    next.play().catch(() => {});
    if (fadeRef.current) clearInterval(fadeRef.current);
    const steps = 60, dt = 50;
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

  // 旁白事件：换情绪 / 配音效 / 喊叫时一记轻惊吓
  useEffect(() => {
    const onNarr = (e: any) => {
      const text: string = String(e?.detail?.text || '');
      if (!text) return;
      const plain = text.replace(/\[\[.+?\]\]/g, ' ');
      for (const [re, c] of MOOD) { if (re.test(plain)) { setOver({ c, until: Date.now() + 120000 }); break; } }
      const sfx = Array.from(text.matchAll(/\[\[(.+?)\]\]/g)).map((m) => m[1]);
      let delay = 400;
      for (const w of sfx.slice(0, 2)) { const hit = SFX_WORDS.find(([re]) => re.test(w)); if (hit) { const k = hit[1]; setTimeout(() => playSfx(k), delay); delay += 900; } }
      if (/!!.+?!!/s.test(text) && enabledRef.current) setTimeout(() => playStinger(0.8), 250);
    };
    const onSpeak = (e: any) => { duckRef.current = !!e?.detail; if (bedRef.current && lastLoopCat.current) fadeVol(bedRef.current, bedVolume(lastLoopCat.current)); };
    window.addEventListener('mn-narr', onNarr);
    window.addEventListener('mn-speaking', onSpeak);
    // 情绪覆盖到期 → 回落；同一首放久了换一首同情绪的
    const iv = setInterval(() => setTick((x) => x + 1), 15000);
    return () => { window.removeEventListener('mn-narr', onNarr); window.removeEventListener('mn-speaking', onSpeak); clearInterval(iv); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (!enabled || !bedRef.current || !lastLoopCat.current) return;
    if (Date.now() - bedStart.current < 240000) return;
    const list = AUDIO_MAP[lastLoopCat.current];
    if (list.length < 2 || ONE_SHOT.includes(lastLoopCat.current)) return;
    const url = pick(list, lastLoopCat.current);
    if (url) crossfadeTo(url, bedVolume(lastLoopCat.current));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick]);

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
    <div ref={barRef} style={pos ? { left: pos.x, top: pos.y, right: 'auto', bottom: 'auto' } : undefined}
      className="fixed right-2 top-[58px] lg:top-auto lg:bottom-3 lg:right-3 z-50 flex flex-nowrap items-center gap-2 whitespace-nowrap bg-fog/90 border border-eldritch/30 rounded-full px-3 py-1.5 backdrop-blur">
      <span onPointerDown={onGripDown} onPointerMove={onGripMove} onPointerUp={onGripUp} style={{ touchAction: 'none' }}
        className="cursor-move select-none text-parchment/40 leading-none px-0.5" title="拖动">⠿</span>
      {voice && (
        <button onClick={voice.cycle}
          title={voice.quota ? '今天的免费语音用完了' : voice.mode === 'off' ? '旁白语音：关' : '旁白语音：开'}
          className={`text-sm ${voice.mode === 'off' ? 'opacity-40' : ''}`}>
          {voice.mode === 'off' ? '🔈' : '🎙️'}
        </button>
      )}
      <span className="w-px h-4 bg-eldritch/30" />
      <button onClick={() => setMuted((m) => !m)} className="text-parchment/80 text-sm" title="背景音乐静音">
        {muted ? '🔇' : '🔊'}
      </button>
      <input type="range" min={0} max={1} step={0.05} value={vol} onChange={(e) => setVol(+e.target.value)} className="w-16 accent-eldritch" />
    </div>
  );
}
