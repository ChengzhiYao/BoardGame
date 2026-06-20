// 龙与地下城（D&D 5e-lite）确定性规则引擎。所有数值机制都在这里算，AI 只负责叙事与生成怪物数值。
// 设计同 MCC：纯函数 + 整份 state，路由用乐观锁串行写回。

export type Ability = 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha';
export const ABILITIES: Ability[] = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
export const ABILITY_CN: Record<Ability, string> = { str: '力量', dex: '敏捷', con: '体质', int: '智力', wis: '感知', cha: '魅力' };

export type Scores = Record<Ability, number>;

export const SKILLS: Record<string, { ability: Ability; cn: string }> = {
  acrobatics: { ability: 'dex', cn: '杂技' }, animal: { ability: 'wis', cn: '驯兽' }, arcana: { ability: 'int', cn: '奥秘' },
  athletics: { ability: 'str', cn: '运动' }, deception: { ability: 'cha', cn: '欺瞒' }, history: { ability: 'int', cn: '历史' },
  insight: { ability: 'wis', cn: '洞悉' }, intimidation: { ability: 'cha', cn: '威吓' }, investigation: { ability: 'int', cn: '调查' },
  medicine: { ability: 'wis', cn: '医药' }, nature: { ability: 'int', cn: '自然' }, perception: { ability: 'wis', cn: '察觉' },
  performance: { ability: 'cha', cn: '表演' }, persuasion: { ability: 'cha', cn: '游说' }, religion: { ability: 'int', cn: '宗教' },
  sleight: { ability: 'dex', cn: '巧手' }, stealth: { ability: 'dex', cn: '隐匿' }, survival: { ability: 'wis', cn: '生存' },
};

export const RACES: Record<string, { cn: string; mods: Partial<Scores>; speed: number; traits: string }> = {
  human: { cn: '人类', mods: { str: 1, dex: 1, con: 1, int: 1, wis: 1, cha: 1 }, speed: 30, traits: '通用、适应力强' },
  elf: { cn: '精灵', mods: { dex: 2, int: 1 }, speed: 30, traits: '黑暗视觉、敏锐感官、魅惑免疫' },
  dwarf: { cn: '矮人', mods: { con: 2, str: 1 }, speed: 25, traits: '黑暗视觉、毒素抗性、坚韧' },
  halfling: { cn: '半身人', mods: { dex: 2, cha: 1 }, speed: 25, traits: '幸运、勇敢、灵活' },
  halforc: { cn: '半兽人', mods: { str: 2, con: 1 }, speed: 30, traits: '黑暗视觉、不屈、凶蛮攻击' },
  tiefling: { cn: '提夫林', mods: { cha: 2, int: 1 }, speed: 30, traits: '黑暗视觉、火焰抗性、地狱血脉' },
};

type ClassDef = {
  cn: string; hd: number; primary: Ability; saves: Ability[]; skillCount: number; skillList: string[];
  caster?: 'full' | 'half' | 'none'; castAbility?: Ability;
  startAttacks: { name: string; ability: Ability; damage: string; type: string }[];
  cantrips?: { name: string; ability: Ability; damage: string; type: string; save?: Ability }[];
  features: string;
};

export const CLASSES: Record<string, ClassDef> = {
  fighter: { cn: '战士', hd: 10, primary: 'str', saves: ['str', 'con'], skillCount: 2, skillList: ['athletics', 'intimidation', 'perception', 'survival', 'history', 'insight'], caster: 'none',
    startAttacks: [{ name: '长剑', ability: 'str', damage: '1d8', type: '挥砍' }, { name: '重弩', ability: 'dex', damage: '1d10', type: '穿刺' }], features: '战斗风格、二次呼吸、第3级行动如潮' },
  rogue: { cn: '游荡者', hd: 8, primary: 'dex', saves: ['dex', 'int'], skillCount: 4, skillList: ['acrobatics', 'stealth', 'sleight', 'deception', 'perception', 'investigation', 'persuasion', 'insight'], caster: 'none',
    startAttacks: [{ name: '短剑', ability: 'dex', damage: '1d6', type: '穿刺' }, { name: '短弓', ability: 'dex', damage: '1d6', type: '穿刺' }], features: '偷袭（额外1d6）、熟练专精、第2级灵巧行动' },
  wizard: { cn: '法师', hd: 6, primary: 'int', saves: ['int', 'wis'], skillCount: 2, skillList: ['arcana', 'history', 'investigation', 'medicine', 'religion', 'insight'], caster: 'full', castAbility: 'int',
    startAttacks: [{ name: '法杖', ability: 'str', damage: '1d6', type: '钝击' }], cantrips: [{ name: '火焰箭', ability: 'int', damage: '1d10', type: '火焰' }, { name: '冷冻射线', ability: 'int', damage: '1d8', type: '寒冷' }], features: '法术书、奥术回复' },
  cleric: { cn: '牧师', hd: 8, primary: 'wis', saves: ['wis', 'cha'], skillCount: 2, skillList: ['medicine', 'religion', 'insight', 'persuasion', 'history'], caster: 'full', castAbility: 'wis',
    startAttacks: [{ name: '硬头锤', ability: 'str', damage: '1d6', type: '钝击' }], cantrips: [{ name: '圣火术', ability: 'wis', damage: '1d8', type: '光耀', save: 'dex' }], features: '神术领域、引导神力' },
  ranger: { cn: '游侠', hd: 10, primary: 'dex', saves: ['str', 'dex'], skillCount: 3, skillList: ['animal', 'athletics', 'perception', 'stealth', 'survival', 'nature', 'investigation'], caster: 'half', castAbility: 'wis',
    startAttacks: [{ name: '长弓', ability: 'dex', damage: '1d8', type: '穿刺' }, { name: '双短剑', ability: 'dex', damage: '1d6', type: '穿刺' }], features: '宿敌、自然探索者' },
  barbarian: { cn: '野蛮人', hd: 12, primary: 'str', saves: ['str', 'con'], skillCount: 2, skillList: ['athletics', 'intimidation', 'perception', 'survival', 'animal', 'nature'], caster: 'none',
    startAttacks: [{ name: '巨斧', ability: 'str', damage: '1d12', type: '挥砍' }, { name: '手斧', ability: 'str', damage: '1d6', type: '挥砍' }], features: '狂暴（伤害+2、抗性）、不羁防御' },
};

