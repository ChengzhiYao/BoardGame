// 讲故事配乐层：按段落情绪切换氛围床乐 + 触发音效 / 惊吓一击。跟随朗读进度（双人各自本地播放，因进度同步而一致）。
import { AUDIO_MAP, STINGERS } from './manifest';
import { audioBus } from './bus';
import { playSfx } from './sfx';

let bgm: HTMLAudioElement | null = null;
let bgmCat = '';
let fadeTimer: any = null;

function fade(a: HTMLAudioElement, target: number, ms = 700, done?: () => void) {
  const steps = 14, dt = ms / steps; const from = a.volume; let n = 0;
  const id = setInterval(() => {
    n++; const v = from + (target - from) * (n / steps);
    try { a.volume = Math.max(0, Math.min(1, v)); } catch {}
    if (n >= steps) { clearInterval(id); done?.(); }
  }, dt);
}

export function setStoryBgm(cat: string, vol = 0.28) {
  if (typeof window === 'undefined') return;
  const pool = (AUDIO_MAP as any)[cat];
  if (!pool || !pool.length) return;
  if (bgmCat === cat && bgm) { if (!audioBus.muted && bgm.paused) bgm.play().catch(() => {}); return; }
  const next = pool[Math.floor(Math.random() * pool.length)];
  const old = bgm;
  const a = new Audio(next); a.loop = true; a.volume = 0; bgm = a; bgmCat = cat;
  if (!audioBus.muted) a.play().catch(() => {});
  fade(a, audioBus.muted ? 0 : vol);
  if (old) fade(old, 0, 700, () => { try { old.pause(); } catch {} });
}
export function pauseStoryBgm() { if (bgm) { try { bgm.pause(); } catch {} } }
export function resumeStoryBgm() { if (bgm && !audioBus.muted) bgm.play().catch(() => {}); }
export function stopStoryBgm() { if (fadeTimer) clearInterval(fadeTimer); if (bgm) { try { bgm.pause(); } catch {} } bgm = null; bgmCat = ''; }
export function storyStinger() {
  if (typeof window === 'undefined' || audioBus.muted) return;
  const s = STINGERS[Math.floor(Math.random() * STINGERS.length)];
  try { const a = new Audio(s); a.volume = 0.7; a.play().catch(() => {}); } catch {}
}
export function storySfx(key: string) { try { playSfx(key); } catch {} }
