// 常用调查员技能与基础值（固定常量，复用，零 token）。
// 闪避基础=DEX/2，母语基础=EDU，运行时按角色计算。
export interface SkillDef {
  name: string;
  base: number; // -1 表示动态（见 baseFor）
  en?: string;  // 英文名（英文局显示）
}

export const SKILLS: SkillDef[] = [
  { name: '会计', base: 5, en: 'Accounting' },
  { name: '考古学', base: 1, en: 'Archaeology' },
  { name: '攀爬', base: 20, en: 'Climb' },
  { name: '计算机使用', base: 5, en: 'Computer Use' },
  { name: '乔装', base: 5, en: 'Disguise' },
  { name: '驾驶汽车', base: 20, en: 'Drive Auto' },
  { name: '话术', base: 5, en: 'Fast Talk' },
  { name: '斗殴', base: 25, en: 'Brawl' },
  { name: '手枪', base: 20, en: 'Handgun' },
  { name: '急救', base: 30, en: 'First Aid' },
  { name: '历史', base: 5, en: 'History' },
  { name: '恐吓', base: 15, en: 'Intimidate' },
  { name: '图书馆使用', base: 20, en: 'Library Use' },
  { name: '聆听', base: 20, en: 'Listen' },
  { name: '锁匠', base: 1, en: 'Locksmith' },
  { name: '机械维修', base: 10, en: 'Mech. Repair' },
  { name: '医学', base: 1, en: 'Medicine' },
  { name: '博物学', base: 10, en: 'Natural World' },
  { name: '导航', base: 10, en: 'Navigate' },
  { name: '神秘学', base: 5, en: 'Occult' },
  { name: '说服', base: 10, en: 'Persuade' },
  { name: '心理学', base: 10, en: 'Psychology' },
  { name: '侦查', base: 25, en: 'Spot Hidden' },
  { name: '潜行', base: 20, en: 'Stealth' },
  { name: '游泳', base: 20, en: 'Swim' },
  { name: '追踪', base: 10, en: 'Track' },
  { name: '闪避', base: -1, en: 'Dodge' }, // DEX/2
  { name: '母语', base: -2, en: 'Own Language' }, // EDU
];

export function baseFor(def: SkillDef, char: { dex?: number; edu?: number }): number {
  if (def.base === -1) return Math.floor((char.dex || 0) / 2);
  if (def.base === -2) return char.edu || 0;
  return def.base;
}

// 建卡技能点池（简化版）：职业点 EDU×4 + 兴趣点 INT×2，合并自由分配；单技能上限 75。
export function skillPointPool(char: { edu?: number; int_attr?: number }): number {
  return (char.edu || 0) * 4 + (char.int_attr || 0) * 2;
}
export const SKILL_CAP = 75;