export const BACKGROUNDS: Record<string, { cn: string; skills: string[] }> = {
  acolyte: { cn: '侍僧', skills: ['insight', 'religion'] }, soldier: { cn: '士兵', skills: ['athletics', 'intimidation'] },
  criminal: { cn: '罪犯', skills: ['deception', 'stealth'] }, sage: { cn: '学者', skills: ['arcana', 'history'] },
  folkhero: { cn: '平民英雄', skills: ['animal', 'survival'] }, noble: { cn: '贵族', skills: ['history', 'persuasion'] },
};

export const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8];

// ---------- 基础数学 ----------
export const mod = (score: number) => Math.floor((score - 10) / 2);
export const profBonus = (level: number) => 2 + Math.floor((Math.max(1, level) - 1) / 4);
export function rollDie(sides: number) { return 1 + Math.floor(Math.random() * sides); }
export function rollDice(expr: string): { total: number; rolls: number[]; mod: number } {
  // "2d6+3" / "1d8" / "1d10-1"
  const m = /^(\d+)d(\d+)([+-]\d+)?$/i.exec(expr.replace(/\s/g, ''));
  if (!m) return { total: 0, rolls: [], mod: 0 };
  const n = +m[1], s = +m[2], b = m[3] ? +m[3] : 0;
  const rolls = Array.from({ length: n }, () => rollDie(s));
  return { total: rolls.reduce((a, c) => a + c, 0) + b, rolls, mod: b };
}
export function d20(adv: 0 | 1 | -1 = 0): { roll: number; rolls: number[] } {
  const a = rollDie(20); if (adv === 0) return { roll: a, rolls: [a] };
  const b = rollDie(20); return { roll: adv === 1 ? Math.max(a, b) : Math.min(a, b), rolls: [a, b] };
}

// ---------- 类型 ----------
export type Attack = { name: string; ability: Ability; damage: string; type: string; save?: Ability };
export type Character = {
  seat: string; name: string; race: string; cls: string; background: string; level: number; xp: number;
  scores: Scores; hpMax: number; hp: number; tempHp: number; ac: number; speed: number;
  profBonus: number; skills: string[]; saveProf: Ability[]; attacks: Attack[]; cantrips: Attack[];
  spellSlots: Record<number, number>; spellSlotsMax: Record<number, number>; spellDc: number; spellAtk: number;
  baseAc: number; armorBonus: number; shield: boolean; avatar?: string;
  conditions: string[]; deathSaves: { ok: number; fail: number }; inspiration: boolean; gold: number; knownSpells: string[]; potions: number; rage?: boolean; secondWindUsed?: boolean; statuses?: { name: string; rounds: number }[]; alive: boolean;
};
export type Monster = { id: string; name: string; ac: number; hp: number; hpMax: number; attackBonus: number; damage: string; toHitName?: string; special?: string; conditions: string[]; statuses?: { name: string; rounds: number }[]; alive: boolean };
export type Combatant = { ref: string; init: number; isPlayer: boolean };
export type Combat = { active: boolean; round: number; order: Combatant[]; turnIdx: number; monsters: Monster[]; boss?: boolean; env?: string } | null;
export type LogEntry = { msg: string; kind?: string };
export type State = {
  phase: 'lobby' | 'creation' | 'explore' | 'combat' | 'ended';
  theme: string; scene: string; chars: Record<string, Character>; seats: string[];
  combat: Combat; log: LogEntry[]; logSeq: number; quest: string; xpAward: number;
};

function L(s: State, msg: string, kind?: string) { s.log.push({ msg, kind }); s.logSeq = (s.logSeq || 0) + 1; }

// ---------- 建卡 ----------
export function buildCharacter(opts: { seat: string; name: string; race: string; cls: string; background: string; baseScores: Scores; extraSkills?: string[] }): Character {
  const race = RACES[opts.race] || RACES.human;
  const cdef = CLASSES[opts.cls] || CLASSES.fighter;
  const bg = BACKGROUNDS[opts.background] || BACKGROUNDS.soldier;
  const scores: Scores = { ...opts.baseScores };
  for (const a of ABILITIES) scores[a] = (scores[a] || 8) + (race.mods[a] || 0);
  const level = 1; const pb = profBonus(level);
  const conMod = mod(scores.con);
  const hpMax = cdef.hd + conMod;
  const ac = 10 + mod(scores.dex); // 无甲基础；装备由 AI 叙事，简化
  const skills = Array.from(new Set([...(bg.skills || []), ...((opts.extraSkills && opts.extraSkills.length ? opts.extraSkills : cdef.skillList.slice(0, cdef.skillCount)))]));
  const castMod = cdef.castAbility ? mod(scores[cdef.castAbility]) : 0;
  const slots = casterSlots(cdef.caster || 'none', level);
  return {
    seat: opts.seat, name: opts.name, race: opts.race, cls: opts.cls, background: opts.background, level, xp: 0,
    scores, hpMax, hp: hpMax, tempHp: 0, ac, baseAc: ac, armorBonus: 0, shield: false, speed: race.speed, profBonus: pb,
    skills, saveProf: cdef.saves, attacks: cdef.startAttacks.map((a) => ({ ...a })), cantrips: (cdef.cantrips || []).map((a) => ({ ...a })),
    spellSlots: { ...slots }, spellSlotsMax: { ...slots }, spellDc: 8 + pb + castMod, spellAtk: pb + castMod,
    conditions: [], deathSaves: { ok: 0, fail: 0 }, inspiration: false, gold: 15,
    knownSpells: (cdef.caster && cdef.caster !== 'none') ? (CLASS_SPELLS[opts.cls] || []) : [], potions: 2, rage: false, secondWindUsed: false, statuses: [], alive: true,
  };
}

