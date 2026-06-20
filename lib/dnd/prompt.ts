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
  "opening": "开场叙事（${en ? 'English' : '中文'}，第二人称，3~5 句）"
}`;
}

// 探索阶段：把玩家的自由行动裁定为一次检定/社交/战斗/休整，并**预先写好成功与失败两种叙事**（避免二次调用与数值错配）。
export function buildDndActPrompt(scene: string, quest: string, party: string, recent: string, actorName: string, action: string, lang?: string) {
  const en = lang === 'en';
  return `你是 D&D 地下城主。当前场景：${scene}。任务：${quest}。
小队：${party}
最近发生：${recent || '（无）'}
玩家「${actorName}」声明的行动：「${action}」

请把它裁定为下列之一并只输出 JSON：
- 需要技能检定（潜行/察觉/游说/运动/奥秘/调查 等）→ kind="check"，给 skill（用英文键：perception/stealth/persuasion/athletics/arcana/investigation/insight/deception/intimidation/acrobatics/sleight/survival/nature/history/religion/medicine/animal/performance）与合理 dc(5~20)，并**分别**写好 success 与 fail 两段叙事。
- 纯角色扮演/对话/观察、无需检定 → kind="social"，写 narration。
- 行动触发战斗 → kind="combat"，写 narration（敌人登场），并给 monsters 数组（每个：name 名称, ac 10~17, hp 5~40, attackBonus 2~7, damage 如 "1d6+2", special 可选="poison|stun|fear" 或留空表示特殊攻击）。1~4 个敌人，强度匹配 ${partySafe(party)} 人小队。若是高潮 Boss 战，设 boss=true 并给 1 个更强的单体（hp 40~90, ac 14~18, special 可填）。可给 env 一句战场环境/掩体描述。
- 玩家想休息 → kind="rest"，rest 取 "short" 或 "long"，写 narration。
- 任务目标已明确达成、或队伍彻底失败/放弃 → kind="end"，victory 取 true/false，epilogue 写 2~4 句收束尾声。仅在剧情确实该结束时才用。
叙事用${en ? 'English' : '中文'}、第二人称、2~4 句，不替玩家做决定。若剧情推进到新地点或新目标，可填 scene_update / quest_update（一句话；否则留空）。
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
