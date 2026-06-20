// 音频清单：情绪类别 → 多首曲目（不写死单曲，进入状态时随机挑选、避免连续重复）。
// 曲目来自导入的 Mind's Eye Loops 音乐包，已转码为 ogg 放在 /public/audio。

export type AudioCategory =
  | 'MENU' | 'CHARACTER_CREATION' | 'EXPLORATION_SAFE' | 'EXPLORATION_DANGEROUS'
  | 'HIDDEN_CLUE' | 'PARANORMAL_EVENT' | 'MONSTER_REVEAL' | 'CHASE_SEQUENCE'
  | 'COMBAT' | 'INVESTIGATION_BREAKTHROUGH' | 'RITUAL_DISCOVERY' | 'FINAL_CONFRONTATION'
  | 'COSMIC_HORROR' | 'GOOD_ENDING' | 'BITTERSWEET_ENDING' | 'BAD_ENDING' | 'TRUTH_REVEAL'
  | 'DND_EXPLORE' | 'DND_COMBAT' | 'DND_BOSS';

const A = '/audio';
export const AUDIO_MAP: Record<AudioCategory, string[]> = {
  MENU: [`${A}/minds-eye/loop1.ogg`, `${A}/minds-eye/loop2.ogg`, `${A}/minds-eye/loop3.ogg`],
  CHARACTER_CREATION: [`${A}/fredelig-sinn/loop1.ogg`, `${A}/minds-eye/loop2.ogg`],
  EXPLORATION_SAFE: [`${A}/fredelig-sinn/loop1.ogg`, `${A}/fredelig-sinn/loop2.ogg`, `${A}/fredelig-sinn/loop3.ogg`, `${A}/fredelig-sinn/loop4.ogg`],
  EXPLORATION_DANGEROUS: [`${A}/somethings-wrong/loop1.ogg`, `${A}/veil-of-night/loop1.ogg`, `${A}/drones/horror_01_drone_01.ogg`],
  HIDDEN_CLUE: [`${A}/minds-eye/out.ogg`, `${A}/somethings-wrong/out.ogg`],
  PARANORMAL_EVENT: [`${A}/drones/horror_01_drone_glitch_01.ogg`, `${A}/veil-of-night/loop3.ogg`],
  MONSTER_REVEAL: [`${A}/drones/horror_01_drone_01.ogg`, `${A}/somethings-wrong/loop4.ogg`],
  CHASE_SEQUENCE: [`${A}/veil-of-night/loop1.ogg`, `${A}/veil-of-night/loop2.ogg`, `${A}/somethings-wrong/loop4.ogg`],
  COMBAT: [`${A}/somethings-wrong/loop2.ogg`, `${A}/veil-of-night/loop2.ogg`],
  INVESTIGATION_BREAKTHROUGH: [`${A}/minds-eye/loop1.ogg`, `${A}/minds-eye/loop3.ogg`],
  RITUAL_DISCOVERY: [`${A}/drones/horror_01_drone_glitch_01.ogg`, `${A}/veil-of-night/loop3.ogg`],
  FINAL_CONFRONTATION: [`${A}/drones/horror_01_drone_01.ogg`, `${A}/mental-vortex/loop1.ogg`],
  COSMIC_HORROR: [`${A}/drones/horror_01_drone_glitch_01.ogg`, `${A}/drones/horror_01_drone_01.ogg`, `${A}/mental-vortex/loop1.ogg`],
  GOOD_ENDING: [`${A}/fredelig-sinn/loop3.ogg`, `${A}/minds-eye/loop2.ogg`],
  BITTERSWEET_ENDING: [`${A}/minds-eye/out.ogg`, `${A}/veil-of-night/out.ogg`],
  BAD_ENDING: [`${A}/somethings-wrong/out.ogg`, `${A}/mental-vortex/loop1.ogg`],
  TRUTH_REVEAL: [`${A}/minds-eye/loop3.ogg`, `${A}/fredelig-sinn/out.ogg`],
  DND_EXPLORE: [`${A}/dnd/explore.mp3`],
  DND_COMBAT: [`${A}/dnd/combat.mp3`],
  DND_BOSS: [`${A}/dnd/boss.mp3`],
};

// 单次播放（不循环），放完自动回到之前的循环床乐
export const ONE_SHOT: AudioCategory[] = ['HIDDEN_CLUE'];

// 突然惊吓类：进入时先来一记 stinger（音量 +50%），再压上该状态的氛围床乐
export const SCARE: AudioCategory[] = ['MONSTER_REVEAL', 'PARANORMAL_EVENT'];

// 惊吓一击音效（jump-scare stingers），随机挑选
const S = `${A}/stingers`;
export const STINGERS: string[] = [
  `${S}/horror_01_stinger_impact_01.ogg`,
  `${S}/horror_01_stinger_impact_glitch_01.ogg`,
  `${S}/horror_01_stinger_drum_1_01.ogg`,
  `${S}/horror_01_stinger_drum_1_glitch_01.ogg`,
  `${S}/horror_01_stinger_piano_01.ogg`,
  `${S}/horror_01_stinger_piano_ring_mod_01.ogg`,
  `${S}/horror_01_stinger_synth_1_01.ogg`,
  `${S}/horror_01_stinger_synth_1_glitch_01.ogg`,
  `${S}/horror_01_stinger_violin_01.ogg`,
  `${S}/horror_01_stinger_violin_glitch_01.ogg`,
];

// 惊吓时 stinger 的音量倍数（基准 +50%）
export const SCARE_BOOST = 1.5;

export const ALL_CATEGORIES = Object.keys(AUDIO_MAP) as AudioCategory[];
export function isCategory(s: string): s is AudioCategory {
  return (ALL_CATEGORIES as string[]).includes(s);
}