function casterSlots(caster: string, level: number): Record<number, number> {
  if (caster === 'none') return {};
  if (caster === 'full') { // 简化：法师/牧师按等级给 1 环位
    const t: Record<number, number> = {}; t[1] = level >= 1 ? 2 : 0; if (level >= 3) t[2] = 2; if (level >= 5) t[3] = 2; return t;
  }
  if (caster === 'half') { const t: Record<number, number> = {}; if (level >= 2) t[1] = 2; if (level >= 5) t[2] = 2; return t; }
  return {};
}

// ---------- 检定 ----------
export function abilityScore(c: Character, a: Ability) { return mod(c.scores[a]); }
export function skillCheck(c: Character, skill: string, dc: number, adv: 0 | 1 | -1 = 0) {
  const sk = SKILLS[skill]; const ability = sk?.ability || 'dex';
  const prof = c.skills.includes(skill) ? c.profBonus : 0;
  const r = d20(adv); const total = r.roll + mod(c.scores[ability]) + prof;
  return { roll: r.roll, rolls: r.rolls, bonus: mod(c.scores[ability]) + prof, total, dc, success: total >= dc, crit: r.roll === 20, fumble: r.roll === 1, ability, skillCn: sk?.cn || skill };
}
export function savingThrow(c: Character, a: Ability, dc: number, adv: 0 | 1 | -1 = 0) {
  const prof = c.saveProf.includes(a) ? c.profBonus : 0;
  const r = d20(adv); const total = r.roll + mod(c.scores[a]) + prof;
  return { roll: r.roll, total, bonus: mod(c.scores[a]) + prof, dc, success: total >= dc };
}

// ---------- 战斗 ----------
export function startCombat(s: State, monsters: Monster[], boss = false) {
  const order: Combatant[] = [];
  for (const seat of s.seats) { const c = s.chars[seat]; if (c && c.alive) { c.rage = false; c.statuses = []; order.push({ ref: seat, init: rollDie(20) + mod(c.scores.dex), isPlayer: true }); } }
  for (const m of monsters) { m.conditions = m.conditions || []; m.statuses = m.statuses || []; m.alive = m.hp > 0; order.push({ ref: m.id, init: rollDie(20) + (m.attackBonus >= 4 ? 2 : 1), isPlayer: false }); }
  order.sort((a, b) => b.init - a.init);
  s.combat = { active: true, round: 1, order, turnIdx: 0, monsters, boss: !!boss };
  s.phase = 'combat';
  L(s, `⚔️ ${boss ? '【BOSS战】' : ''}战斗开始！先攻顺序：${order.map((o) => refName(s, o.ref) + '(' + o.init + ')').join(' → ')}`, 'combat');
  processCurrent(s);
}

export function refName(s: State, ref: string): string {
  if (s.chars[ref]) return s.chars[ref].name;
  const m = s.combat?.monsters.find((x) => x.id === ref); return m ? m.name : ref;
}
function refAlive(s: State, ref: string): boolean {
  if (s.chars[ref]) return s.chars[ref].alive;
  const m = s.combat?.monsters.find((x) => x.id === ref); return !!m && m.alive;
}
export function currentActor(s: State): Combatant | null {
  if (!s.combat || !s.combat.active) return null; return s.combat.order[s.combat.turnIdx] || null;
}

export function playerAttack(s: State, seat: string, weaponIdx: number, targetId: string): { ok: boolean; error?: string } {
  if (!s.combat?.active) return { ok: false, error: '现在不是战斗' };
  const cur = currentActor(s); if (!cur || cur.ref !== seat) return { ok: false, error: '还没轮到你' };
  const c = s.chars[seat]; if (!c || !c.alive || c.hp <= 0) return { ok: false, error: '你无法行动' };
  const atk = c.attacks[weaponIdx] || c.attacks[0]; if (!atk) return { ok: false, error: '没有可用武器' };
  const m = s.combat.monsters.find((x) => x.id === targetId); if (!m || !m.alive) return { ok: false, error: '目标无效' };
  const bonus = mod(c.scores[atk.ability]) + c.profBonus;
  const dis: 0 | -1 = (hasStatus(c, '中毒') || hasStatus(c, '恐惧')) ? -1 : 0;
  const r = d20(dis); const hit = r.roll === 20 || (r.roll !== 1 && r.roll + bonus >= m.ac);
  if (!hit) { L(s, `🗡️ ${c.name} 用${atk.name}攻击 ${m.name}：d20(${r.roll})+${bonus}=${r.roll + bonus} vs AC${m.ac}${dis ? '（劣势）' : ''} —— 未命中。`, 'attack'); endTurn(s); return { ok: true }; }
  const dmg = rollDice(atk.damage); let total = dmg.total + mod(c.scores[atk.ability]); if (r.roll === 20) total += rollDice(atk.damage).total;
  let extra = '';
  if (c.cls === 'rogue') { const sd = Math.ceil(c.level / 2); let sa = 0; for (let i = 0; i < sd; i++) sa += rollDie(6); total += sa; extra += ` +偷袭${sa}`; }
  if (c.rage && atk.ability === 'str') { total += 2; extra += ' +狂暴2'; }
  total = Math.max(1, total); m.hp = Math.max(0, m.hp - total);
  L(s, `🗡️ ${c.name} 用${atk.name}${r.roll === 20 ? '【重击】' : ''}命中 ${m.name}，造成 ${total} 点${atk.type}伤害${extra}（${m.hp}/${m.hpMax}）。`, 'attack');
  if (m.hp <= 0) { m.alive = false; L(s, `💀 ${m.name} 倒下了！`, 'kill'); }
  endTurn(s); return { ok: true };
}

