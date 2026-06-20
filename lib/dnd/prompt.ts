// 龙与地下城 · AI 地下城主（DM）prompts。机制全部由引擎确定性处理，DM 只负责剧情与生成怪物数值。
import { CLASSES, RACES } from './engine';

export function buildDndOpeningPrompt(theme: string, partySize: number, lang?: string) {
  const en = lang === 'en';
  return `你是一位资深龙与地下城（D&D 5e）地下城主（DM）。为 ${partySize} 人小队开一场**原创**单元冒险。
${theme ? `题材/基调：${theme}。` : '题材自定，经典剑与魔法奇幻即可。'}
要求：
- 构思一个紧凑、可在 1~2 小时内完成的冒险钩子（一个目标、一处地点、一个反派/威胁）。
- opening 用第二人称、画面感强地描写小队当前所处的开场场景（3~5 句），以一个"你们会怎么做？"式的悬念收尾。
- 绝不替玩家做决定或描写玩家心理。
只输出 JSON：
{
  "scene": "一句话当前地点（如：腐朽的边境哨站 · 黄昏）",
  "quest": "一句话任务目标",
  "opening": "开场叙事（${en ? 'English' : '中文'}，第二人称，3~5 句）",
  "options": ["3~4 个此刻可做的具体行动（每个一句、可直接执行，如'搜查船尾的箱子'/'盘问船工'/'戒备南方逼近的黑帆'）"]
}`;
}

// 探索阶段：把玩家的自由行动裁定为一次检定/社交/战斗/休整，并**预先写好成功与失败两种叙事**（避免二次调用与数值错配）。
export function buildDndActPrompt(scene: string, quest: string, party: string, recent: string, actorName: string, action: string, lang?: string, bp?: any) {
  const en = lang === 'en';
  const bpBlock = bp ? `
【隐藏冒险蓝图（绝密，据此把控节奏与走向，绝不直接念给玩家）】
反派：${bp.villain?.name || ''}（${bp.villain?.goal || ''}）；最终对决：${bp.villain?.showdown || ''}
节拍：${(bp.acts || []).map((a: any) => `${a.name}:${a.goal}`).join(' → ')}
关键NPC：${(bp.npcs || []).map((n: any) => `${n.name}(${n.role}，诉求:${n.want}，秘密:${n.secret})`).join('；')}
地点：${(bp.locations || []).map((l: any) => l.name).join('、')}
计划遭遇：${(bp.encounters || []).map((e: any) => `${e.when}→${e.foes}`).join('；')}
反转：${bp.twist || ''}｜高潮：${bp.climax || ''}｜奖励：${bp.rewards || ''}
请顺着这条暗线推进：随玩家行动逐步引入 NPC / 地点，在合适时机触发计划遭遇与 Boss 高潮，最终导向通关；不要一次倒出全部，也不要偏离锁定的反转与反派。` : '';
  return `你是 D&D 地下城主。当前场景：${scene}。任务：${quest}。${bpBlock}
小队：${party}
最近发生：${recent || '（无）'}
玩家「${actorName}」声明的行动：「${action}」

请把它裁定为下列之一并只输出 JSON：
- 需要技能检定（潜行/察觉/游说/运动/奥秘/调查 等）→ kind="check"，给 skill（用英文键：perception/stealth/persuasion/athletics/arcana/investigation/insight/deception/intimidation/acrobatics/sleight/survival/nature/history/religion/medicine/animal/performance）与合理 dc(5~20)，并**分别**写好 success 与 fail 两段叙事。
- 纯角色扮演/对话/观察、无需检定 → kind="social"，写 narration。
- 行动触发战斗 → kind="combat"，写 narration（敌人登场），并给 monsters 数组（每个：name 名称, ac 10~17, hp 5~40, attackBonus 2~7, damage 如 "1d6+2", special 可选="poison|stun|fear" 或留空表示特殊攻击）。1~4 个敌人，强度匹配 ${partySafe(party)} 人小队。若是高潮 Boss 战，设 boss=true 并给 1 个更强的单体（hp 40~90, ac 14~18, special 可填）。可给 env 一句战场环境/掩体描述。
- 玩家想休息 → kind="rest"，rest 取 "short" 或 "long"，写 narration。
- 任务目标已明确达成、或队伍彻底失败/放弃 → kind="end"，victory 取 true/false，epilogue 写 2~4 句收束尾声。仅在剧情确实该结束时才用。
叙事用${en ? 'English' : '中文'}、第二人称、2~4 句，不替玩家做决定。另外**每次都给 options：2~4 个此刻可做的具体后续行动**（每个一句、可直接点选执行；战斗触发时可留空）。若剧情推进到新地点或新目标，可填 scene_update / quest_update（一句话；否则留空）。
另外**每次都要判断当前所在地点是否安全**填 safe：仅当队伍身处城镇/村庄/营地/旅馆/神殿/集市等**明确安全、可安心休整与交易**的地方时 safe=true；身处地牢/野外/废墟/沉船/被追杀/有敌意威胁等危险环境时 safe=false。
{
  "kind": "check|social|combat|rest",
  "skill": "(check时)英文技能键，否则 none",
  "dc": 12,
  "success": "(check时)成功叙事",
  "fail": "(check时)失败叙事",
  "narration": "(social/combat/rest时)叙事",
  "monsters": [ { "name": "哥布林", "ac": 13, "hp": 7, "attackBonus": 4, "damage": "1d6+2", "special": "" } ],
  "boss": false,
  "rest": "short|long",
  "env": "(combat时)战场环境一句话，可留空",
  "safe": false,
  "options": ["2~4 个此刻可做的具体行动"],
  "scene_update": "(可选)新地点一句话",
  "quest_update": "(可选)新目标一句话",
  "victory": true,
  "epilogue": "(end时)结局尾声"
}`;
}
function partySafe(party: string) { return (party.match(/·/g) || []).length || 1; }

