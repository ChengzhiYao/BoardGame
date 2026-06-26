// 童话草原 · 物种数据（17 种 · 各带亚种 variants · 出生掷亚种与性别）。
export type Diet = 'carnivore' | 'herbivore' | 'omnivore';
export type Attr = 'vit' | 'str' | 'agi' | 'sen' | 'wit' | 'cha' | 'luck';
export type Inst = 'hunt' | 'forage' | 'stealth' | 'flee' | 'social' | 'build';

export interface Species {
  key: string; zh: string; en: string; emoji: string;
  diet: Diet; rarity: number;
  attr: Partial<Record<Attr, number>>;
  inst: Partial<Record<Inst, number>>;
  innate: string[];
  variants: string[]; // 亚种/品种（出生随机掷一个，作为称呼）
}

export const ATTR_ZH: Record<Attr, string> = { vit: '体力', str: '力量', agi: '敏捷', sen: '感官', wit: '机敏', cha: '魅力', luck: '运' };
export const INST_ZH: Record<Inst, string> = { hunt: '狩猎', forage: '觅食', stealth: '潜行', flee: '逃逸', social: '社交', build: '营造' };
export const DIET_ZH: Record<Diet, string> = { carnivore: '肉食 · 猎手', herbivore: '草食 · 猎物', omnivore: '杂食' };

export const SPECIES: Species[] = [
  // ——— 草食 · 猎物 ———
  { key: 'rabbit', zh: '兔', en: 'Rabbit', emoji: '🐇', diet: 'herbivore', rarity: 19, attr: { agi: 8, sen: 5, vit: -2 }, inst: { flee: 4, social: 3 }, innate: ['掘洞'], variants: ['草兔', '家兔', '雪兔'] },
  { key: 'mouse', zh: '鼠', en: 'Mouse', emoji: '🐁', diet: 'herbivore', rarity: 12, attr: { agi: 6, wit: 5, str: -4, vit: -3 }, inst: { stealth: 4, forage: 3 }, innate: [], variants: ['田鼠', '仓鼠', '姬鼠'] },
  { key: 'sheep', zh: '羊', en: 'Sheep', emoji: '🐑', diet: 'herbivore', rarity: 12, attr: { vit: 6, str: 3, agi: -2 }, inst: { forage: 3, social: 4 }, innate: ['厚毛'], variants: ['绵羊', '山羊', '盘羊'] },
  { key: 'squirrel', zh: '松鼠', en: 'Squirrel', emoji: '🐿️', diet: 'herbivore', rarity: 8, attr: { agi: 8, wit: 4, str: -2 }, inst: { build: 3, stealth: 2 }, innate: ['攀爬'], variants: ['红松鼠', '灰松鼠', '花鼠'] },
  { key: 'deer', zh: '鹿', en: 'Deer', emoji: '🦌', diet: 'herbivore', rarity: 6, attr: { vit: 6, str: 5, agi: 4, sen: 3 }, inst: { flee: 3, social: 2 }, innate: [], variants: ['梅花鹿', '狍', '麂'] },
  // ——— 杂食 ———
  { key: 'hedgehog', zh: '刺猬', en: 'Hedgehog', emoji: '🦔', diet: 'omnivore', rarity: 6, attr: { vit: 4, str: 2, agi: -3 }, inst: { forage: 2 }, innate: ['尖刺', '夜视'], variants: ['普通刺猬', '长耳刺猬'] },
  { key: 'badger', zh: '獾', en: 'Badger', emoji: '🦡', diet: 'omnivore', rarity: 5, attr: { str: 7, vit: 6, agi: -2 }, inst: { build: 3, forage: 2 }, innate: ['掘洞'], variants: ['狗獾', '猪獾'] },
  { key: 'crow', zh: '鸦', en: 'Crow', emoji: '🐦', diet: 'omnivore', rarity: 5, attr: { wit: 7, sen: 4 }, inst: { social: 3, forage: 2 }, innate: ['翅膀'], variants: ['寒鸦', '秃鼻乌鸦', '渡鸦'] },
  { key: 'boar', zh: '野猪', en: 'Boar', emoji: '🐗', diet: 'omnivore', rarity: 4, attr: { str: 8, vit: 7, agi: -3 }, inst: { forage: 3, build: 1 }, innate: ['獠牙'], variants: ['野猪', '疣猪'] },
  // ——— 肉食 · 猎手 ———
  { key: 'fox', zh: '狐', en: 'Fox', emoji: '🦊', diet: 'carnivore', rarity: 7, attr: { wit: 6, agi: 5, cha: 3 }, inst: { hunt: 4, stealth: 3 }, innate: [], variants: ['赤狐', '银狐', '沙狐'] },
  { key: 'weasel', zh: '鼬', en: 'Weasel', emoji: '🦦', diet: 'carnivore', rarity: 3, attr: { agi: 6, str: 4, vit: -2 }, inst: { hunt: 4, stealth: 2 }, innate: ['掘洞'], variants: ['黄鼬', '白鼬', '伶鼬'] },
  { key: 'owl', zh: '鸮', en: 'Owl', emoji: '🦉', diet: 'carnivore', rarity: 3, attr: { sen: 7, str: 4 }, inst: { hunt: 4 }, innate: ['翅膀', '夜视'], variants: ['仓鸮', '雕鸮', '小鸮'] },
  { key: 'hawk', zh: '鹰', en: 'Hawk', emoji: '🦅', diet: 'carnivore', rarity: 3, attr: { sen: 6, agi: 5, str: 4 }, inst: { hunt: 4, stealth: 1 }, innate: ['翅膀'], variants: ['苍鹰', '雀鹰', '红隼'] },
  { key: 'snake', zh: '蛇', en: 'Snake', emoji: '🐍', diet: 'carnivore', rarity: 2, attr: { agi: 4, sen: 5, str: 2 }, inst: { hunt: 3, stealth: 4 }, innate: ['毒牙'], variants: ['草蛇', '蝮蛇', '乌梢蛇'] },
  { key: 'wolf', zh: '狼', en: 'Wolf', emoji: '🐺', diet: 'carnivore', rarity: 6, attr: { str: 7, agi: 5, vit: 5, sen: 4 }, inst: { hunt: 5, social: 3 }, innate: ['群猎'], variants: ['灰狼', '草原狼', '黑狼'] },
  { key: 'lion', zh: '狮', en: 'Lion', emoji: '🦁', diet: 'carnivore', rarity: 1, attr: { str: 12, vit: 10, cha: 5, agi: 3 }, inst: { hunt: 5, social: 2 }, innate: ['百兽之王'], variants: ['草原狮', '黑鬃狮'] },
  { key: 'tiger', zh: '虎', en: 'Tiger', emoji: '🐅', diet: 'carnivore', rarity: 1, attr: { str: 12, agi: 8, vit: 8, sen: 5 }, inst: { hunt: 6, stealth: 4 }, innate: ['独行霸主'], variants: ['孟虎', '雪虎'] },
];

export const SP_BY_KEY: Record<string, Species> = Object.fromEntries(SPECIES.map((s) => [s.key, s]));
export const GENDER_ZH: Record<string, string> = { male: '公', female: '母' };