export function playerCastDamage(s: State, seat: string, cantripIdx: number, targetId: string): { ok: boolean; error?: string } {
  if (!s.combat?.active) return { ok: false, error: '现在不是战斗' };
  const cur = currentActor(s); if (!cur || cur.ref !== seat) return { ok: false, error: '还没轮到你' };
  const c = s.chars[seat]; if (!c || !c.alive) return { ok: false, error: '你无法行动' };
  const sp = c.cantrips[cantripIdx]; if (!sp) return { ok: false, error: '没有可用法术' };
  const m = s.combat.monsters.find((x) => x.id === targetId); if (!m || !m.alive) return { ok: false, error: '目标无效' };
  if (sp.save) { // 豁免类法术：怪物 dex 豁免，简化为 d20+2 vs spellDc
    const save = rollDie(20) + 2; const dmg = rollDice(sp.damage); const total = save >= c.spellDc ? Math.floor(dmg.total / 2) : dmg.total;
    m.hp = Math.max(0, m.hp - total); L(s, `✨ ${c.name} 施放${sp.name}，${m.name} 豁免(${save} vs DC${c.spellDc})${save >= c.spellDc ? '成功，半伤' : '失败'}，受 ${total} 点${sp.type}伤害（${m.hp}/${m.hpMax}）。`, 'spell');
  } else {
    const bonus = c.spellAtk; const r = d20(0); const hit = r.roll === 20 || (r.roll !== 1 && r.roll + bonus >= m.ac);
    if (!hit) { L(s, `✨ ${c.name} 的${sp.name}射偏了（${r.roll}+${bonus} vs AC${m.ac}）。`, 'spell'); endTurn(s); return { ok: true }; }
    let total = rollDice(sp.damage).total; if (r.roll === 20) total += rollDice(sp.damage).total; m.hp = Math.max(0, m.hp - total);
    L(s, `✨ ${c.name} 的${sp.name}${r.roll === 20 ? '【暴击】' : ''}击中 ${m.name}，${total} 点${sp.type}伤害（${m.hp}/${m.hpMax}）。`, 'spell');
  }
  if (m.hp <= 0) { m.alive = false; L(s, `💀 ${m.name} 倒下了！`, 'kill'); }
  endTurn(s); return { ok: true };
}

export function playerDodgeOrHelp(s: State, seat: string, _kind: string): { ok: boolean; error?: string } {
  const cur = currentActor(s); if (!cur || cur.ref !== seat) return { ok: false, error: '还没轮到你' };
  const c = s.chars[seat]; if (c) addStatus(c, '闪避', 1);
  L(s, `🛡️ ${c?.name} 进入防御姿态（攻击者劣势，直到你下个回合）。`, 'combat');
  endTurn(s); return { ok: true };
}

// ---------- 状态异常 ----------
function statusList(t: any): { name: string; rounds: number }[] { t.statuses = t.statuses || []; return t.statuses; }
function addStatus(t: any, name: string, rounds: number) { const l = statusList(t); const e = l.find((x) => x.name === name); if (e) e.rounds = Math.max(e.rounds, rounds); else l.push({ name, rounds }); }
function hasStatus(t: any, name: string): boolean { return statusList(t).some((x) => x.name === name); }

// 回合开始：结算中毒伤害/眩晕并递减状态。返回 'skip' 表示该回合被跳过。
function startTurnStatuses(s: State, ref: string): 'skip' | 'act' {
  const isChar = !!s.chars[ref];
  const t: any = isChar ? s.chars[ref] : s.combat?.monsters.find((x) => x.id === ref);
  if (!t) return 'act';
  const l = statusList(t); if (!l.length) return 'act';
  if (hasStatus(t, '中毒')) {
    const dmg = rollDie(4); t.hp = Math.max(0, t.hp - dmg);
    L(s, `🤢 ${t.name} 中毒，受到 ${dmg} 点毒素伤害（${t.hp}/${t.hpMax}）。`, 'attack');
    if (t.hp <= 0) { if (isChar) { t.conditions = Array.from(new Set([...(t.conditions || []), '倒地濒死'])); L(s, `🩸 ${t.name} 毒发倒地！`, 'down'); } else { t.alive = false; L(s, `💀 ${t.name} 毒发身亡！`, 'kill'); } }
  }
  const skip = hasStatus(t, '眩晕');
  if (skip) L(s, `💫 ${t.name} 处于眩晕，跳过这一回合。`, 'combat');
  t.statuses = l.map((x) => ({ name: x.name, rounds: x.rounds - 1 })).filter((x) => x.rounds > 0);
  return skip ? 'skip' : 'act';
}

function advanceIdx(s: State) { const cb = s.combat!; cb.turnIdx++; if (cb.turnIdx >= cb.order.length) { cb.turnIdx = 0; cb.round++; L(s, `—— 第 ${cb.round} 轮 ——`, 'combat'); } }

// 从当前行动者开始：跳过倒下/眩晕者，怪物自动行动，停在可行动的真人上。
function processCurrent(s: State): void {
  if (!s.combat?.active) return;
  for (let g = 0; g < 80; g++) {
    if (checkCombatEnd(s)) return;
    const actor = s.combat.order[s.combat.turnIdx];
    if (!actor || !refAlive(s, actor.ref)) { advanceIdx(s); continue; }
    const st = startTurnStatuses(s, actor.ref);
    if (checkCombatEnd(s)) return;
    if (st === 'skip') { advanceIdx(s); continue; }
    if (actor.isPlayer) return; // 等待真人输入
    monsterTurn(s, actor.ref);
    advanceIdx(s);
  }
}

export function endTurn(s: State): void { if (!s.combat?.active) return; advanceIdx(s); processCurrent(s); }

// 野蛮人狂暴 / 战士二次呼吸（附赠动作，不结束回合）
export function toggleRage(s: State, seat: string): { ok: boolean; error?: string } {
  const cur = currentActor(s); if (!cur || cur.ref !== seat) return { ok: false, error: '还没轮到你' };
  const c = s.chars[seat]; if (!c || c.cls !== 'barbarian') return { ok: false, error: '只有野蛮人能狂暴' };
  if (c.rage) return { ok: false, error: '已在狂暴中' };
  c.rage = true; L(s, `🪓 ${c.name} 进入狂暴！（近战伤害+2，受到伤害减半）`, 'combat'); return { ok: true };
}
export function secondWind(s: State, seat: string): { ok: boolean; error?: string } {
  const cur = currentActor(s); if (!cur || cur.ref !== seat) return { ok: false, error: '还没轮到你' };
  const c = s.chars[seat]; if (!c || c.cls !== 'fighter') return { ok: false, error: '只有战士能二次呼吸' };
  if (c.secondWindUsed) return { ok: false, error: '本次休整已用过' };
  const heal = rollDie(10) + c.level; c.secondWindUsed = true; c.hp = Math.min(c.hpMax, c.hp + heal);
  L(s, `💨 ${c.name} 二次呼吸，恢复 ${heal} 点（${c.hp}/${c.hpMax}）。`, 'rest'); return { ok: true };
}

