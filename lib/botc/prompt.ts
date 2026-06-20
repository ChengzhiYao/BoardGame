// 血染（社交推理）说书人提示词：建局 / 逐角色叫醒的夜晚结算 / AI 白天推理发言 / 投票处决结算。
// 全部为原创身份体系（规避照搬任何已发行游戏的具名角色）。机制类血染钟楼/狼人杀。

// 4/6/8 人局阵营构成（镇民 / 外来者 / 爪牙 / 恶魔）
export function botcComposition(size: number) {
  if (size <= 4) return { townsfolk: 2, outsider: 1, minion: 0, demon: 1 };
  if (size <= 6) return { townsfolk: 3, outsider: 1, minion: 1, demon: 1 };
  return { townsfolk: 5, outsider: 1, minion: 1, demon: 1 };
}

// 按夜间行动决定叫醒次序：投毒最先（让信息变假），保护其次，恶魔杀人，再到信息角色，最后无行动。
export function nightOrderOf(action: string) {
  return ({ poison: 10, protect: 20, kill: 30, inspect: 40, learn: 40, none: 99 } as Record<string, number>)[action] ?? 99;
}

export function buildBotcSetupPrompt(size: number, theme: string, seats: string[]) {
  const c = botcComposition(size);
  return `你是一名"血染"社交推理游戏的说书人（Storyteller），主持一场类血染钟楼 / 狼人杀的推理对局。请为本局设计一套**完全原创**的身份并分配。

【题材】${theme || '（自由发挥：中式志怪 / 克系 / 蒸汽朋克 / 校园 / 末世任选其一，给身份起契合题材的名字）'}
【总人数】${size}。阵营构成必须严格为：镇民(townsfolk) ${c.townsfolk}、外来者(outsider) ${c.outsider}、爪牙(minion) ${c.minion}、恶魔(demon) ${c.demon}。
【真人座位】${seats.join('、') || '（无，全部 AI）'}。其余角色由 AI 扮演。**身份必须随机分配，绝不能让真人一定是好人——真人也可能被分到爪牙或恶魔。**

【身份设计（全部原创，禁止照搬任何已发行游戏的具名角色）】
- 镇民（好人，night_action=learn / inspect / protect）：拥有"获取信息"或"保护"的善良技能。例：夜里得知相邻两人里有几个坏人；验一名玩家善恶；保护一名玩家当夜不死；得知白天死者阵营。**每夜需主动选一名玩家查验/调查的（验善恶、查其当晚是否杀过人/投过毒等）一律用 inspect；不需选目标的被动信息用 learn。**
- 外来者（好人但帮倒忙，多为 learn/none）：善良阵营，但技能/状态给好人添乱。例：以为自己是镇民其实信息常错；死亡会连累相邻者。
- 爪牙（邪恶，常 night_action=poison 或 none）：开局即知道恶魔是谁；破坏技能。例：每夜投毒一人，使其当夜信息变假；或自身验为善良。
- 恶魔（邪恶，night_action=kill）：每夜杀一人（第一夜不杀）；开局即知道所有爪牙，并得到 3 个未入局好人身份用于伪装。
- 为每个 AI 角色起一个普通**公开化名**（name 字段，契合题材的人名，**绝不能等于其隐藏身份名**），玩家板只显示化名，身份保密。
- 给每个身份一句**可执行**的技能描述。为每个身份标注 night_action ∈ {kill, poison, protect, inspect, learn, none}；**每夜主动选一名玩家查验/调查的一律用 inspect**；learn 的角色另给 learns 字段说明它每夜得知什么。

【胜负】好人：白天投票**处决掉恶魔**即胜。邪恶：当存活玩家只剩 2 人（且恶魔在其中）或好人已无法翻盘时胜。

只输出 JSON（roles 数组长度必须 = ${size}，各 team 数量严格等于上面构成）：
{
  "theme": "本局题材名",
  "roles": [
    { "seat": "真人座位字母或 null(AI)", "name": "公开化名（普通人名，契合题材，必须与身份名不同；真人座位留空，系统填真人昵称）", "role": "隐藏身份名", "team": "townsfolk|outsider|minion|demon", "is_demon": false, "ability": "一句话技能", "night_action": "kill|poison|protect|inspect|learn|none", "learns": "(若 learn)每夜得知什么", "first_night_info": "第一夜私下得知：镇民给真信息；外来者可能给错的；爪牙/恶魔互相告知队友身份与座位；无则留空" }
  ],
  "evil_seats": ["邪恶方的座位字母或 AI 身份名列表"],
  "demon_ref": "恶魔的座位字母或其身份名",
  "bluffs": ["3 个未入局的好人身份名（供恶魔伪装）"],
  "opening": "面向全体的公开开场白：营造氛围、宣布天黑请闭眼，绝不泄露任何身份"
}
真人座位（${seats.join('、') || '无'}）必须出现在某些 roles 的 seat 字段；AI 角色 seat 为 null。`;
}

