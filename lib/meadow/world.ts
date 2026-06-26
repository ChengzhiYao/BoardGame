// 童话草原 · 世界逻辑：地点、行动、确定性结算（纯函数）。
export type ActionKind = 'forage' | 'hunt' | 'rest';

export const LOCATIONS: { key: string; zh: string }[] = [
  { key: 'meadow', zh: '开阔草场' },
  { key: 'warren', zh: '兔窟地洞' },
  { key: 'oak', zh: '橡树林缘' },
  { key: 'pond', zh: '芦苇池塘' },
];

export const ACTIONS: Record<ActionKind, { zh: string; baseSec: number; desc: string }> = {
  forage: { zh: '觅食', baseSec: 180, desc: '在草叶与泥土间翻找吃的' },
  hunt: { zh: '捕猎', baseSec: 240, desc: '潜近并扑倒一只猎物' },
  rest: { zh: '休息躲藏', baseSec: 120, desc: '蜷进隐蔽处，警觉地歇一会儿' },
};

export function actionDuration(char: any, kind: ActionKind): number {
  const inst = char?.instincts || {};
  const speed = kind === 'forage' ? (inst.forage || 0) : kind === 'hunt' ? (inst.hunt || 0) : 0;
  return Math.round(ACTIONS[kind].baseSec * (1 - Math.min(0.5, speed * 0.03)));
}

export interface ActionOutcome { hungerDelta: number; events: string[]; }
// hungerDelta < 0 表示吃饱了一些（饥饿下降）
export function resolveAction(char: any, kind: ActionKind, rng: () => number = Math.random): ActionOutcome {
  const a = char?.attributes || {}; const inst = char?.instincts || {}; const diet = char?.diet;
  const roll = Math.floor(rng() * 100) + 1;
  const events: string[] = [];
  let hungerDelta = 0;

  if (kind === 'forage') {
    const skill = (a.sen || 25) + (inst.forage || 0) * 2;
    const ok = roll <= skill;
    const base = diet === 'carnivore' ? 10 : 30; // 肉食觅食收益低
    hungerDelta = ok ? -base : -Math.round(base * 0.3);
    events.push(ok ? '你在草叶间找到了能吃的东西，肚子舒服了些。' : '翻找了半天，只够塞牙缝。');
    if (rng() < 0.12) events.push('一道影子掠过草梢，你心头一紧——还好它没注意到你。');
  } else if (kind === 'hunt') {
    const skill = (a.agi || 25) + (inst.hunt || 0) * 2 - (diet === 'herbivore' ? 40 : 0);
    const ok = roll <= skill;
    hungerDelta = ok ? -45 : -2;
    events.push(ok ? '你扑倒了猎物，饱餐一顿。' : '猎物机警地逃走了，你扑了个空。');
  } else {
    hungerDelta = 0;
    events.push('你蜷进隐蔽处打了个盹，警觉地竖着耳朵。');
  }
  return { hungerDelta, events };
}

export function locZh(key: string): string {
  return LOCATIONS.find((l) => l.key === key)?.zh || key;
}
