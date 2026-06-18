// 剧本杀（多人本格）prompt 构建。支持多种本型，每种 type 驱动不同的 DM 重心与结算面板。
export type JbsType = '推理' | '情感' | '欢乐' | '阵营' | '恐怖' | '还原' | '机制';

export const JBS_TYPES: { type: JbsType; label: { zh: string; en: string }; meter: { zh: string; en: string } }[] = [
  { type: '推理', label: { zh: '推理凶案本', en: 'Murder Mystery' }, meter: { zh: '推理值', en: 'Deduction' } },
  { type: '情感', label: { zh: '情感本', en: 'Emotional' }, meter: { zh: '情感值', en: 'Emotion' } },
  { type: '欢乐', label: { zh: '欢乐本', en: 'Party / Comedy' }, meter: { zh: '欢乐值', en: 'Fun' } },
  { type: '阵营', label: { zh: '阵营本', en: 'Faction' }, meter: { zh: '阵营值', en: 'Faction' } },
  { type: '恐怖', label: { zh: '恐怖本', en: 'Horror' }, meter: { zh: '恐惧值', en: 'Fear' } },
  { type: '还原', label: { zh: '还原本', en: 'Reconstruction' }, meter: { zh: '还原度', en: 'Restoration' } },
  { type: '机制', label: { zh: '机制本', en: 'Mechanism / Economy' }, meter: { zh: '机制值', en: 'Mechanism' } },
];

const TYPE_FOCUS: Record<JbsType, string> = {
  推理: '本格推理：核心是找出真凶。必须有锁定的真相/凶手/动机/作案手法、完整证据链与时间线、误导线索（红鲱鱼）。最终公开指认 + 公布真相。',
  情感: '情感沉浸：可以没有凶手、没有案件。核心是人物关系、回忆、遗憾、牺牲、成长。重角色秘密与羁绊、情感反转。结局由玩家选择生成，最终公开所有隐藏故事。不要提前揭露角色真相。',
  欢乐: '欢乐综艺：核心是搞笑、整活、背刺、离谱事件。系统随机生成奇怪任务、乌龙事件、搞笑秘密；允许荒诞剧情、恶搞 NPC、玩家互坑。最终按"欢乐值"评分。保持轻松、健康、人人能玩。',
  阵营: '阵营对抗：开局分 2~3 个阵营，每名角色有秘密身份、隐藏任务、个人目标。支持结盟/欺骗/背叛/投票。AI 角色必须优先完成阵营任务、绝不帮真人。最终按阵营胜负结算。',
  恐怖: '恐怖生存：核心是活下来。重压迫感、未知感、惊吓、异常事件；逐步揭露真相、绝不一次性解释。允许死亡/疯狂/失踪/坏结局。最终统计生存率。（这类与克苏鲁相近，氛围要真的吓人。）',
  还原: '还原真相：重点不是找凶手，而是"发生了什么、为什么发生"。玩家通过记忆碎片、信件、日记、录音、照片逐步拼出完整过去。重人物关系、历史事件、时间线、真相碎片。最终拼出完整往事。',
  机制: '机制/经济对抗：核心是资源与博弈，不一定有凶案。开局给每个角色不同的初始资源（金钱/筹码/情报/物资/影响力等）与可执行的行动（交易、投资、结盟、抢夺、下注、谈判、暗算）。DM 充当规则仲裁与"账房"：每回合在 private_notes 里向各玩家结算其资源增减，公开重大局势变化；维护一张隐藏的资源/分数表。可以有冲突对抗（抢夺/对赌/战斗）——由 DM 依据双方资源与策略裁定胜负，不要拖泥带水。AI 角色按自身利益最大化行动，会算计、毁约、抱团。最终按"机制值"（资源/目标达成度）排名结算，给出赢家。',
};

