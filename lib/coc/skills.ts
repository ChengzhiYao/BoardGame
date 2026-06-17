// 常用调查员技能与基础值（固定常量，复用，零 token）。
// 闪避基础=DEX/2，母语基础=EDU，运行时按角色计算。
export interface SkillDef {
  name: string;
  base: number; // -1 表示动态（见 baseFor）
}

export const SKILLS: SkillDef[] = [
  { name: '会计', base: 5 },
  { name: '考古学', base: 1 },
  { name: '攀爬', base: 20 },
  { name: '计算机使用', base: 5 },
  { name: '乔装', base: 5 },
  { name: '驾驶汽车', base: 20 },
  { name: '话术', base: 5 },
  { name: '斗殴', base: 25 },
  { name: '手枪', base: 20 },
  { name: '急救', base: 30 },
  { name: '历史', base: 5 },
  { name: '恐吓', base: 15 },
  { name: '图书馆使用', base: 20 },
  { name: '聆听', base: 20 },
  { name: '锁匠', base: 1 },
  { name: '机械维修', base: 10 },
  { name: '医学', base: 1 },
  { name: '博物学', base: 10 },
  { name: '导航', base: 10 },
  { name: '神秘学', base: 5 },
  { name: '说服', base: 10 },
  { name: '心理学', base: 10 },
  { name: '侦查', base: 25 },
  { name: '潜行', base: 20 },
  { name: '游泳', base: 20 },
  { name: '追踪', base: 10 },
  { name: '闪避', base: -1 }, // DEX/2
  { name: '母语', base: -2 }, // EDU
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
