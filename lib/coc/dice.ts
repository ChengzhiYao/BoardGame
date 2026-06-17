// =====================================================================
// CoC 7e 骰子引擎（纯逻辑，服务端使用）。
// 随机数在服务端生成 → 结果落库 dice_rolls（不可改）。前端只播放动画。
// =====================================================================

export type DiceType = 'd100' | 'd20' | 'd10' | 'd6';
export type Outcome = 'fumble' | 'fail' | 'success' | 'hard' | 'extreme' | 'critical';

function rollDie(sides: number): number {
  return Math.floor(Math.random() * sides) + 1;
}

// 掷一个普通骰
export function rollSimple(type: DiceType): number {
  const sides = { d100: 100, d20: 20, d10: 10, d6: 6 }[type];
  return rollDie(sides);
}

// d100 技能判定（CoC 7e 成功等级）
// skillValue 即成功率。bonus/penalty 为奖励/惩罚骰个数。
export interface SkillCheckResult {
  result: number;          // 最终骰面
  tensRolls: number[];     // 十位骰（含奖惩骰）
  ones: number;            // 个位骰
  outcome: Outcome;
  skillValue: number;
}

export function skillCheck(skillValue: number, bonus = 0, penalty = 0): SkillCheckResult {
  const ones = rollDie(10) % 10;          // 0-9
  const count = 1 + Math.max(bonus, penalty);
  const tensRolls: number[] = [];
  for (let i = 0; i < count; i++) tensRolls.push(rollDie(10) % 10); // 0-9 代表 0,10,...,90

  // 奖励骰取最小十位（更好），惩罚骰取最大十位（更差）
  let tens: number;
  if (bonus > penalty) tens = Math.min(...tensRolls);
  else if (penalty > bonus) tens = Math.max(...tensRolls);
  else tens = tensRolls[0];

  let result = tens * 10 + ones;
  if (result === 0) result = 100;          // 00+0 = 100

  return { result, tensRolls, ones, outcome: gradeOutcome(result, skillValue), skillValue };
}

export function gradeOutcome(result: number, skillValue: number): Outcome {
  if (result === 1) return 'critical';
  // 大失败：技能<50 时 96-100；技能>=50 时仅 100
  if ((skillValue < 50 && result >= 96) || result === 100) return 'fumble';
  if (result > skillValue) return 'fail';
  if (result <= Math.floor(skillValue / 5)) return 'extreme';
  if (result <= Math.floor(skillValue / 2)) return 'hard';
  return 'success';
}

export const OUTCOME_LABEL: Record<Outcome, string> = {
  critical: '大成功',
  extreme: '极难成功',
  hard: '困难成功',
  success: '普通成功',
  fail: '失败',
  fumble: '大失败',
};

// 对抗检定：比较两边成功等级（等级高者胜，同级比骰面更接近成功者胜）
const RANK: Record<Outcome, number> = { fumble: 0, fail: 1, success: 2, hard: 3, extreme: 4, critical: 5 };
export function opposedWinner(a: SkillCheckResult, b: SkillCheckResult): 'a' | 'b' | 'tie' {
  if (RANK[a.outcome] !== RANK[b.outcome]) return RANK[a.outcome] > RANK[b.outcome] ? 'a' : 'b';
  // 同级：成功方比谁余量大；失败方比谁更接近成功
  return a.result < b.result ? 'a' : a.result > b.result ? 'b' : 'tie';
}
