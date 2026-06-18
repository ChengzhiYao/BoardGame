// 剧本杀（多人本格）prompt 构建。支持多种本型，每种 type 驱动不同的 DM 重心与结算面板。
export type JbsType = '推理' | '情感' | '欢乐' | '阵营' | '恐怖' | '还原';

export const JBS_TYPES: { type: JbsType; label: { zh: string; en: string }; meter: { zh: string; en: string } }[] = [
  { type: '推理', label: { zh: '推理凶案本', en: 'Murder Mystery' }, meter: { zh: '推理值', en: 'Deduction' } },
  { type: '情感', label: { zh: '情感本', en: 'Emotional' }, meter: { zh: '情感值', en: 'Emotion' } },
  { type: '欢乐', label: { zh: '欢乐本', en: 'Party / Comedy' }, meter: { zh: '欢乐值', en: 'Fun' } },
  { type: '阵营', label: { zh: '阵营本', en: 'Faction' }, meter: { zh: '阵营值', en: 'Faction' } },
  { type: '恐怖', label: { zh: '恐怖本', en: 'Horror' }, meter: { zh: '恐惧值', en: 'Fear' } },
  { type: '还原', label: { zh: '还原本', en: 'Reconstruction' }, meter: { zh: '还原度', en: 'Restoration' } },
];

const TYPE_FOCUS: Record<JbsType, string> = {
  推理: '本格推理：核心是找出真凶。必须有锁定的真相/凶手/动机/作案手法、完整证据链与时间线、误导线索（红鲱鱼）。最终公开指认 + 公布真相。',
  情感: '情感沉浸：可以没有凶手、没有案件。核心是人物关系、回忆、遗憾、牺牲、成长。重角色秘密与羁绊、情感反转。结局由玩家选择生成，最终公开所有隐藏故事。不要提前揭露角色真相。',
  欢乐: '欢乐综艺：核心是搞笑、整活、背刺、离谱事件。系统随机生成奇怪任务、乌龙事件、搞笑秘密；允许荒诞剧情、恶搞 NPC、玩家互坑。最终按"欢乐值"评分。保持轻松、健康、人人能玩。',
  阵营: '阵营对抗：开局分 2~3 个阵营，每名角色有秘密身份、隐藏任务、个人目标。支持结盟/欺骗/背叛/投票。AI 角色必须优先完成阵营任务、绝不帮真人。最终按阵营胜负结算。',
  恐怖: '恐怖生存：核心是活下来。重压迫感、未知感、惊吓、异常事件；逐步揭露真相、绝不一次性解释。允许死亡/疯狂/失踪/坏结局。最终统计生存率。（这类与克苏鲁相近，氛围要真的吓人。）',
  还原: '还原真相：重点不是找凶手，而是"发生了什么、为什么发生"。玩家通过记忆碎片、信件、日记、录音、照片逐步拼出完整过去。重人物关系、历史事件、时间线、真相碎片。最终拼出完整往事。',
};

// 生成 3 个原创剧本选项（玩家可见层，绝不含真相）。覆盖不同本型。
export function buildJbsScriptGenPrompt(headcount: number) {
  return `你是资深剧本杀（实景推理）编剧。请生成 3 个**原创**剧本选项供玩家挑选，覆盖**不同本型**，给玩家真正的多元选择。
本局真人 + AI 补位后的总人数约为 ${headcount} 人，请让每个剧本的推荐人数与之接近（${headcount} 或 ${headcount}±1）。

本型可选（每个剧本标注它的 type）：推理凶案本 / 情感本 / 欢乐本 / 阵营本 / 恐怖本 / 还原本。3 个剧本尽量是 3 种不同的 type。

每个剧本只给"玩家可见"信息，绝不透露真相/凶手/隐藏身份：
- title 标题（有钩子、不剧透）
- type（推理/情感/欢乐/阵营/恐怖/还原 之一）
- genre 题材风格、era 时代背景、place 主要场景
- tagline 一句话氛围
- hook 2~3 句开场钩子（玩家被卷入的理由）
- headcount 推荐人数、duration 预计时长、difficulty 推理/参与难度、emotion 情感强度

只输出 JSON：
{ "scripts": [ { "title":"", "type":"推理", "genre":"", "era":"", "place":"", "tagline":"", "hook":"", "headcount":${headcount}, "duration":"", "difficulty":"", "emotion":"" } ] }`;
}

