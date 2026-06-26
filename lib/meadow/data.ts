// 童话草原 · 物种数据（10 种 · 稀有度/食性/属性本能修正/天生特性）。
export type Diet = 'carnivore' | 'herbivore' | 'omnivore';
export type Attr = 'vit' | 'str' | 'agi' | 'sen' | 'wit' | 'cha' | 'luck';
export type Inst = 'hunt' | 'forage' | 'stealth' | 'flee' | 'social' | 'build';

export interface Species {
  key: string; zh: string; en: string; emoji: string;
  diet: Diet; rarity: number;
  attr: Partial<Record<Attr, number>>;
  inst: Partial<Record<Inst, number>>;
  innate: string[];
}

export const ATTR_ZH: Record<Attr, string> = { vit: '体力', str: '力量', agi: '敏捷', sen: '感官', wit: '机敏', cha: '魅力', luck: '运' };
export const INST_ZH: Record<Inst, string> = { hunt: '狩猎', forage: '觅食', stealth: '潜行', flee: '逃逸', social: '社交', build: '营造' };
export const DIET_ZH: Record<Diet, string> = { carnivore: '肉食 · 猎手', herbivore: '草食 · 猎物', omnivore: '杂食' };

export const SPECIES: Species[] = [
  { key: 'rabbit', zh: '兔', en: 'Rabbit', emoji: '🐇', diet: 'herbivore', rarity: 24, attr: { agi: 8, sen: 5, vit: -2 }, inst: { flee: 4, social: 3 }, innate: ['掘洞'] },
  { key: 'mouse', zh: '田鼠', en: 'Mouse', emoji: '🐁', diet: 'herbivore', rarity: 17, attr: { agi: 6, wit: 5, str: -4, vit: -3 }, inst: { stealth: 4, forage: 3 }, innate: [] },
  { key: 'squirrel', zh: '松鼠', en: 'Squirrel', emoji: '🐿️', diet: 'herbivore', rarity: 11, attr: { agi: 8, wit: 4, str: -2 }, inst: { build: 3, stealth: 2 }, innate: ['攀爬'] },
  { key: 'fawn', zh: '小鹿', en: 'Fawn', emoji: '🦌', diet: 'herbivore', rarity: 7, attr: { vit: 6, str: 5, agi: 4, sen: 3 }, inst: { flee: 3, social: 2 }, innate: [] },
  { key: 'hedgehog', zh: '刺猬', en: 'Hedgehog', emoji: '🦔', diet: 'omnivore', rarity: 8, attr: { vit: 4, str: 2, agi: -3 }, inst: { forage: 2 }, innate: ['尖刺', '夜视'] },
  { key: 'badger', zh: '獾', en: 'Badger', emoji: '🦡', diet: 'omnivore', rarity: 7, attr: { str: 7, vit: 6, agi: -2 }, inst: { build: 3, forage: 2 }, innate: ['掘洞'] },
  { key: 'crow', zh: '乌鸦', en: 'Crow', emoji: '🐦', diet: 'omnivore', rarity: 7, attr: { wit: 7, sen: 4 }, inst: { social: 3, forage: 2 }, innate: ['翅膀'] },
  { key: 'fox', zh: '狐', en: 'Fox', emoji: '🦊', diet: 'carnivore', rarity: 11, attr: { wit: 6, agi: 5, cha: 3 }, inst: { hunt: 4, stealth: 3 }, innate: [] },
  { key: 'weasel', zh: '鼬', en: 'Weasel', emoji: '🦦', diet: 'carnivore', rarity: 4, attr: { agi: 6, str: 4, vit: -2 }, inst: { hunt: 4, stealth: 2 }, innate: ['掘洞'] },
  { key: 'owl', zh: '猫头鹰', en: 'Owl', emoji: '🦉', diet: 'carnivore', rarity: 4, attr: { sen: 7, str: 4 }, inst: { hunt: 4 }, innate: ['翅膀', '夜视'] },
];

export const SP_BY_KEY: Record<string, Species> = Object.fromEntries(SPECIES.map((s) => [s.key, s]));
