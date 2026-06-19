// 血染（社交推理）说书人提示词：建局 / 夜晚结算 / AI 白天发言 / 投票处决结算。
// 全部为原创身份体系（规避照搬任何已发行游戏的具名角色）。机制类血染钟楼/狼人杀：
// 好人阵营（镇民 townsfolk / 外来者 outsider） vs 邪恶阵营（爪牙 minion / 恶魔 demon）。

// 4/6/8 人局阵营构成（镇民 / 外来者 / 爪牙 / 恶魔）
export function botcComposition(size: number) {
  if (size <= 4) return { townsfolk: 2, outsider: 1, minion: 0, demon: 1 }; // 好3 邪1
  if (size <= 6) return { townsfolk: 3, outsider: 1, minion: 1, demon: 1 }; // 好4 邪2
  return { townsfolk: 5, outsider: 1, minion: 1, demon: 1 };                // 8 人：好6 邪2
}

export function buildBotcSetupPrompt(size: number, theme: string, seats: string[]) {
  const c = botcComposition(size);
  return `你是一名"血染"社交推理游戏的说书人（Storyteller），主持一场类血染钟楼 / 狼人杀的推理对局。请为本局设计一套**完全原创**的身份并分配。

【题材】${theme || '（自由发挥：中式志怪 / 克系 / 蒸汽朋克 / 校园 / 末世等任选其一，给身份起契合题材的名字）'}
【总人数】${size}。阵营构成必须严格为：镇民(townsfolk) ${c.townsfolk}、外来者(outsider) ${c.outsider}、爪牙(minion) ${c.minion}、恶魔(demon) ${c.demon}。
【真人座位】${seats.join('、') || '（无，全部 AI）'}。其余角色由 AI 扮演。**身份必须随机分配，绝不能让真人一定是好人——真人也可能被分到爪牙或恶魔。**

【身份设计（全部原创，禁止使用任何已发行游戏的具名角色）】
- 镇民（好人）：拥有"获取信息"或"保护/制约"的善良技能。例：夜里得知与自己相邻者中有几个坏人；验证某人善恶；保护一名玩家当夜不死；得知白天死者的阵营。
- 外来者（好人但帮倒忙）：善良阵营，但技能/状态会给好人添乱。例：以为自己是镇民其实信息全错；死亡时连累相邻者；容易被验为坏人。
- 爪牙（邪恶）：辅助恶魔，开局即知道恶魔是谁；有破坏技能。例：每夜使一名玩家中毒（其当夜信息变为假）；封住某人技能；自身验为善良。
- 恶魔（邪恶）：每夜杀一人；开局即知道所有爪牙是谁，并获得 3 个未入局的好人身份用于伪装。
- 每个身份配一句可执行、能产出信息或行动的技能描述。

【胜负】好人：白天投票**处决掉恶魔**即获胜。邪恶：当存活玩家只剩 2 人（且恶魔在其中）或好人已无法翻盘时获胜。

只输出 JSON（roles 数组长度必须 = ${size}，各 team 数量严格等于上面构成）：
{
  "theme": "本局题材名",
  "roles": [
    { "seat": "真人座位字母或 null(AI)", "role": "原创身份名", "team": "townsfolk|outsider|minion|demon", "is_demon": false, "ability": "一句话技能", "first_night_info": "该身份在第一夜私下得知的信息：镇民给真实信息；外来者可能给错误信息；爪牙/恶魔互相告知队友身份与座位；没有则留空" }
  ],
  "evil_seats": ["邪恶方的座位字母或 AI 身份名列表"],
  "demon_ref": "恶魔的座位字母或其身份名",
  "bluffs": ["3 个未入局的好人身份名（供恶魔伪装）"],
  "opening": "面向全体的公开开场白：营造氛围、宣布天黑请闭眼，绝不泄露任何身份"
}
真人座位（${seats.join('、') || '无'}）必须出现在某些 roles 的 seat 字段里；AI 角色 seat 为 null。`;
}

function brief(setup: any) {
  return JSON.stringify({ theme: setup?.theme, roles: setup?.roles, evil_seats: setup?.evil_seats, demon_ref: setup?.demon_ref, bluffs: setup?.bluffs }).slice(0, 6000);
}