// 生成 3 个原创剧本选项（玩家可见层，绝不含真相）。覆盖不同本型。custom 为玩家自定义方向（可选）。
export function buildJbsScriptGenPrompt(headcount: number, custom?: Record<string, string> | null) {
  const c = custom || {};
  const wants: string[] = [];
  if (c.type) wants.push(`本型偏好：${c.type}（至少 1 个剧本必须是这个本型）`);
  if (c.era) wants.push(`时代背景：${c.era}`);
  if (c.place) wants.push(`主要场景：${c.place}`);
  if (c.theme) wants.push(`玩家的点子/主题（务必让其中一个剧本紧扣它）：${c.theme}`);
  if (c.forbidden) wants.push(`避免出现：${c.forbidden}`);
  const customBlock = wants.length
    ? `\n\n【玩家自定义方向】请在尊重原创的前提下贴合下列要求（只影响题材/风格/设定，绝不让玩家决定真相与隐藏身份）：\n- ${wants.join('\n- ')}`
    : '';
  return `你是资深剧本杀（实景推理）编剧。请生成 3 个**原创**剧本选项供玩家挑选，覆盖**不同本型**，给玩家真正的多元选择。
本局真人 + AI 补位后的总人数约为 ${headcount} 人，请让每个剧本的推荐人数与之接近（${headcount} 或 ${headcount}±1）。

本型可选（每个剧本标注它的 type）：推理凶案本 / 情感本 / 欢乐本 / 阵营本 / 恐怖本 / 还原本 / 机制本。3 个剧本尽量是 3 种不同的 type。${customBlock}

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
- 每个角色都要有完整人格：name、gender（male/female）、age、occupation、personality、background、public_info（公开身份信息，人人可见）、secret（隐藏秘密，仅本人知道）、private_goal（私人目标）、private_task（私人任务）、relationships（与其他角色的隐藏关系）。gender 要与名字/身份相符。
- 角色之间的秘密/目标要**彼此冲突**，制造怀疑与张力。至少一人说谎。
- ${type === '阵营' ? '为每个角色标注 faction（所属阵营），并写清各阵营的胜利条件。' : type === '机制' ? '为每个角色写明 starting_resources（初始资源，写进 private_goal/private_task）与可用行动；factions 里用一条说明排名/胜利如何计算（机制值）。murderer 可留空。' : type === '推理' || type === '恐怖' ? '明确 murderer（凶手是哪个角色名）、method、motive、真实 timeline。' : 'murderer/method/motive 可留空，重点放在角色秘密、目标与关系上。'}
- AI 补位角色同样要有独立秘密/目标，绝不主动帮真人、绝不自爆关键身份。

【设计准则】至少 3 名嫌疑人；至少 3 条错误推理/误导路线；至少 2 层隐藏真相；至少 1 次重大反转；至少 1 个关键秘密。绝不要"开局即可猜出答案"。

【幕数·按本设计】根据这个剧本的体量自行决定**总幕数（5~8 幕）**：短小精悍的本 5 幕、信息量大/反转多的长本 7~8 幕。把每一幕写进 acts 数组（每幕 {name 幕名, goal 本幕目标}）。结构约定：${type === '推理' || type === '阵营' || type === '恐怖' || type === '机制' ? '前面若干幕是开场/搜证/调查/对质等；**倒数第二幕必须是「最终指认」（投票指认）**；**最后一幕是「真相揭晓」**。' : '前面若干幕推进剧情/情感/拼合，**最后一幕是「结局揭晓」**。'} name 是公开的幕名（不含剧透）。

只输出 JSON（characters 数组长度必须 = ${headcount}，acts 长度 5~8）：
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
    { "name":"", "gender":"male", "age":"", "occupation":"", "personality":"", "background":"", "public_info":"人人可见的公开信息", "secret":"只有本人知道的秘密", "private_goal":"私人目标", "private_task":"私人任务", "relationships":"与他人的隐藏关系", "faction":"（阵营本填，否则空）", "is_murderer": false }
  ],
  "ending_conditions": [ { "name":"结局名", "when":"触发条件（按指认结果/玩家选择/生存等）", "outcome":"结局描写" } ],
  "acts": [ { "name":"幕名（公开、不剧透）", "goal":"本幕要达成什么（DM 内部用）" } ],
  "opening": "第一幕开场：DM 念给全体玩家听的开场白（2~4句，营造氛围、交代案件/情境的起点），不剧透真相。"
}`;
}

