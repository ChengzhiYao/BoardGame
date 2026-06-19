'use client';
// 午夜猫诅咒音效：抽/翻/出局/胜利等。护身铃复用已有 bell.mp3，胜利复用 reveal.mp3，其余 Web Audio 合成。
import { audioBus } from './bus';

const FILES: Record<string, string> = { ward: '/audio/botc/bell.mp3', win: '/audio/botc/reveal.mp3' };
let ctx: AudioContext | null = null;
function ac(): AudioContext | null { if (typeof window === 'undefined') return null; try { ctx = ctx || new (window.AudioContext || (window as any).webkitAudioContext)(); return ctx; } catch { return null; } }
function tone(freq: number, start: number, dur: number, type: OscillatorType = 'sine', gain = 0.16, slideTo?: number) {
  const c = ac(); if (!c || audioBus.muted) return; const t0 = c.currentTime + start;
  const o = c.createOscillator(); const g = c.createGain(); o.type = type; o.frequency.setValueAtTime(freq, t0);
  if (slideTo) o.frequency.linearRampToValueAtTime(slideTo, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(gain, t0 + 0.015); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g); g.connect(c.destination); o.start(t0); o.stop(t0 + dur + 0.04);
}
export function mccSfx(name: string) {
  const f = FILES[name];
  if (f) { if (typeof window === 'undefined') return; try { const a = new Audio(f); a.volume = audioBus.muted ? 0 : 0.85; a.play().catch(() => {}); } catch {} return; }
  const c = ac(); if (!c) return; if (c.state === 'suspended') c.resume().catch(() => {});
  switch (name) {
    case 'flip': tone(520, 0, 0.08, 'triangle', 0.13, 720); break;
    case 'draw': tone(300, 0, 0.16, 'sine', 0.14, 560); break;
    case 'curse': tone(58, 0, 0.9, 'sawtooth', 0.28, 34); tone(120, 0, 0.55, 'square', 0.13); tone(40, 0.12, 0.7, 'sine', 0.2); tone(220, 0, 0.18, 'square', 0.1); break;
    case 'eliminate': tone(70, 0, 0.6, 'sawtooth', 0.22, 40); tone(300, 0, 0.5, 'triangle', 0.1, 120); break;
    default: break;
  }
}