export function buildBotcNightPrompt(setup: any, day: number, alive: string[], realSeats: string[], transcript: string) {
  const firstNight = day <= 1;
  return `你是血染说书人。下面是本局的**隐藏设置（绝密，永不泄露给玩家）**：
${brief(setup)}

现在结算第 ${day} 夜。存活者（座位/名字）：${alive.join('、') || '（无）'}。
${firstNight ? '【第一夜】恶魔本夜**不杀人**；只处理首夜信息（其实 first_night_info 已在建局时下发，这里只需补充必要的夜间互动信息）。' : '【夜晚】恶魔必须杀一名存活玩家（除非被保护/制约）。被保护者不死。'}
规则：
- 被爪牙投毒 / 被封技能的信息角色，本夜得到的信息要给**错误**内容（说书人故意误导）。
- 给每个有夜间信息的存活角色私下下发其所得；真人座位（${realSeats.join('、') || '无'}）的信息放进 player_private（to 必须是这些座位之一）；AI 角色的信息放进 ai_private 供其白天发言。
- public_morning 只做天亮播报（宣布谁死了 / 平安夜），绝不泄露身份或真相。

近期讨论（供你参考氛围与谁可疑）：${transcript || '（无）'}

只输出 JSON：
{
  "deaths": ["本夜死亡者的座位或 AI 名"],
  "public_morning": "天亮的公开播报",
  "player_private": [ { "to": "真人座位字母", "text": "你昨夜得知……" } ],
  "ai_private": [ { "who": "AI身份名", "text": "该 AI 私下所知（供其白天发言用）" } ],
  "poisoned": ["本夜被投毒/受影响者"]
}`;
}

export function buildBotcDiscussPrompt(setup: any, day: number, alive: string[], aiNames: string[], realSeats: string[], transcript: string) {
  return `你是血染说书人，本回合**代所有存活的 AI 玩家**在白天发言。隐藏设置（绝密）：
${brief(setup)}

第 ${day} 天白天讨论。存活者：${alive.join('、') || '（无）'}。本局 AI 扮演的角色：${aiNames.join('、') || '（无）'}。
让每个**存活的 AI** 按其阵营与已知信息发言（每个至少 1 句，可你来我往、可点名质疑真人）：
- 好人方：分享自己夜里得到的信息、互相验证、推理谁是恶魔/爪牙；
- 邪恶方：撒谎、洗白、嫁祸好人、保护队友，必要时谎称自己是某个好人身份（可用 bluffs 里的身份）；
- 立场各异、至少有人在撒谎；**绝不暴露真实身份或真相，绝不替真人玩家发言**（真人由本人控制，包括真人邪恶方）。

近期对话：${transcript || '（无）'}

只输出 JSON：{ "lines": [ { "name": "AI身份名", "text": "其本人口吻的发言" } ] }`;
}

export function buildBotcVotePrompt(setup: any, day: number, alive: string[], humanVotes: string, aiNames: string[], transcript: string) {
  return `你是血染说书人，结算第 ${day} 天的处决投票。隐藏设置（绝密）：
${brief(setup)}

存活者：${alive.join('、') || '（无）'}。真人玩家的指认/投票：${humanVotes || '（无）'}。
让每个**存活的 AI**（${aiNames.join('、') || '无'}）按其阵营私利投票（指认某存活座位/名字，或 skip 弃票）：好人投最可疑者；邪恶方保护恶魔、把票引向好人，并参考真实讨论调整。
统计全部票（真人 + AI）：得票最高、且票数达到"存活人数过半"者被处决；平票或未过半则今日无人被处决。
处决后判断胜负：被处决者是恶魔 → 好人胜（win=good）；若处决后存活人数 ≤ 2 且恶魔仍存活 → 邪恶胜（win=evil）；否则 win=null。

本局讨论（投票要据此判断，不可无视）：${transcript || '（无）'}

只输出 JSON：
{
  "ai_votes": [ { "voter": "AI名", "target": "座位/名字/skip", "reason": "极简理由" } ],
  "executed": "被处决者的座位或名字，或 null",
  "executed_was_demon": false,
  "result_text": "公开宣布今日处决结果（可暗示阵营，但真实身份揭晓留到结束）",
  "win": "good|evil|null"
}`;
}
