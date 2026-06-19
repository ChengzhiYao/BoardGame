'use client';
// 血染关键时刻音效：钟声/天亮/处决/揭晓用真实素材；其余（叫醒/杀人/死亡）用 Web Audio 合成。
import { audioBus } from './bus';

const FILES: Record<string, string> = {
  cue_nightfall: '/audio/botc/bell.mp3',     // 钟声（入夜）
  cue_dawn: '/audio/botc/dawn.mp3',          // 天亮
  cue_execution: '/audio/botc/execution.mp3',// 处决
  cue_reveal: '/audio/botc/reveal.mp3',      // 揭晓
};

let ctx: AudioContext | null = null;
function ac(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try { ctx = ctx || new (window.AudioContext || (window as any).webkitAudioContext)(); return ctx; } catch { return null; }
}
function tone(freq: number, start: number, dur: number, type: OscillatorType = 'sine', gain = 0.2, slideTo?: number) {
  const c = ac(); if (!c || audioBus.muted) return;
  const t0 = c.currentTime + start;
  const o = c.createOscillator(); const g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t0);
  if (slideTo) o.frequency.linearRampToValueAtTime(slideTo, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g); g.connect(c.destination);
  o.start(t0); o.stop(t0 + dur + 0.05);
}
export function playBotcCue(name: string) {
  const f = FILES[name];
  if (f) {
    if (typeof window === 'undefined') return;
    try { const a = new Audio(f); a.volume = audioBus.muted ? 0 : 0.9; a.play().catch(() => {}); } catch {}
    return;
  }
  const c = ac(); if (!c) return;
  if (c.state === 'suspended') c.resume().catch(() => {});
  switch (name) {
    case 'cue_wake': tone(740, 0, 0.5, 'sine', 0.16); tone(988, 0.08, 0.5, 'sine', 0.12); break;
    case 'cue_kill': tone(70, 0, 0.5, 'sawtooth', 0.22, 40); tone(150, 0, 0.35, 'square', 0.10); break;
    case 'cue_death': tone(300, 0, 0.75, 'triangle', 0.16, 150); break;
    default: break;
  }
}
