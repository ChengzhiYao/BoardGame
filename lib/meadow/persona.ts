// 童话草原 · 22 题人格测试 + 确定性算分 + 掷物种（纯函数，可单测）。
import { SPECIES, SP_BY_KEY, type Attr, type Inst, type Diet } from './data';

export type Axis = 'brave' | 'curious' | 'social' | 'fierce' | 'altru' | 'calm' | 'wild';
// 每轴 [正极, 负极]：正极=加分方向
export const AXIS_POLES: Record<Axis, [string, string]> = {
  brave: ['勇敢', '胆怯'], curious: ['好奇', '谨慎'], social: ['合群', '独居'],
  fierce: ['凶猛', '温和'], altru: ['利他', '利己'], calm: ['沉稳', '急躁'], wild: ['野性', '守序'],
};

export interface Opt {
  zh: string;
  a?: Partial<Record<Attr, number>>;
  i?: Partial<Record<Inst, number>>;
  p?: Partial<Record<Axis, number>>;
  meat?: number; grass?: number;
  sp?: Record<string, number>;
  trait?: string;
}
export interface Q { zh: string; opts: Opt[]; }

export const QUESTIONS: Q[] = [
  { zh: '草丛深处传来你听不懂的窸窣声，你？', opts: [
    { zh: '立刻扑过去看', p: { brave: 2, curious: 1, fierce: 1 }, i: { hunt: 1 }, meat: 1, sp: { fox: 1, weasel: 1 } },
    { zh: '僵住、竖耳分辨方向', a: { sen: 2 }, p: { curious: -1 }, i: { flee: 1 }, grass: 1, sp: { rabbit: 1, deer: 1 } },
    { zh: '悄悄绕开不招惹', a: { agi: 1 }, p: { curious: -1, social: -1 }, i: { stealth: 1 }, sp: { hedgehog: 1, badger: 1 } },
    { zh: '喊一声问问是谁', a: { cha: 1 }, p: { social: 1 }, i: { social: 1 }, sp: { crow: 1, rabbit: 1 } },
  ] },
  { zh: '一小堆没人要的果子/种子，你会？', opts: [
    { zh: '当场吃个精光', a: { vit: 1 }, p: { calm: -1, altru: -1 }, i: { forage: 1 }, sp: { mouse: 1 } },
    { zh: '搬回去藏起来囤着', p: { calm: 1 }, i: { build: 2 }, sp: { squirrel: 1, badger: 1 }, trait: '储食癖' },
    { zh: '喊同伴一起来分', a: { cha: 1 }, p: { social: 2, altru: 2 }, i: { social: 1 }, sp: { rabbit: 1, deer: 1 } },
    { zh: '只拿够吃的，剩下留给别人', p: { fierce: -1, wild: -1, altru: 1 }, sp: { deer: 1 } },
  ] },
  { zh: '一只比你弱小的动物挡了路，你？', opts: [
    { zh: '凶它、赶走甚至扑上去', a: { str: 1 }, p: { fierce: 2 }, i: { hunt: 1 }, meat: 2, sp: { fox: 1, weasel: 1, owl: 1 } },
    { zh: '客气地请它让让', a: { cha: 1 }, p: { fierce: -2, wild: -1 }, i: { social: 1 }, grass: 1, sp: { rabbit: 1, deer: 1 } },
    { zh: '不声不响从旁绕过', a: { agi: 1 }, p: { social: -1, curious: -1 }, i: { stealth: 1 }, sp: { hedgehog: 1 } },
    { zh: '逗逗它、跟它玩', p: { curious: 1, social: 1 }, sp: { squirrel: 1, crow: 1 } },
  ] },
  { zh: '你最擅长、也最爱做的事是？', opts: [
    { zh: '追逐、扑咬、奔袭', a: { str: 1, agi: 1 }, p: { fierce: 1 }, i: { hunt: 2 }, meat: 1, sp: { fox: 1, weasel: 1 } },
    { zh: '嗅探、翻找好吃的', a: { sen: 1 }, i: { forage: 2 }, grass: 1, sp: { mouse: 1, badger: 1 } },
    { zh: '攀高、跳跃、藏东西', a: { agi: 2 }, i: { build: 1 }, sp: { squirrel: 1 } },
    { zh: '跟大家说说笑笑', a: { cha: 1 }, p: { social: 1 }, i: { social: 2 }, sp: { rabbit: 1, crow: 1 } },
  ] },
  { zh: '天黑了，大多动物回巢，你？', opts: [
    { zh: '正精神，黑夜才是我的主场', a: { sen: 1 }, p: { fierce: 1 }, i: { hunt: 1 }, sp: { owl: 1, hedgehog: 1 }, trait: '夜视' },
    { zh: '赶紧回到安全的窝', p: { curious: -2, wild: -1 }, i: { flee: 1 }, sp: { rabbit: 1, mouse: 1 } },
    { zh: '留在外面看星星发呆', p: { curious: 1, calm: 1, social: -1 }, sp: { deer: 1 } },
    { zh: '和同伴挤一起取暖', p: { social: 2, altru: 1 }, sp: { rabbit: 1, deer: 1 } },
  ] },
  { zh: '发现一处又安全又隐蔽的好地方，你会？', opts: [
    { zh: '占为己有，谁都不准来', p: { altru: -1, social: -1, wild: 1 }, sp: { fox: 1, weasel: 1 } },
    { zh: '挖深修好，住下来', p: { calm: 1 }, i: { build: 2 }, sp: { badger: 1, rabbit: 1 }, trait: '掘洞高手' },
    { zh: '告诉信得过的朋友', p: { altru: 1, social: 1 }, i: { social: 1 }, sp: { rabbit: 1 } },
    { zh: '记在心里，留作逃命退路', a: { wit: 1 }, p: { curious: -2 }, i: { flee: 1 }, sp: { mouse: 1 } },
  ] },
  { zh: '远处传来同伴的尖叫——危险！你？', opts: [
    { zh: '冲过去看能不能帮忙', p: { brave: 2, altru: 2 }, sp: { badger: 1, deer: 1 } },
    { zh: '第一时间撒腿就跑', a: { agi: 2 }, p: { brave: -1 }, i: { flee: 2 }, sp: { rabbit: 1, deer: 1 }, trait: '飞毛腿' },
    { zh: '原地僵住、压低身子', p: { curious: -1 }, i: { stealth: 1 }, sp: { mouse: 1, hedgehog: 1 } },
    { zh: '趁乱看有没有好处可捞', a: { wit: 1 }, p: { altru: -1, wild: 1 }, sp: { crow: 1, fox: 1 } },
  ] },
  { zh: '你饿极了，眼前只有一只受伤的小动物，你？', opts: [
    { zh: '毫不犹豫扑上去', p: { fierce: 2 }, i: { hunt: 2 }, meat: 2, sp: { weasel: 1, owl: 1, fox: 1 } },
    { zh: '下不去口，去别处找草籽', p: { fierce: -2, altru: 1 }, i: { forage: 1 }, grass: 2, sp: { rabbit: 1, deer: 1 } },
    { zh: '看情况，先饱肚子要紧', p: { calm: 1, altru: -1 }, sp: { badger: 1, crow: 1 } },
    { zh: '帮它包扎，也许能交个朋友', a: { cha: 1 }, p: { altru: 2 }, i: { social: 1 }, sp: { deer: 1 } },
  ] },
  { zh: '别的动物嘲笑、欺负你，你？', opts: [
    { zh: '龇牙低吼，绝不退让', a: { str: 1 }, p: { fierce: 1, brave: 1 }, sp: { badger: 1, weasel: 1 } },
    { zh: '忍气吞声，走开就是', p: { brave: -1, fierce: -1 }, i: { flee: 1 }, sp: { mouse: 1, rabbit: 1 } },
    { zh: '用机灵话把它说得没脾气', a: { wit: 2, cha: 1 }, i: { social: 1 }, sp: { fox: 1, crow: 1 } },
    { zh: '缩成一团护住自己', p: { curious: -1 }, i: { flee: 1 }, sp: { hedgehog: 1 }, trait: '尖刺' },
  ] },
  { zh: '一条没走过的小路通向草原边缘，你？', opts: [
    { zh: '好奇心爆棚，一定要去探', p: { curious: 2, brave: 1 }, sp: { squirrel: 1, crow: 1 } },
    { zh: '太危险，绝不冒险', p: { curious: -2, wild: -1 }, sp: { rabbit: 1, mouse: 1 } },
    { zh: '远远观察一阵再说', a: { sen: 1 }, p: { calm: 1 }, i: { stealth: 1 }, sp: { deer: 1, hedgehog: 1 } },
    { zh: '独自前往，不告诉任何人', p: { social: -2, wild: 1 }, sp: { fox: 1 } },
  ] },
  { zh: '巢里最暖和的位置，你？', opts: [
    { zh: '当仁不让，强者先得', a: { str: 1 }, p: { fierce: 1, altru: -1 }, sp: { badger: 1, weasel: 1 } },
    { zh: '让给老弱', p: { altru: 2, fierce: -1, wild: -1 }, sp: { deer: 1, rabbit: 1 } },
    { zh: '用点小手段争取到', a: { wit: 1 }, p: { altru: -1 }, sp: { fox: 1, crow: 1 } },
    { zh: '无所谓，哪儿都能睡', p: { calm: 2, social: -1 }, sp: { hedgehog: 1 } },
  ] },
  { zh: '暴雨突至，你？', opts: [
    { zh: '顶着雨继续做该做的事', a: { vit: 2 }, p: { calm: 1 }, sp: { badger: 1 } },
    { zh: '飞快找地方躲', a: { agi: 1 }, p: { curious: -1 }, i: { flee: 1 }, sp: { mouse: 1, squirrel: 1 } },
    { zh: '钻进自己修好的窝', p: { calm: 1 }, i: { build: 2 }, sp: { badger: 1, rabbit: 1 } },
    { zh: '在雨里撒欢玩水', p: { curious: 1, calm: -1, wild: 1 }, sp: { squirrel: 1 } },
  ] },
  { zh: '你看待"规矩"（兽群传统、长辈的话）？', opts: [
    { zh: '规矩是用来打破的', p: { wild: 2, curious: 1 }, sp: { fox: 1, crow: 1 } },
    { zh: '规矩让大家活下来，该守', p: { wild: -2, social: 1 }, sp: { rabbit: 1, deer: 1 } },
    { zh: '对我有利就守', a: { wit: 1 }, p: { altru: -1 }, sp: { crow: 1, weasel: 1 } },
    { zh: '我有自己的活法', p: { social: -1, calm: 1 }, sp: { hedgehog: 1, badger: 1 } },
  ] },
  { zh: '一群同类要推举带头的，大家看你，你？', opts: [
    { zh: '我来带！跟我走', a: { cha: 2 }, p: { brave: 1, social: 1 }, i: { social: 1 }, sp: { deer: 1, rabbit: 1 } },
    { zh: '推举更合适的，我帮衬', p: { wild: -1, altru: 1 }, i: { social: 1 }, sp: { rabbit: 1 } },
    { zh: '没兴趣，走自己的路', p: { social: -2 }, sp: { fox: 1, hedgehog: 1 } },
    { zh: '暗中观察谁最有用', a: { wit: 2 }, p: { altru: -1 }, i: { stealth: 1 }, sp: { crow: 1, fox: 1 } },
  ] },
  { zh: '危险逼近的一瞬，你的身体先做什么？', opts: [
    { zh: '绷紧、迎上去', a: { str: 1 }, p: { brave: 2, fierce: 1 }, sp: { badger: 1, weasel: 1 } },
    { zh: '瞬间弹射逃开', a: { agi: 2 }, i: { flee: 2 }, sp: { rabbit: 1, deer: 1 }, trait: '飞毛腿' },
    { zh: '一动不动、融进环境', a: { sen: 1 }, i: { stealth: 2 }, sp: { mouse: 1, hedgehog: 1 } },
    { zh: '莫名一个闪躲惊险避过', a: { luck: 2, agi: 1 }, sp: { squirrel: 1 }, trait: '好运' },
  ] },
  { zh: '你最受不了别人说你？', opts: [
    { zh: '胆小鬼', p: { brave: 2, fierce: 1 }, sp: { badger: 1, fox: 1 } },
    { zh: '笨蛋', a: { wit: 2 }, sp: { fox: 1, crow: 1 } },
    { zh: '没良心、白眼狼', p: { altru: 2, wild: -1 }, sp: { deer: 1, rabbit: 1 } },
    { zh: '一事无成的弱者', a: { str: 1 }, p: { wild: 1, fierce: 1 }, sp: { weasel: 1 } },
  ] },
  { zh: '吃东西时你？', opts: [
    { zh: '狼吞虎咽，越多越好', a: { vit: 1 }, p: { calm: -1, altru: -1 }, sp: { badger: 1, weasel: 1 }, trait: '大胃口' },
    { zh: '细嚼慢咽，警觉四周', a: { sen: 2 }, p: { calm: 1 }, sp: { deer: 1, rabbit: 1 } },
    { zh: '边吃边囤一部分', a: { wit: 1 }, i: { build: 1 }, sp: { squirrel: 1 }, trait: '储食癖' },
    { zh: '先让幼崽和同伴吃', p: { altru: 2, fierce: -1 }, sp: { deer: 1 } },
  ] },
  { zh: '有机会去一个陌生远方，你？', opts: [
    { zh: '出发！未知最迷人', p: { curious: 2, brave: 1, wild: 1 }, sp: { crow: 1, fox: 1 } },
    { zh: '留在熟悉草原最安心', p: { curious: -1, wild: -1, social: 1 }, sp: { rabbit: 1, mouse: 1 } },
    { zh: '先打听清楚再决定', a: { wit: 1 }, p: { calm: 1 }, i: { social: 1 }, sp: { crow: 1 } },
    { zh: '独自悄悄去，不惊动谁', p: { social: -2 }, i: { stealth: 1 }, sp: { fox: 1, hedgehog: 1 } },
  ] },
  { zh: '同伴背叛、出卖了你，你？', opts: [
    { zh: '加倍讨回来，绝不饶', p: { fierce: 2, wild: 1 }, i: { hunt: 1 }, meat: 1, sp: { weasel: 1, fox: 1 } },
    { zh: '从此远着它，不再来往', p: { curious: -1, social: -1 }, sp: { hedgehog: 1, badger: 1 } },
    { zh: '想弄明白它为何这么做', a: { wit: 1 }, p: { fierce: -1, calm: 1 }, sp: { deer: 1 } },
    { zh: '设个法子让它自食其果', a: { wit: 2 }, p: { altru: -1, wild: 1 }, sp: { fox: 1, crow: 1 } },
  ] },
  { zh: '你梦里最常出现的画面？', opts: [
    { zh: '一场酣畅淋漓的追猎', a: { str: 1 }, p: { fierce: 1 }, i: { hunt: 2 }, meat: 1, sp: { fox: 1, owl: 1 } },
    { zh: '吃不完的青草和阳光', p: { fierce: -1, calm: 1 }, i: { forage: 1 }, grass: 1, sp: { rabbit: 1, deer: 1 } },
    { zh: '一大家子热热闹闹', p: { social: 2, altru: 1 }, sp: { rabbit: 1, deer: 1 } },
    { zh: '飞起来俯瞰整片草原', a: { wit: 1 }, p: { curious: 1 }, sp: { crow: 1, owl: 1 }, trait: '翅膀' },
  ] },
  { zh: '又高又险但有宝贝的地方，你？', opts: [
    { zh: '凭力气硬闯上去', a: { str: 2, vit: 1 }, p: { brave: 1 }, sp: { badger: 1 } },
    { zh: '灵巧攀爬、寻路而上', a: { agi: 2, wit: 1 }, sp: { squirrel: 1 } },
    { zh: '算了，不值得冒命', p: { curious: -2 }, i: { flee: 1 }, sp: { rabbit: 1, mouse: 1 } },
    { zh: '等别人上去，再想办法', a: { wit: 1 }, p: { altru: -1 }, sp: { crow: 1, fox: 1 } },
  ] },
  { zh: '如果你早晚会被吃掉或老死，你想怎样活这一生？', opts: [
    { zh: '做最强的猎手，让谁都怕我', a: { str: 1 }, p: { fierce: 2, brave: 1 }, i: { hunt: 1 }, meat: 2, sp: { fox: 1, weasel: 1, owl: 1 } },
    { zh: '平平安安，看儿孙满草原', p: { fierce: -1, altru: 1, social: 1 }, i: { build: 1 }, grass: 1, sp: { rabbit: 1, deer: 1 }, trait: '多子' },
    { zh: '走遍每个角落，看尽奇景', p: { curious: 2, wild: 1 }, sp: { crow: 1, squirrel: 1 } },
    { zh: '守护好我在乎的人', p: { altru: 2, brave: 1, wild: -1 }, sp: { badger: 1, deer: 1 } },
  ] },
];

