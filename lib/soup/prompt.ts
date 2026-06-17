// 海龟汤（情境推理）模式的 prompt 构建。

// 生成一道海龟汤：汤面（玩家可见的诡异情境）+ 汤底（隐藏真相）。
export function buildSoupGenPrompt(difficulty?: string) {
  return `你是一位海龟汤（情境推理谜题）出题大师。请原创一道**逻辑自洽、出人意料但事后合理**的海龟汤。
难度：${difficulty || '普通'}。

要求：
- 汤面（surface）：2~4 句，描述一个**诡异、反常、令人费解的情境或结果**，刻意留下巨大的"为什么"，但不剧透真相。要具体、有画面感，避免老梗（不要又是"他吃了海龟汤就自杀"那种烂大街的）。
- 汤底（bottom）：完整解释汤面背后的全部真相——动机、经过、关键反转，逻辑必须能严丝合缝地解释汤面里的每一个反常点。
- 谜题必须能**靠一连串是非题**逐步逼近真相；答案要"啊原来如此"，而不是要靠脑洞乱猜或超自然外挂。
- 可以是悬疑、温情、惊悚、黑色幽默等不同基调。

只输出 JSON：
{ "title": "谜题标题", "surface": "汤面", "bottom": "汤底（完整真相）", "difficulty": "普通/困难/地狱" }`;
}

// 回答玩家的是非题。主持人知道汤底，只给裁定。
export function buildSoupAnswerPrompt(surface: string, bottom: string) {
  return `你是这道海龟汤的主持人。下面是这道题的汤面与**隐藏汤底**（绝不能直接告诉玩家）。
汤面：${surface}
汤底（机密）：${bottom}

玩家会问只能用是/否回答的问题。你要依据汤底严格、客观地裁定。规则：
- verdict 只能是这四个英文键之一（不要翻译键名）："yes"（是）/ "no"（不是）/ "irrelevant"（无关，与真相无关）/ "partly"（是也不是，部分正确或要看情况）。
- 绝不直接说出汤底；不要主动剧透。
- note 可留空；仅当玩家明显跑偏或非常接近时，给一句极短的中性提示，不要长篇。
- 如果玩家问的不是是非题，verdict 用 "irrelevant"，note 提示玩家用是非题提问。

只输出 JSON：{ "verdict": "yes/no/irrelevant/partly", "note": "可选的极短提示（按对局语言），没有就空字符串" }`;
}

// 判定玩家的"揭晓答案"是否说中了汤底核心。
export function buildSoupJudgePrompt(surface: string, bottom: string) {
  return `你是这道海龟汤的主持人。汤面：${surface}
汤底（机密标准答案）：${bottom}

玩家给出了他们对真相的完整猜测。请判断他们是否**说中了汤底的核心因果**（不需要每个细节都对，但关键的动机/经过/反转要对）。
只输出 JSON：{ "solved": true或false, "comment": "一句话裁定，告诉他们对在哪/差在哪，但若未解开不要泄露完整汤底" }`;
}