function monsterTurn(s: State, id: string) {
  const cb = s.combat!; const m = cb.monsters.find((x) => x.id === id); if (!m || !m.alive) return;
  const targets = s.seats.map((seat) => s.chars[seat]).filter((c) => c && c.alive && c.hp > 0);
  if (!targets.length) return;
  const target = targets.sort((a, b) => a.hp - b.hp)[0]; // 咬最弱的
  const dadv: 0 | -1 = hasStatus(target, '闪避') ? -1 : 0;
  const r = d20(dadv); const hit = r.roll === 20 || (r.roll !== 1 && r.roll + m.attackBonus >= target.ac);
  if (!hit) { L(s, `👹 ${m.name} 攻击 ${target.name}：${r.roll}+${m.attackBonus} vs AC${target.ac} —— 未命中。`, 'attack'); return; }
  const dmg = rollDice(m.damage); let total = dmg.total; if (r.roll === 20) total += rollDice(m.damage).total; total = Math.max(1, total);
  applyDamageToChar(s, target, total, m.name, r.roll === 20);
  const sp = String(m.special || '');
  if (sp && target.alive && target.hp > 0) {
    if (sp.includes('poison') || sp.includes('毒')) { addStatus(target, '中毒', 2); L(s, `🤢 ${target.name} 中毒了！`, 'down'); }
    else if (sp.includes('stun') || sp.includes('paral') || sp.includes('眩') || sp.includes('麻')) { if (Math.random() < 0.5) { addStatus(target, '眩晕', 1); L(s, `💫 ${target.name} 被打晕了！`, 'down'); } }
    else if (sp.includes('fear') || sp.includes('恐')) { addStatus(target, '恐惧', 2); L(s, `😱 ${target.name} 陷入恐惧！`, 'down'); }
  }
}

function applyDamageToChar(s: State, c: Character, amount: number, source: string, crit: boolean) {
  let dmg = amount;
  if (c.rage) dmg = Math.ceil(dmg / 2);
  if (c.tempHp > 0) { const used = Math.min(c.tempHp, dmg); c.tempHp -= used; dmg -= used; }
  c.hp = Math.max(0, c.hp - dmg);
  L(s, `👹 ${source} ${crit ? '【重击】' : ''}命中 ${c.name}，造成 ${dmg} 点伤害${c.rage ? '（狂暴减半）' : ''}（${c.hp}/${c.hpMax}）。`, 'attack');
  if (c.hp <= 0) { c.hp = 0; c.conditions = Array.from(new Set([...c.conditions, '倒地濒死'])); L(s, `🩸 ${c.name} 倒地，开始死亡豁免！`, 'down'); }
}

// 濒死角色的死亡豁免（每轮轮到其回合时由路由调用）
export function deathSave(s: State, seat: string): { ok: boolean; error?: string } {
  const c = s.chars[seat]; if (!c) return { ok: false, error: '无此角色' };
  if (c.hp > 0 || !c.alive) return { ok: false, error: '无需死亡豁免' };
  const r = rollDie(20);
  if (r === 20) { c.hp = 1; c.deathSaves = { ok: 0, fail: 0 }; c.conditions = c.conditions.filter((x) => x !== '倒地濒死'); L(s, `✨ ${c.name} 死亡豁免掷出20，奇迹般以1点生命苏醒！`, 'up'); }
  else if (r === 1) { c.deathSaves.fail += 2; L(s, `☠️ ${c.name} 死亡豁免大失败（双倍失败）。`, 'down'); }
  else if (r >= 10) { c.deathSaves.ok += 1; L(s, `${c.name} 死亡豁免成功（${c.deathSaves.ok}/3）。`, 'down'); }
  else { c.deathSaves.fail += 1; L(s, `${c.name} 死亡豁免失败（${c.deathSaves.fail}/3）。`, 'down'); }
  if (c.deathSaves.ok >= 3) { c.deathSaves = { ok: 0, fail: 0 }; c.conditions = c.conditions.filter((x) => x !== '倒地濒死'); L(s, `${c.name} 稳定下来（昏迷但存活）。`, 'down'); }
  if (c.deathSaves.fail >= 3) { c.alive = false; c.conditions = ['死亡']; L(s, `⚰️ ${c.name} 死亡。`, 'death'); }
  endTurn(s); return { ok: true };
}

export function checkCombatEnd(s: State): boolean {
  if (!s.combat?.active) return false;
  const boss = !!s.combat.boss;
  const monstersUp = s.combat.monsters.some((m) => m.alive);
  const heroesUp = s.seats.some((seat) => s.chars[seat]?.alive && s.chars[seat].hp > 0);
  if (!monstersUp) {
    L(s, `🎉 敌人全部被击败！`, 'win');
    s.xpAward += s.combat.monsters.reduce((a, m) => a + Math.max(25, m.hpMax * 5), 0) * (boss ? 2 : 1);
    const gold = rollDice('2d6').total * (boss ? 5 : 2); const drops: string[] = [];
    for (const seat of s.seats) { const c = s.chars[seat]; if (!c?.alive) continue; c.gold += gold; if (Math.random() < (boss ? 0.85 : 0.3)) { c.potions += 1; drops.push(c.name); } }
    L(s, `💰 战利品：每人 +${gold} 金币${drops.length ? `；${drops.join('、')} 各拾得 1 瓶治疗药水` : ''}。`, 'win');
    endCombat(s, 'win'); return true;
  }
  if (!heroesUp) { L(s, `💀 全队倒下……`, 'loss'); endCombat(s, 'loss'); return true; }
  return false;
}
function endCombat(s: State, r: string) {
  if (s.combat) s.combat.active = false;
  for (const seat of s.seats) { const c = s.chars[seat]; if (c) { c.rage = false; c.statuses = []; } }
  if (r === 'loss') { s.phase = 'ended'; L(s, '☠️ 队伍全员倒下，冒险以失败告终。', 'loss'); }
  else { s.phase = 'explore'; }
}

