// CoC 7e 建卡：属性掷骰 + 派生数值。
function roll(n: number, sides: number) {
  let s = 0;
  for (let i = 0; i < n; i++) s += Math.floor(Math.random() * sides) + 1;
  return s;
}

export interface Attributes {
  str: number; con: number; dex: number; app: number; pow: number;
  int_attr: number; siz: number; edu: number; luck: number;
}

export function rollAttributes(): Attributes {
  return {
    str: roll(3, 6) * 5,
    con: roll(3, 6) * 5,
    dex: roll(3, 6) * 5,
    app: roll(3, 6) * 5,
    pow: roll(3, 6) * 5,
    int_attr: (roll(2, 6) + 6) * 5,
    siz: (roll(2, 6) + 6) * 5,
    edu: (roll(2, 6) + 6) * 5,
    luck: roll(3, 6) * 5,
  };
}

export function damageBonus(strPlusSiz: number): { db: string; build: number } {
  if (strPlusSiz <= 64) return { db: '-2', build: -2 };
  if (strPlusSiz <= 84) return { db: '-1', build: -1 };
  if (strPlusSiz <= 124) return { db: '0', build: 0 };
  if (strPlusSiz <= 164) return { db: '+1d4', build: 1 };
  if (strPlusSiz <= 204) return { db: '+1d6', build: 2 };
  if (strPlusSiz <= 284) return { db: '+2d6', build: 3 };
  return { db: '+3d6', build: 4 };
}

export function movRate(a: Attributes): number {
  if (a.dex < a.siz && a.str < a.siz) return 7;
  if (a.str >= a.siz && a.dex >= a.siz) return 9;
  return 8;
}

export interface Derived {
  hp_max: number; hp_current: number;
  san_max: number; san_current: number; san_start: number;
  luck: number; mov: number; db: string; build: number;
}

export function derive(a: Attributes): Derived {
  const hp_max = Math.floor((a.con + a.siz) / 10);
  const { db, build } = damageBonus(a.str + a.siz);
  return {
    hp_max,
    hp_current: hp_max,
    san_max: 99,
    san_current: a.pow,
    san_start: a.pow,
    luck: a.luck,
    mov: movRate(a),
    db,
    build,
  };
}

// 建卡完整性校验：核心字段齐全才算完成
export function validateCharacter(c: any): boolean {
  const textOk = ['name', 'occupation', 'background', 'personality', 'personal_goal', 'fear'].every(
    (k) => c[k] && String(c[k]).trim().length > 0
  );
  const ageOk = Number(c.age) > 0;
  const attrOk = ['str', 'con', 'dex', 'app', 'pow', 'int_attr', 'siz', 'edu'].every(
    (k) => Number(c[k]) > 0
  );
  return textOk && ageOk && attrOk;
}