export const RACE_KEYS = Object.keys(RACES);
export const CLASS_KEYS = Object.keys(CLASSES);

// 生成 3 个原创冒险供玩家挑选（只给玩家可见的引子，不剧透）。custom 为玩家自定义方向。
export function buildDndQuestsPrompt(custom: string, partySize: number, lang?: string) {
  const en = lang === 'en';
  return `你是资深龙与地下城（D&D 5e）地下城主。为 ${partySize} 人小队设计 **3 个风格迥异**的原创单元冒险，供玩家挑选。${custom ? `\n玩家的自定义要求（务必至少有一个选项贴合，最好贯穿世界观/敌人/反派/基调）：${custom}` : '\n题材自由：经典剑与魔法、黑暗诡奇、海上奇幻、地底迷城、政治阴谋、废土魔法等，三个尽量不同。'}
每个冒险给：title 冒险名、setting 一句话背景与地点、hook 一句话开场钩子、tone 基调（如 英雄史诗 / 黑暗诡奇 / 诙谐冒险）、threat 主要威胁或反派一句话、length 预计时长。
只输出 JSON（恰好 3 个，语言：${en ? 'English' : '中文'}）：
{ "quests": [ { "title": "", "setting": "", "hook": "", "tone": "", "threat": "", "length": "" } ] }`;
}

// 生成一份完整的隐藏冒险蓝图（绝密，玩家看不到），让 DM 照此把控节奏与走向。
export function buildDndBlueprintPrompt(theme: string, partySize: number, lang?: string) {
  const en = lang === 'en';
  return `你是资深龙与地下城（D&D 5e）地下城主。基于以下方向，设计一场**完整的原创单元冒险蓝图**——这是**隐藏档案，绝不直接念给玩家**，但你之后会全程照它跑。
方向：${theme || '经典剑与魔法奇幻'}。队伍 ${partySize} 人，1~2 小时可通关。
要求设计：核心目标；反派（名字+动机+最终怎么对决）；3~5 个推进节拍（acts，每个有名字与目标）；2~4 个关键 NPC（名字+身份+秘密+诉求）；2~4 个地点；若干计划中的遭遇（怪物+触发时机）；一个隐藏反转；高潮/Boss 战设定；通关奖励。
opening 用第二人称、画面感强地写开场（3~5 句），以悬念收尾。options 给 3~4 个开场即可执行的具体行动。
只输出 JSON（语言：${en ? 'English' : '中文'}）：
{
  "scene": "一句话当前地点",
  "quest": "一句话核心目标",
  "villain": { "name": "", "goal": "", "showdown": "最终对决怎么打" },
  "acts": [ { "name": "", "goal": "" } ],
  "npcs": [ { "name": "", "role": "", "secret": "", "want": "" } ],
  "locations": [ { "name": "", "desc": "" } ],
  "encounters": [ { "when": "触发时机", "foes": "怪物" } ],
  "twist": "隐藏反转",
  "climax": "高潮 / Boss 战设定",
  "rewards": "通关奖励",
  "opening": "开场叙事（第二人称，3~5 句）",
  "options": ["3~4 个开场可执行的具体行动"]
}`;
}