// ---------- 休整 / 升级 ----------
export function shortRest(s: State) {
  for (const seat of s.seats) { const c = s.chars[seat]; if (!c?.alive) continue; const heal = Math.floor(c.hpMax / 4) + mod(c.scores.con); c.hp = Math.min(c.hpMax, c.hp + Math.max(1, heal)); c.secondWindUsed = false; if (c.hp > 0) { c.conditions = c.conditions.filter((x) => x !== '倒地濒死'); c.deathSaves = { ok: 0, fail: 0 }; } }
  L(s, `🏕️ 全队短休，恢复部分生命。`, 'rest');
}
export function longRest(s: State) {
  for (const seat of s.seats) { const c = s.chars[seat]; if (!c) continue; if (!c.alive && c.conditions.includes('死亡')) continue; c.hp = c.hpMax; c.tempHp = 0; c.conditions = c.conditions.filter((x) => x === '死亡'); c.deathSaves = { ok: 0, fail: 0 }; c.spellSlots = { ...c.spellSlotsMax }; c.secondWindUsed = false; c.statuses = []; }
  L(s, `🌙 全队长休，生命与法术位回满。`, 'rest');
}
export function awardAndMaybeLevel(s: State): void {
  if (s.xpAward <= 0) return;
  const per = Math.floor(s.xpAward / Math.max(1, s.seats.length));
  for (const seat of s.seats) { const c = s.chars[seat]; if (!c?.alive) continue; c.xp += per; }
  s.xpAward = 0;
  // 简化升级：每 300*level XP 升一级
  for (const seat of s.seats) { const c = s.chars[seat]; if (!c?.alive) continue;
    while (c.xp >= 300 * c.level) { c.xp -= 300 * c.level; levelUp(s, c); }
  }
}
function levelUp(s: State, c: Character) {
  c.level += 1; c.profBonus = profBonus(c.level);
  const cdef = CLASSES[c.cls]; const hd = cdef?.hd || 8;
  const gain = Math.max(1, Math.floor(hd / 2) + 1 + mod(c.scores.con)); c.hpMax += gain; c.hp += gain;
  c.spellSlotsMax = casterSlots(cdef?.caster || 'none', c.level); c.spellSlots = { ...c.spellSlotsMax };
  const castMod = cdef?.castAbility ? mod(c.scores[cdef.castAbility]) : 0; c.spellDc = 8 + c.profBonus + castMod; c.spellAtk = c.profBonus + castMod;
  const learn = (LEVELUP_SPELLS[c.cls] || {})[c.level] || [];
  for (const k of learn) { if (!c.knownSpells.includes(k)) { c.knownSpells.push(k); L(s, `📖 ${c.name} 习得新法术：${SPELLS[k]?.cn || k}！`, 'level'); } }
  L(s, `⭐ ${c.name} 升至 ${c.level} 级！（HP +${gain}，熟练 +${c.profBonus}）`, 'level');
}

// ---------- 快照（给前端；目前全队信息共享，怪物 HP 也展示） ----------
export function newGame(theme: string, seats: string[], names: Record<string, string>): State {
  const s: State = { phase: 'creation', theme: theme || '', scene: '', chars: {}, seats: [...seats], combat: null, log: [], logSeq: 0, quest: '', xpAward: 0 };
  L(s, `🎲 一支冒险小队集结。请各自创建角色。`, 'sys');
  return s;
}
export function publicView(s: State) {
  return {
    phase: s.phase, theme: s.theme, scene: s.scene, quest: s.quest, seats: s.seats,
    chars: s.chars, combat: s.combat ? { active: s.combat.active, round: s.combat.round, turnIdx: s.combat.turnIdx, order: s.combat.order, monsters: s.combat.monsters, boss: !!s.combat.boss, env: s.combat.env || '', current: currentActor(s)?.ref || null } : null,
    log: s.log.slice(-30), logSeq: s.logSeq,
  };
}

// ---------- 路由用辅助 ----------
export function pushLog(s: State, msg: string, kind?: string) { s.log.push({ msg, kind }); s.logSeq = (s.logSeq || 0) + 1; }
export function clampInt(v: any, lo: number, hi: number, dflt: number) { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : dflt; }
export function sanitizeMonsters(arr: any[]): Monster[] {
  if (!Array.isArray(arr)) return [];
  return arr.slice(0, 6).map((m, i) => ({
    id: `m${i + 1}`, name: String(m?.name || `敌人${i + 1}`).slice(0, 24),
    ac: clampInt(m?.ac, 8, 20, 12), hpMax: clampInt(m?.hp, 3, 80, 8), hp: clampInt(m?.hp, 3, 80, 8),
    attackBonus: clampInt(m?.attackBonus, 0, 10, 3), damage: /^\d+d\d+([+-]\d+)?$/.test(String(m?.damage || '')) ? String(m.damage) : '1d6+1',
    special: typeof m?.special === 'string' ? m.special : '', conditions: [], statuses: [], alive: true,
  }));
}

