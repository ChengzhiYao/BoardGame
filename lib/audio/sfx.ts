// 事件音效层（脚步、开门、风声、低吼…）。KP 返回 sfx 键，前端叠加播放在音乐之上。
import { audioBus } from './bus';

const BASE = '/audio/sfx';
function list(slug: string, n: number): string[] {
  return Array.from({ length: n }, (_, i) => `${BASE}/${slug}/${slug}-${i + 1}.mp3`);
}

export const SFX_MAP: Record<string, string[]> = {
  ambient_wind: list('ambient_wind', 9),
  creaking_door: list('creaking_door', 12),
  monster_growl: list('monster_growl', 12),
  footsteps_concrete: list('footsteps_concrete', 4),
  footsteps_carpet: list('footsteps_carpet', 4),
  footsteps_leaves: list('footsteps_leaves', 4),
  footsteps_metal: list('footsteps_metal', 4),
  footsteps_wind: list('footsteps_wind', 4),
  footsteps_gravel: list('footsteps_gravel', 8),
  footsteps_mud: list('footsteps_mud', 8),
  footsteps_stairs: list('footsteps_stairs', 8),
  footsteps_wood: list('footsteps_wood', 8),
};

export const SFX_KEYS = Object.keys(SFX_MAP);

// 仅在浏览器调用：随机挑一条变体播放
export function playSfx(key: string) {
  if (typeof window === 'undefined') return;
  const arr = SFX_MAP[key];
  if (!arr || !arr.length) return;
  const url = arr[Math.floor(Math.random() * arr.length)];
  const a = new Audio(url);
  a.volume = audioBus.muted ? 0 : 0.85;
  a.play().catch(() => {});
}