export interface MeadowResult {
  attributes: Record<Attr, number>;
  instincts: Record<Inst, number>;
  personality: Record<Axis, number>;
  diet: Diet;
  speciesKey: string;
  variant: string;
  gender: string;
  traits: string[];
}

function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, Math.round(v))); }

// answers[i] = 选项下标 0..3，或 null（跳过 → 命运随机抽一项）
export function scoreTest(answers: (number | null)[], rng: () => number = Math.random): MeadowResult {
  const a: Record<Attr, number> = { vit: 0, str: 0, agi: 0, sen: 0, wit: 0, cha: 0, luck: 0 };
  const inst: Record<Inst, number> = { hunt: 0, forage: 0, stealth: 0, flee: 0, social: 0, build: 0 };
  const p: Record<Axis, number> = { brave: 0, curious: 0, social: 0, fierce: 0, altru: 0, calm: 0, wild: 0 };
  let meat = 0, grass = 0;
  const spAff: Record<string, number> = {};
  const tok: Record<string, number> = {};

  QUESTIONS.forEach((q, qi) => {
    let idx = answers[qi];
    if (idx === null || idx === undefined || idx < 0 || idx >= q.opts.length) idx = Math.floor(rng() * q.opts.length);
    const o = q.opts[idx];
    if (o.a) for (const k of Object.keys(o.a) as Attr[]) a[k] += o.a[k] || 0;
    if (o.i) for (const k of Object.keys(o.i) as Inst[]) inst[k] += o.i[k] || 0;
    if (o.p) for (const k of Object.keys(o.p) as Axis[]) p[k] += o.p[k] || 0;
    meat += o.meat || 0; grass += o.grass || 0;
    if (o.sp) for (const k of Object.keys(o.sp)) spAff[k] = (spAff[k] || 0) + (o.sp[k] || 0);
    if (o.trait) tok[o.trait] = (tok[o.trait] || 0) + 1;
  });

  // 食性总分注入对应食性的物种亲和
  for (const s of SPECIES) {
    if (s.diet === 'carnivore') spAff[s.key] = (spAff[s.key] || 0) + meat;
    if (s.diet === 'herbivore') spAff[s.key] = (spAff[s.key] || 0) + grass;
  }

  // 加权随机掷物种（肉食物种系数/封顶更高，凶猛作答更易成猎手）
  const weights = SPECIES.map((s) => {
    const aff = spAff[s.key] || 0;
    const carn = s.diet === 'carnivore';
    const mult = Math.min(carn ? 6 : 2.5, 1 + (carn ? 0.18 : 0.1) * aff);
    return Math.max(0.01, s.rarity * mult);
  });
  const total = weights.reduce((x, y) => x + y, 0);
  let roll = rng() * total;
  let pick = SPECIES[0];
  for (let k = 0; k < SPECIES.length; k++) { roll -= weights[k]; if (roll <= 0) { pick = SPECIES[k]; break; } }

  const attrs = {} as Record<Attr, number>;
  (Object.keys(a) as Attr[]).forEach((k) => { attrs[k] = clamp(25 + (pick.attr[k] || 0) + a[k] * 3, 5, 80); });
  const insts = {} as Record<Inst, number>;
  (Object.keys(inst) as Inst[]).forEach((k) => { insts[k] = Math.max(0, (pick.inst[k] || 0) + inst[k]); });

  const earned = Object.keys(tok).filter((t) => tok[t] >= 3).sort((x, y) => tok[y] - tok[x]).slice(0, 2);
  const traits = Array.from(new Set([...pick.innate, ...earned]));

  const variant = pick.variants.length ? pick.variants[Math.floor(rng() * pick.variants.length)] : pick.zh;
  const gender = rng() < 0.5 ? 'male' : 'female';
  return { attributes: attrs, instincts: insts, personality: p, diet: pick.diet, speciesKey: pick.key, variant, gender, traits };
}

export { SP_BY_KEY };