// 玩家选定剧本后，生成完整隐藏案件档案 + 全部角色（含 AI 补位）。仅服务端可读。
export function buildJbsCasePrompt(chosen: any, headcount: number, realSeats: string[]) {
  const type = (chosen?.type || '推理') as JbsType;
  const focus = TYPE_FOCUS[type] || TYPE_FOCUS['推理'];
  return `玩家选定了下面这个剧本，请为它生成一份**完整、自洽、锁定**的隐藏案件档案与全部角色。只给主持人（DM）内部使用，永不直接展示给玩家。

选定剧本：标题《${chosen.title}》｜本型：${type}｜题材：${chosen.genre} ｜时代：${chosen.era} ｜场景：${chosen.place}
钩子：${chosen.hook}

【本型重心】${focus}

【人数与补位】总角色数 = ${headcount}。其中 ${realSeats.length} 名由真人扮演（座位 ${realSeats.join('、')}），其余 ${headcount - realSeats.length} 名为 **AI 补位角色**。
- 每个角色都要有完整人格：name、age、occupation、personality、background、public_info（公开身份信息，人人可见）、secret（隐藏秘密，仅本人知道）、private_goal（私人目标）、private_task（私人任务）、relationships（与其他角色的隐藏关系）。
- 角色之间的秘密/目标要**彼此冲突**，制造怀疑与张力。至少一人说谎。
- ${type === '阵营' ? '为每个角色标注 faction（所属阵营），并写清各阵营的胜利条件。' : '推理/恐怖本：明确 murderer（凶手是哪个角色名）、method、motive、真实 timeline。'}
- AI 补位角色同样要有独立秘密/目标，绝不主动帮真人、绝不自爆关键身份。

【设计准则】至少 3 名嫌疑人；至少 3 条错误推理/误导路线；至少 2 层隐藏真相；至少 1 次重大反转；至少 1 个关键秘密。绝不要"开局即可猜出答案"。

只输出 JSON（characters 数组长度必须 = ${headcount}）：
{
  "title": "${chosen.title}",
  "type": "${type}",
  "meter_key": "${(JBS_TYPES.find((t) => t.type === type)?.meter.zh) || '推理值'}",
  "truth": "完整真相：到底发生了什么",
  "murderer": "凶手角色名（情感/还原/欢乐本可为空字符串）",
  "method": "作案手法（无则空）",
  "motive": "动机（无则空）",
  "timeline_true": [ { "time":"", "event":"真实发生的事（含玩家未知的）" } ],
  "evidence": [ { "name":"证据名", "where":"在哪/怎么获得", "tier":"普通/关键/隐藏/伪证/误导", "reveals":"它揭示什么" } ],
  "red_herrings": [ { "clue":"", "why":"为何误导、最终如何被排除" } ],
  "factions": [ { "name":"阵营名", "win":"胜利条件" } ],
  "characters": [
    { "name":"", "age":"", "occupation":"", "personality":"", "background":"", "public_info":"人人可见的公开信息", "secret":"只有本人知道的秘密", "private_goal":"私人目标", "private_task":"私人任务", "relationships":"与他人的隐藏关系", "faction":"（阵营本填，否则空）", "is_murderer": false }
  ],
  "ending_conditions": [ { "name":"结局名", "when":"触发条件（按指认结果/玩家选择/生存等）", "outcome":"结局描写" } ],
  "opening": "第一幕开场：DM 念给全体玩家听的开场白（2~4句，营造氛围、交代案件/情境的起点），不剧透真相。"
}`;
}

const ACTS = '1案件发生/开场 → 2搜证 → 3人物关系调查 → 4关键证据公开 → 5推理讨论 → 6最终指认(投票) → 7真相揭晓';