// ---------- 法术与药水 ----------
export type Spell = { key: string; cn: string; level: number; kind: 'heal' | 'damage' | 'missile' | 'status'; target: 'ally' | 'enemy'; dice: string; save?: Ability; status?: string; rounds?: number };
export const SPELLS: Record<string, Spell> = {
  cure: { key: 'cure', cn: '治疗术', level: 1, kind: 'heal', target: 'ally', dice: '1d8' },
  guidingbolt: { key: 'guidingbolt', cn: '指引之箭', level: 1, kind: 'damage', target: 'enemy', dice: '4d6' },
  magicmissile: { key: 'magicmissile', cn: '魔法飞弹', level: 1, kind: 'missile', target: 'enemy', dice: '1d4+1' },
  burning: { key: 'burning', cn: '燃烧之手', level: 1, kind: 'damage', target: 'enemy', dice: '3d6', save: 'dex' },
  frighten: { key: 'frighten', cn: '威慑术', level: 1, kind: 'status', target: 'enemy', dice: '', status: '恐惧', rounds: 2 },
  scorch: { key: 'scorch', cn: '灼热射线', level: 2, kind: 'damage', target: 'enemy', dice: '6d6' },
  spiritweapon: { key: 'spiritweapon', cn: '灵体武器', level: 2, kind: 'damage', target: 'enemy', dice: '2d8' },
  hold: { key: 'hold', cn: '人类定身术', level: 2, kind: 'status', target: 'enemy', dice: '', status: '眩晕', rounds: 1 },
};
const CLASS_SPELLS: Record<string, string[]> = { cleric: ['cure', 'guidingbolt', 'frighten'], wizard: ['magicmissile', 'burning', 'frighten'], ranger: ['cure'] };
const LEVELUP_SPELLS: Record<string, Record<number, string[]>> = { wizard: { 3: ['scorch', 'hold'] }, cleric: { 3: ['spiritweapon', 'hold'] }, ranger: { 3: ['frighten'] } };

export function playerCastSpell(s: State, seat: string, spellKey: string, targetRef: string): { ok: boolean; error?: string } {
  if (!s.combat?.active) return { ok: false, error: '现在不是战斗' };
  const cur = currentActor(s); if (!cur || cur.ref !== seat) return { ok: false, error: '还没轮到你' };
  const c = s.chars[seat]; if (!c || !c.alive || c.hp <= 0) return { ok: false, error: '你无法施法' };
  const sp = SPELLS[spellKey]; if (!sp || !c.knownSpells.includes(spellKey)) return { ok: false, error: '你不会这个法术' };
  if ((c.spellSlots[sp.level] || 0) <= 0) return { ok: false, error: `没有 ${sp.level} 环法术位了` };
  c.spellSlots[sp.level] -= 1;
  const castMod = c.spellAtk - c.profBonus;
  if (sp.kind === 'heal') {
    const t = s.chars[targetRef]; if (!t || !t.alive) return { ok: false, error: '治疗目标无效' };
    const wasDown = t.hp <= 0; const heal = Math.max(1, rollDice(sp.dice).total + castMod);
    t.hp = Math.min(t.hpMax, t.hp + heal);
    if (wasDown) { t.conditions = t.conditions.filter((x) => x !== '倒地濒死'); t.deathSaves = { ok: 0, fail: 0 }; }
    pushLog(s, `✨ ${c.name} 施放${sp.cn}，治疗 ${t.name} ${heal} 点${wasDown ? '并将其救醒' : ''}（${t.hp}/${t.hpMax}）。`, 'spell');
  } else {
    const m = s.combat.monsters.find((x) => x.id === targetRef); if (!m || !m.alive) return { ok: false, error: '目标无效' };
    if (sp.kind === 'status') {
      const save = rollDie(20) + 2;
      if (save >= c.spellDc) pushLog(s, `✨ ${c.name} 施放${sp.cn}，但 ${m.name} 豁免成功(${save} vs DC${c.spellDc})，抵抗了效果。`, 'spell');
      else { addStatus(m, sp.status || '眩晕', sp.rounds || 2); pushLog(s, `✨ ${c.name} 施放${sp.cn}，${m.name} 豁免失败，陷入【${sp.status || '眩晕'}】！`, 'spell'); }
      endTurn(s); return { ok: true };
    }
    if (sp.kind === 'missile') { let total = 0; for (let i = 0; i < 3; i++) total += rollDice(sp.dice).total; m.hp = Math.max(0, m.hp - total); pushLog(s, `✨ ${c.name} 的${sp.cn}三发齐射命中 ${m.name}，共 ${total} 点力场伤害（${m.hp}/${m.hpMax}）。`, 'spell'); }
    else if (sp.save) { const save = rollDie(20) + 2; const dmg = rollDice(sp.dice).total; const total = save >= c.spellDc ? Math.floor(dmg / 2) : dmg; m.hp = Math.max(0, m.hp - total); pushLog(s, `✨ ${c.name} 施放${sp.cn}，${m.name} ${ABILITY_CN[sp.save]}豁免(${save} vs DC${c.spellDc})${save >= c.spellDc ? '成功半伤' : '失败'}，受 ${total} 点伤害（${m.hp}/${m.hpMax}）。`, 'spell'); }
    else { const r = d20(0); const hit = r.roll === 20 || (r.roll !== 1 && r.roll + c.spellAtk >= m.ac); if (!hit) { pushLog(s, `✨ ${c.name} 的${sp.cn}未命中（${r.roll}+${c.spellAtk} vs AC${m.ac}）。`, 'spell'); endTurn(s); return { ok: true }; } let total = rollDice(sp.dice).total; if (r.roll === 20) total += rollDice(sp.dice).total; m.hp = Math.max(0, m.hp - total); pushLog(s, `✨ ${c.name} 的${sp.cn}${r.roll === 20 ? '【暴击】' : ''}命中 ${m.name}，${total} 点伤害（${m.hp}/${m.hpMax}）。`, 'spell'); }
    if (m.hp <= 0) { m.alive = false; pushLog(s, `💀 ${m.name} 倒下了！`, 'kill'); }
  }
  endTurn(s); return { ok: true };
}

export function usePotion(s: State, seat: string): { ok: boolean; error?: string } {
  const c = s.chars[seat]; if (!c || !c.alive) return { ok: false, error: '无法使用' };
  if (c.hp <= 0) return { ok: false, error: '昏迷时无法自饮药水' };
  if (c.potions <= 0) return { ok: false, error: '没有治疗药水了' };
  c.potions -= 1; const heal = rollDice('2d4').total + 2; c.hp = Math.min(c.hpMax, c.hp + heal);
  if (c.hp > 0) { c.conditions = c.conditions.filter((x) => x !== '倒地濒死'); c.deathSaves = { ok: 0, fail: 0 }; }
  pushLog(s, `🧪 ${c.name} 饮下治疗药水，恢复 ${heal} 点（${c.hp}/${c.hpMax}）。`, 'rest');
  return { ok: true };
}

