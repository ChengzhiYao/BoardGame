'use client';
// D&D 音乐与音效：探索/战斗 BGM 按阶段切换 + 战斗音效（用户自备素材）。
import { audioBus } from './bus';

const SFX: Record<string, string> = {
  hit: '/audio/dnd/hit.wav', miss: '/audio/dnd/miss.wav', spell: '/audio/dnd/spell.wav',
  hurt: '/audio/dnd/hurt.wav', death: '/audio/dnd/death.wav', level: '/audio/dnd/level.wav',
};
export function dndSfx(name: string) {
  const f = SFX[name]; if (!f || typeof window === 'undefined' || audioBus.muted) return;
  try { const a = new Audio(f); a.volume = 0.7; a.play().catch(() => {}); } catch {}
}

const BGM: Record<string, string> = { explore: '/audio/dnd/explore.mp3', combat: '/audio/dnd/combat.mp3', boss: '/audio/dnd/boss.mp3' };
let bgm: HTMLAudioElement | null = null;
let bgmKey = '';
export function setDndBgm(key: string) {
  if (typeof window === 'undefined') return;
  const src = BGM[key];
  if (!src) { stopDndBgm(); return; }
  if (bgmKey === key && bgm) { bgm.volume = audioBus.muted ? 0 : 0.32; if (bgm.paused && !audioBus.muted) bgm.play().catch(() => {}); return; }
  if (bgm) { try { bgm.pause(); } catch {} }
  try { bgm = new Audio(src); bgm.loop = true; bgm.volume = audioBus.muted ? 0 : 0.32; bgmKey = key; if (!audioBus.muted) bgm.play().catch(() => {}); } catch {}
}
export function stopDndBgm() { if (bgm) { try { bgm.pause(); } catch {} bgm = null; } bgmKey = ''; }
export function setDndMuted(m: boolean) { audioBus.muted = m; if (bgm) { bgm.volume = m ? 0 : 0.32; if (!m) bgm.play().catch(() => {}); } }
export function dndMuted() { return audioBus.muted; }