function core(setup: any) {
  return JSON.stringify({ theme: setup?.theme, roles: setup?.roles, evil_seats: setup?.evil_seats, demon_ref: setup?.demon_ref, bluffs: setup?.bluffs }).slice(0, 6500);
}

// 逐角色叫醒的夜晚结算：按 night_order（投毒→保护→杀人→信息）依次处理，并尊重依赖关系。
export function buildBotcNightResolvePrompt(setup: any, day: number, alive: string[], realSeats: string[], humanChoices: string, transcript: string) {
  const firstNight = day <= 1;
  return `你是血染说书人，结算第 ${day} 夜。下面是本局**隐藏设置（绝密，永不泄露）**：
${core(setup)}

存活者（座位/名字）：${alive.join('、') || '（无）'}。
真人玩家本夜提交的能力目标（actor→target）：${humanChoices || '（无；这些角色的目标由你按其阵营私利替其决定，AI 角色同样由你决定）'}。

【逐角色叫醒：严格按次序处理，尊重依赖】
1) 先处理所有"投毒/封技能"（poison）：被投毒者本夜的任何信息都要给**错误**内容。
2) 再处理"保护"（protect）：被保护者本夜不会被杀。
3) 再处理"恶魔杀人"（kill）：${firstNight ? '第一夜恶魔**不杀人**，跳过。' : '恶魔按其目标杀一人；若该目标被保护则杀人失败（无人死）。'}
4) 最后处理"信息"（learn / inspect）：为每个存活的信息角色生成它本夜所得；**inspect（查验）类**按该玩家本夜选择的目标，给出"关于该目标"的查验结果（善恶、是否杀过人/投过毒等）；**若该角色被投毒，则给假信息**。
- 真人座位（${realSeats.join('、') || '无'}）的信息放进 player_private（to 必须是这些座位之一）。
- AI 角色的信息放进 ai_private（who=AI身份名），供其白天推理。
- public_morning 只做天亮播报（宣布谁死了/平安夜），绝不泄露身份。
- wake_sequence 按处理次序列出本夜每个被叫醒的角色（仅记录，用于节奏与音效）。

近期讨论（参考氛围）：${transcript || '（无）'}

deaths / player_private.to / ai_private.who 一律用**座位或公开化名**指代玩家，绝不用隐藏身份名。
只输出 JSON：
{
  "wake_sequence": [ { "actor": "座位/AI名", "action": "poison|protect|kill|learn", "result": "极简结果(如 投毒A / 保护B / 杀C失败 / D获知信息)" } ],
  "deaths": ["本夜死亡者的座位或 AI 名"],
  "poisoned": ["本夜被投毒者"],
  "public_morning": "天亮的公开播报",
  "player_private": [ { "to": "真人座位字母", "text": "你昨夜得知……" } ],
  "ai_private": [ { "who": "AI身份名", "text": "该 AI 私下所知（供其白天推理）" } ]
}`;
}