export function endAdventure(s: State, epilogue: string, victory: boolean) {
  s.phase = 'ended'; s.combat = null;
  pushLog(s, (victory ? '🏆 ' : '☠️ ') + (epilogue || (victory ? '冒险圆满落幕。' : '冒险以失败告终。')), victory ? 'win' : 'loss');
}

// ---------- 脱离战斗 / 购物 ----------
export function fleeCombat(s: State, seat: string): { ok: boolean; error?: string } {
  if (!s.combat?.active) return { ok: false, error: '现在不是战斗' };
  const cur = currentActor(s); if (!cur || cur.ref !== seat) return { ok: false, error: '还没轮到你' };
  pushLog(s, `🏃 ${s.chars[seat]?.name} 招呼全队撤退，你们脱离了战斗。`, 'combat');
  s.combat.active = false;
  for (const st of s.seats) { const c = s.chars[st]; if (c) { c.rage = false; c.statuses = []; } }
  s.phase = 'explore';
  return { ok: true };
}
export const POTION_COST = 25;
export function buyPotion(s: State, seat: string): { ok: boolean; error?: string } {
  const c = s.chars[seat]; if (!c) return { ok: false, error: '无角色' };
  if (c.gold < POTION_COST) return { ok: false, error: `金币不足（需 ${POTION_COST}，你有 ${c.gold}）` };
  c.gold -= POTION_COST; c.potions += 1;
  pushLog(s, `🛒 ${c.name} 花 ${POTION_COST} 金币购入一瓶治疗药水（剩 ${c.gold} 金）。`, 'rest');
  return { ok: true };
}

// ---------- 装备 / 商店 / 复活 ----------
export const WEAPONS: Record<string, { cn: string; ability: Ability; damage: string; type: string; cost: number }> = {
  greatsword: { cn: '巨剑', ability: 'str', damage: '2d6', type: '挥砍', cost: 50 },
  battleaxe: { cn: '战斧', ability: 'str', damage: '1d8', type: '挥砍', cost: 30 },
  warhammer: { cn: '战锤', ability: 'str', damage: '1d8', type: '钝击', cost: 30 },
  rapier: { cn: '刺剑', ability: 'dex', damage: '1d8', type: '穿刺', cost: 40 },
  longbow: { cn: '长弓', ability: 'dex', damage: '1d8', type: '穿刺', cost: 40 },
  dagger: { cn: '匕首', ability: 'dex', damage: '1d4', type: '穿刺', cost: 8 },
};
export const ARMORS: Record<string, { cn: string; bonus: number; cost: number }> = {
  leather: { cn: '皮甲', bonus: 1, cost: 20 }, chain: { cn: '链甲', bonus: 3, cost: 75 }, plate: { cn: '板甲', bonus: 5, cost: 200 },
};
export const SHIELD_COST = 15;
export const REVIVE_COST = 100;

function recomputeAc(c: Character) { c.ac = (c.baseAc || 10) + (c.armorBonus || 0) + (c.shield ? 2 : 0); }

export function buyGear(s: State, seat: string, kind: string, key: string): { ok: boolean; error?: string } {
  const c = s.chars[seat]; if (!c) return { ok: false, error: '无角色' };
  if (kind === 'weapon') {
    const w = WEAPONS[key]; if (!w) return { ok: false, error: '没有这件武器' };
    if (c.attacks.some((a) => a.name === w.cn)) return { ok: false, error: '你已拥有该武器' };
    if (c.gold < w.cost) return { ok: false, error: `金币不足（需 ${w.cost}）` };
    c.gold -= w.cost; c.attacks.push({ name: w.cn, ability: w.ability, damage: w.damage, type: w.type });
    pushLog(s, `🗡️ ${c.name} 购入${w.cn}（剩 ${c.gold} 金）。`, 'rest'); return { ok: true };
  }
  if (kind === 'armor') {
    const a = ARMORS[key]; if (!a) return { ok: false, error: '没有这件护甲' };
    if ((c.armorBonus || 0) >= a.bonus) return { ok: false, error: '你已有同级或更好的护甲' };
    if (c.gold < a.cost) return { ok: false, error: `金币不足（需 ${a.cost}）` };
    c.gold -= a.cost; c.armorBonus = a.bonus; recomputeAc(c);
    pushLog(s, `🛡️ ${c.name} 穿上${a.cn}（AC ${c.ac}，剩 ${c.gold} 金）。`, 'rest'); return { ok: true };
  }
  if (kind === 'shield') {
    if (c.shield) return { ok: false, error: '你已有盾牌' };
    if (c.gold < SHIELD_COST) return { ok: false, error: `金币不足（需 ${SHIELD_COST}）` };
    c.gold -= SHIELD_COST; c.shield = true; recomputeAc(c);
    pushLog(s, `🛡️ ${c.name} 装备盾牌（AC ${c.ac}，剩 ${c.gold} 金）。`, 'rest'); return { ok: true };
  }
  return { ok: false, error: '未知物品' };
}

export function reviveAlly(s: State, seat: string, targetSeat: string): { ok: boolean; error?: string } {
  if (s.combat?.active) return { ok: false, error: '战斗中无法复活' };
  const r = s.chars[seat]; const t = s.chars[targetSeat];
  if (!r || !t) return { ok: false, error: '目标无效' };
  if (t.alive) return { ok: false, error: '该队友还活着' };
  if (r.gold < REVIVE_COST) return { ok: false, error: `金币不足（需 ${REVIVE_COST}）` };
  r.gold -= REVIVE_COST; t.alive = true; t.hp = Math.max(1, Math.floor(t.hpMax / 2)); t.conditions = []; t.deathSaves = { ok: 0, fail: 0 }; t.statuses = [];
  pushLog(s, `⛪ ${r.name} 花 ${REVIVE_COST} 金币在神殿将 ${t.name} 复活（${t.hp}/${t.hpMax}）。`, 'up'); return { ok: true };
}