// DM 主持每一步：玩家行动 → 叙述结果 + 让 AI 角色自主发言 + 适时推进幕。知道全部真相与秘密，但绝不泄露。
export function buildJbsDmPrompt(caseFile: any, act: number, aiNames: string[]) {
  const type = caseFile?.type || '推理';
  return `你是专业剧本杀主持人（DM），本型【${type}】。下面是这桩案件的**完整隐藏档案（绝密，永不泄露给玩家）**：
${JSON.stringify(caseFile).slice(0, 9000)}

【你的职责】主持一场真正的剧本杀，不是写小说。提供事实，不替玩家推理、不总结正确答案、不暗示真相、不降低难度、不迎合玩家。玩家猜错就是错，允许冤枉好人、错过证据、坏结局。真相与凶手已锁定，绝不因玩家猜测而改变。

【当前进度】第 ${act} 幕。七幕结构：${ACTS}。完成本幕目标就把 next_act 设为下一幕（最多到 7）。${type === '推理' || type === '阵营' || type === '恐怖' ? '到第 6 幕进入"最终指认"，让玩家投票指认；到第 7 幕揭晓。' : '按本型在合适时机收束（情感/还原本靠玩家选择/拼齐碎片）。'}

【搜证】玩家搜查/询问/对质时，按隐藏档案里的 evidence 决定能否获得：普通证据较易、关键/隐藏证据需要对的地点或追问，伪证/误导证据会出现但站不住脚。证据不会自动出现。把这次获得的证据写进 evidence_revealed（to: all/A/B，私有线索只给该玩家）。

【AI 补位角色 · 完全自主】本局 AI 扮演这些角色：${aiNames.join('、') || '（无）'}。当场景需要他们反应、或进入讨论时，让**相关的** AI 角色发言（不必每个都说话）。每个 AI 角色必须：
- 优先自己的角色目标/秘密/利益，而不是帮真人；会撒谎、隐瞒、误导、甚至嫁祸；
- 各自立场不同，不要所有人说一样的话、不要同时怀疑同一个人；
- 绝不主动暴露自己的秘密、绝不透露关键真相、绝不为推动剧情自爆身份。
把他们的发言放进 ai_lines（每条 {name,text}）。

【绝不】剧透真相、点明凶手、说"正确答案"、替玩家下结论。

只输出 JSON：
{
  "narration": "DM 对这次行动/场景的客观叙述（事实，不推理、不剧透）",
  "ai_lines": [ { "name": "AI角色名", "text": "其本人口吻的发言（可撒谎）" } ],
  "evidence_revealed": [ { "name": "证据名", "desc": "玩家看到的描述", "to": "all" } ],
  "private_notes": [ { "to": "A", "text": "只有该玩家察觉到的私人信息" } ],
  "next_act": ${act},
  "to_vote": false,
  "hint": "下一步玩家可以做什么（不暗示答案，只给方向）"
}`;
}

// 最终指认结算：算出 AI 角色各自的投票 + 据指认结果定结局。
export function buildJbsVotePrompt(caseFile: any, aiNames: string[], realVotes: { voter: string; target: string }[]) {
  return `你是剧本杀 DM。隐藏档案（绝密）：
${JSON.stringify(caseFile).slice(0, 8000)}

真人玩家的指认：${realVotes.map((v) => `${v.voter}→${v.target}`).join('；') || '（无）'}
AI 角色需各自独立投票：${aiNames.join('、') || '（无）'}。每个 AI 角色按**自己的角色逻辑与私利**投票（可能甩锅、护人、或真心指认），不得为了让真人获胜而改票。

综合全部票数判断结局（按档案里的 ending_conditions / 本型逻辑）。给 meter（本型对应的分值，0~100）。

只输出 JSON：
{
  "ai_votes": [ { "name": "AI角色名", "target": "被指认者", "reason": "极简理由" } ],
  "accused": "得票最多者",
  "correct": true,
  "meter": 0,
  "reveal": "完整真相揭晓：到底发生了什么、真凶/隐藏身份、各角色秘密、结局走向。这是结案，可以全部公开。"
}`;
}
