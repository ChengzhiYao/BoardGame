'use client';
// 海龟汤回答提示音（浏览器现场合成，不用音频文件）：是=奖励钟音，不是=低沉闷响，无关=轻的空响，是也不是=柔和单音；
// 说出真相：答对=上行琶音，还差一点=下行小调。跟着「背景音乐与音效」开关走。
import { audioBus } from './bus';

let ctx: AudioContext | null = null;
function ac() {
  if (typeof window === 'undefined') return null;
  try { if (!ctx) ctx = new ((window as any).AudioContext || (window as any).webkitAudioContext)(); if (ctx?.state === 'suspended') ctx.resume(); return ctx; } catch { return null; }
}

function bell(c: AudioContext, freq: number, at: number, dur: number, gain: number, type: OscillatorType = 'sine') {
  const o = c.createOscillator(), o2 = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.value = freq; o2.type = 'sine'; o2.frequency.value = freq * 2.01; // 泛音，像钟
  const g2 = c.createGain(); g2.gain.value = 0.25;
  o.connect(g); o2.connect(g2); g2.connect(g); g.connect(c.destination);
  const t = c.currentTime + at;
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.start(t); o2.start(t); o.stop(t + dur + 0.05); o2.stop(t + dur + 0.05);
}

function thud(c: AudioContext, freq: number, at: number, dur: number, gain: number, noise = 0) {
  const t = c.currentTime + at;
  const o = c.createOscillator(), g = c.createGain();
  o.type = 'sine'; o.frequency.setValueAtTime(freq * 1.6, t); o.frequency.exponentialRampToValueAtTime(freq, t + 0.08);
  o.connect(g); g.connect(c.destination);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.start(t); o.stop(t + dur + 0.05);
  if (noise) {
    const len = Math.floor(c.sampleRate * 0.12), buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const n = c.createBufferSource(), f = c.createBiquadFilter(), ng = c.createGain();
    n.buffer = buf; f.type = 'lowpass'; f.frequency.value = 900; ng.gain.value = noise;
    n.connect(f); f.connect(ng); ng.connect(c.destination); n.start(t);
  }
}

export function playAnswerSfx(kind: '是' | '不是' | '无关' | '是也不是' | 'right' | 'wrong') {
  if (audioBus.muted) return;
  const c = ac(); if (!c) return;
  const v = Math.max(0.15, Math.min(1, audioBus.musicVol || 0.6));
  switch (kind) {
    case '是': bell(c, 659.25, 0, 0.9, 0.22 * v); bell(c, 987.77, 0.11, 1.3, 0.2 * v); break;           // E5 → B5 上扬
    case '是也不是': bell(c, 587.33, 0, 1.0, 0.16 * v, 'triangle'); break;                            // D5 单音
    case '不是': thud(c, 82, 0, 0.45, 0.5 * v, 0.12 * v); break;                                      // 低沉闷响
    case '无关': thud(c, 220, 0, 0.12, 0.12 * v, 0.05 * v); break;                                    // 轻的空响
    case 'right': [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => bell(c, f, i * 0.09, 1.6, 0.17 * v)); break; // C 大调琶音
    case 'wrong': bell(c, 440, 0, 0.5, 0.14 * v, 'triangle'); bell(c, 349.23, 0.18, 0.8, 0.13 * v, 'triangle'); break; // A → F 下行
  }
}
