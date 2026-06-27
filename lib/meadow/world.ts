// 童话草原 · 世界逻辑：地点 / 迁徙 / 季节 / 被捕食 / 确定性结算（纯函数）。
export type ActionKind = 'forage' | 'hunt' | 'rest' | 'move';

export interface Loc { key: string; zh: string; food: number; exposure: number; }
export const LOCATIONS: Loc[] = [
  { key: 'meadow', zh: '开阔草场', food: 1.0, exposure: 0.8 },
  { key: 'warren', zh: '兔窟地洞', food: 0.2, exposure: 0.05 },
  { key: 'oak', zh: '橡树林缘', food: 0.7, exposure: 0.4 },
  { key: 'pond', zh: '芦苇池塘', food: 0.6, exposure: 0.5 },
];
export function locOf(key: string): Loc { return LOCATIONS.find((l) => l.key === key) || LOCATIONS[0]; }
export function locZh(key: string): string { return locOf(key).zh; }
export function dangerLabel(exposure: number): string { return exposure >= 0.7 ? '危险' : exposure >= 0.35 ? '有风险' : '安全'; }

export const ACTIONS: Record<ActionKind, { zh: string; baseSec: number; desc: string }> = {
  forage: { zh: '觅食', baseSec: 180, desc: '翻找能吃的（草食收益高）' },
  hunt: { zh: '捕猎', baseSec: 240, desc: '扑倒猎物（肉食收益高，有风险）' },
  rest: { zh: '休息躲藏', baseSec: 120, desc: '安全地歇一会儿' },
  move: { zh: '迁徙', baseSec: 120, desc: '前往另一处地点' },
};

export function actionDuration(char: any, kind: ActionKind): number {
  const inst = char?.instincts || {};
  const speed = kind === 'forage' ? (inst.forage || 0) : kind === 'hunt' ? (inst.hunt || 0) : 0;
  return Math.round(ACTIONS[kind].baseSec * (1 - Math.min(0.5, speed * 0.03)));
}

// 季节对食物丰度的影响：冬季稀缺。
export function seasonFactor(season: string): number {
  return season === '冬' ? 0.45 : season === '秋' ? 1.2 : season === '夏' ? 1.1 : 1.0;
}

export interface Ctx { location: string; season: string; night: boolean; target?: string; }
export interface Outcome { hungerDelta: number; events: string[]; death?: string; moveTo?: string; }

// 被捕食判定：暴露度 × 昼夜 × 食性 决定遭遇概率；遭遇后据敏捷/逃逸/特性闪避。
function tryPredation(char: any, ctx: Ctx, rng: () => number): { event?: string; death?: string } {
  const loc = locOf(ctx.location);
  const dietMul = char?.diet === 'carnivore' ? 0.1 : char?.diet === 'omnivore' ? 0.6 : 1.0;
  const chance = loc.exposure * (ctx.night ? 1.4 : 1.0) * dietMul * 0.18;
  if (rng() >= chance) return {};
  const a = char?.attributes || {}; const inst = char?.instincts || {}; const traits = char?.traits || [];
  let evade = (a.agi || 25) + (inst.flee || 0) * 2 + (inst.stealth || 0);
  if (traits.includes('飞毛腿')) evade += 15;
  if (traits.includes('尖刺')) evade += 20;
  if (traits.includes('夜视') && ctx.night) evade += 10;
  const pred = ctx.night ? '猫头鹰' : (rng() < 0.5 ? '狐狸' : '黄鼬');
  const roll = Math.floor(rng() * 100) + 1;
  if (roll <= evade) return { event: `一头${pred}从暗处扑出！你拼命逃窜，堪堪甩开了它。` };
  return { death: `被${pred}吃掉`, event: `一头${pred}从暗处扑出——这一次，你没能逃掉。` };
}

export function resolveAction(char: any, kind: ActionKind, ctx: Ctx, rng: () => number = Math.random): Outcome {
  const a = char?.attributes || {}; const inst = char?.instincts || {}; const diet = char?.diet;
  const events: string[] = [];
  let hungerDelta = 0;

  if (kind === 'move') {
    hungerDelta = 4; // 赶路消耗体力
    events.push(`你迁徙到了${locOf(ctx.target || ctx.location).zh}。`);
    const pr = tryPredation(char, { ...ctx, location: ctx.location }, rng);
    if (pr.event) events.push(pr.event);
    return { hungerDelta, events, death: pr.death, moveTo: ctx.target };
  }

  if (kind === 'forage') {
    const skill = (a.sen || 25) + (inst.forage || 0) * 2;
    const ok = Math.floor(rng() * 100) + 1 <= skill;
    const loc = locOf(ctx.location); const sf = seasonFactor(ctx.season); const dietF = diet === 'carnivore' ? 0.4 : 1.0;
    const base = 30 * loc.food * sf * dietF;
    hungerDelta = -Math.round(ok ? base : base * 0.3);
    events.push(ok ? (ctx.season === '冬' ? '你在枯草下刨出一点吃的，聊胜于无。' : '你找到了能吃的东西，肚子舒服了些。') : '翻找了半天，几乎一无所获。');
  } else if (kind === 'hunt') {
    const nightBonus = ctx.night && (char?.traits || []).includes('夜视') ? 15 : 0;
    const skill = (a.agi || 25) + (inst.hunt || 0) * 2 - (diet === 'herbivore' ? 40 : 0) + nightBonus;
    const ok = Math.floor(rng() * 100) + 1 <= skill;
    hungerDelta = ok ? -45 : -2;
    events.push(ok ? '你扑倒了猎物，饱餐一顿。' : '猎物机警地逃走了，你扑了个空。');
  } else {
    hungerDelta = 0;
    events.push('你蜷进隐蔽处打了个盹，警觉地竖着耳朵。');
  }

  const pr = tryPredation(char, ctx, rng);
  if (pr.event) events.push(pr.event);
  return { hungerDelta, events, death: pr.death };
}

// 玩家不在时的自动行为策略（按性格 + 饥饿，纯确定性）。
export function autoPolicy(char: any, hunger: number): ActionKind {
  const diet = char?.diet; const p = char?.personality || {};
  if (hunger >= 55) return diet === 'carnivore' ? 'hunt' : 'forage';
  const aggressive = (p.fierce || 0) + (p.brave || 0);
  if (aggressive >= 3 && diet !== 'herbivore') return 'hunt';
  if ((p.calm || 0) - Math.max(0, p.curious || 0) >= 1) return 'rest';
  return 'forage';
}