export function buildBotcDiscussPrompt(setup: any, day: number, alive: string[], aiNames: string[], aiNotes: string, transcript: string) {
  return `你是血染说书人，本回合**代所有存活的 AI 玩家**在白天发言。隐藏设置（绝密）：
${core(setup)}

第 ${day} 天白天。存活者：${alive.join('、') || '（无）'}。本局存活的 AI 角色：${aiNames.join('、') || '（无）'}。
各 AI 私下已知的信息（务必据此推理，邪恶方据此协同）：
${aiNotes || '（暂无额外私密信息）'}

【让每个存活 AI 像真人一样推理，不要空泛附和】
- 好人方：公开自己夜里得到的信息或验人结果，**点名**支持/质疑某人，指出发言里的**矛盾**（谁的说法对不上、谁在改口），逐步收窄恶魔嫌疑；可软性互验（"如果你是X，那昨晚就该…"）。
- 邪恶方（恶魔+爪牙）：协同但不露馅——统一口径、轮流把火力引向某个好人、necessary 时谎称自己是 bluffs 里的某个好人身份并给出假信息；被指认时反咬、提供"不在场证明"；绝不主动暴露队友。
- 立场各异、至少有人在撒谎；不要所有 AI 都怀疑同一个人；每个存活 AI 至少 1 句、可互相交锋、可点名真人。
- **绝不**暴露真实身份/真相，**绝不**替真人玩家发言（含真人邪恶方，由其本人控制）。

近期对话：${transcript || '（无）'}

指代任何玩家时用其**公开化名或座位**，绝不用隐藏身份名。
只输出 JSON：{ "lines": [ { "name": "发言 AI 的公开化名", "text": "其本人口吻、带具体理由的发言" } ] }`;
}

export function buildBotcVotePrompt(setup: any, day: number, alive: string[], humanVotes: string, aiNames: string[], aiNotes: string, transcript: string) {
  return `你是血染说书人，结算第 ${day} 天的处决投票。隐藏设置（绝密）：
${core(setup)}

存活者：${alive.join('、') || '（无）'}。真人玩家的指认/投票：${humanVotes || '（无）'}。
各 AI 私下已知信息：${aiNotes || '（无）'}。

让每个**存活的 AI**（${aiNames.join('、') || '无'}）基于"自己的私密信息 + 本局讨论 + 自身阵营私利"理性投票（指认某存活座位/名字，或 skip 弃票）：
- 好人方：投自己**经推理最可能是恶魔/邪恶**的人；若被有力论证说服则改投。
- 邪恶方：保护恶魔、把票引向好人；但要显得合理，避免暴露协同。
统计全部票（真人 + AI）：得票最高、且达到"存活人数过半"者被处决；平票或未过半则今日无人被处决。
处决后判断：被处决者是恶魔 → win=good；若处决后存活 ≤ 2 且恶魔仍存活 → win=evil；否则 win=null。

本局讨论（投票要据此判断）：${transcript || '（无）'}

ai_votes.voter / target / executed 一律用**座位或公开化名**指代玩家，绝不用隐藏身份名。
只输出 JSON：
{
  "ai_votes": [ { "voter": "AI名", "target": "座位/名字/skip", "reason": "一句话推理依据" } ],
  "executed": "被处决者的座位或名字，或 null",
  "executed_was_demon": false,
  "result_text": "公开宣布今日处决结果（可暗示，真实身份揭晓留到结束）",
  "win": "good|evil|null"
}`;
}

// 单人轮流发言：只让"当前发言者"这一个 AI 玩家发一段推理性发言。
export function buildBotcOneTurnPrompt(setup: any, day: number, alive: string[], speaker: string, aiNotes: string, transcript: string) {
  return `你是血染说书人，现在轮到 AI 玩家「${speaker}」发言。隐藏设置（绝密，永不泄露）：
${core(setup)}

第 ${day} 天白天，存活者：${alive.join('、') || '（无）'}。现在是「${speaker}」的发言回合。
该 AI 私下已知的信息：${aiNotes || '（无）'}
让「${speaker}」像真人一样发**一段**有具体理由的推理发言（仅此一人、一段）：
- 好人：公开自己的线索/查验结果，点名支持或质疑某人，指出别人发言里的矛盾，逐步收窄恶魔嫌疑；
- 邪恶：撒谎、洗白、嫁祸好人、保护队友，必要时谎称自己是某个好人身份并给假信息；被怀疑就反驳。
指代他人一律用**座位或公开名**，绝不报出任何人的真实身份或真相，也绝不替别的玩家发言。
近期对话：${transcript || '（无）'}
只输出 JSON：{ "text": "「${speaker}」这一回合的发言" }`;
}