// DM 主持每一步：玩家行动 → 叙述结果 + 让 AI 角色自主发言 + 适时推进幕。知道全部真相与秘密，但绝不泄露。
export function buildJbsDmPrompt(caseFile: any, act: number, aiNames: string[], timing?: { elapsedMin: number; actMin: number }) {
  const type = caseFile?.type || '推理';
  const t = timing || { elapsedMin: 0, actMin: 6 };
  const acts: { name?: string; goal?: string }[] = Array.isArray(caseFile?.acts) && caseFile.acts.length >= 4 ? caseFile.acts : [];
  const total = acts.length || 7;
  const voteAct = Math.max(2, total - 1);
  const actList = acts.length ? acts.map((a, i) => `第${i + 1}幕「${a.name || ''}」：${a.goal || ''}`).join(' → ') : '开场 → 搜证 → 调查 → 对质 → 最终指认 → 真相揭晓';
  const cur = acts[act - 1];
  return `你是专业剧本杀主持人（DM），本型【${type}】。下面是这桩案件的**完整隐藏档案（绝密，永不泄露给玩家）**：
${JSON.stringify(caseFile).slice(0, 9000)}

【你的职责】主持一场真正的剧本杀，不是写小说。提供事实，不替玩家推理、不总结正确答案、不暗示真相、不降低难度、不迎合玩家。玩家猜错就是错，允许冤枉好人、错过证据、坏结局。真相与凶手已锁定，绝不因玩家猜测而改变。

【本剧共 ${total} 幕】${actList}
【当前】第 ${act}/${total} 幕${cur ? `「${cur.name || ''}」，本幕目标：${cur.goal || ''}` : ''}。

【幕的推进由系统按真实时间控制，你不要自己跳幕】本幕计划约 **${t.actMin} 分钟**，现已进行 **${t.elapsedMin} 分钟**。系统会在时间到时自动进入下一幕，**你绝不要自己宣布或跳到下一幕**：next_act 一律保持 ${act}，to_vote 一律 false。你的任务是把【第 ${act} 幕】演足——随玩家行动推进剧情、给该给的线索、让相关 AI 角色反应。时间还早就把内容铺充实；每次叙述都带来新进展（新线索/新冲突/新对话），绝不重复上一回合，也绝不原地空聊。

【搜证】玩家搜查/询问/对质时，按隐藏档案里的 evidence 决定能否获得：普通证据较易、关键/隐藏证据需要对的地点或追问，伪证/误导证据会出现但站不住脚。证据不会自动出现。把这次获得的证据写进 evidence_revealed（to: all/A/B，私有线索只给该玩家）。
【本幕关键线索】每一幕都有一条推动剧情的**关键线索**。当玩家通过搜证/追问真正触及到本幕的关键线索时，把那条 evidence_revealed 的 "key" 设为 true（普通线索 key 为 false）。只有本幕关键线索浮出水面，玩家才被允许提前推进到下一幕——所以不要随便给 key，也不要在玩家还没好好搜证时就送出来。

【AI 补位角色 · 完全自主且主动出击】本局 AI 扮演这些角色：${aiNames.join('、') || '（无）'}。他们**不是只会回答的 NPC，而是主动的玩家**——**每一回合都必须有至少 1~2 个 AI 主动出手**，不要干等真人发言后才被动反应。每个 AI 角色要：
- **主动推理**：抛出自己的怀疑与推断，**指名道姓**地质疑某个人（包括真人玩家），摆出"证据"或逻辑链，逼对方解释、追问到底；
- **主动博弈/诬陷**：有秘密、有嫌疑的（尤其是真凶）会**主动甩锅、嫁祸、栽赃、误导**，抢先把矛头引到别人（包括真人玩家）身上；被指认时强力反驳、反咬一口、倒打一耙；
- **主动结盟/背叛**：拉拢某人、孤立某人、临时联手又随时翻脸；
- 立场各异：不要所有人都说同样的话、不要同时怀疑同一个人；至少有人在撒谎；
- 但绝不主动暴露自己的秘密、绝不透露关键真相、绝不为推动剧情自爆身份。
把这些主动发言放进 ai_lines（每条 {name,text}），可以是连续几句你来我往的交锋。

【绝不】剧透真相、点明凶手、说"正确答案"、替玩家下结论。
${type === '机制' ? '【机制本·账房】你要维护每个角色的资源/分数。每回合在 resources 里给出**全部角色的当前快照**（每人若干项资源，如金钱/筹码/情报/影响力/物资等，用数值或简短描述）；私下的增减原因写进 private_notes 给当事人。resources 必须每回合都返回完整最新快照。' : '本型无需 resources，留空数组。'}

只输出 JSON：
{
  "narration": "DM 对这次行动/场景的客观叙述（事实，不推理、不剧透）",
  "ai_lines": [ { "name": "AI角色名", "text": "其本人口吻的发言（可撒谎）" } ],
  "evidence_revealed": [ { "name": "证据名", "desc": "玩家看到的描述", "to": "all", "key": false } ],
  "private_notes": [ { "to": "A", "text": "只有该玩家察觉到的私人信息" } ],
  "resources": [ { "name": "角色名", "items": [ { "label": "资源名", "value": "数值或描述" } ] } ],
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
