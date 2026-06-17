// 战役记忆：把早期历史压缩成滚动摘要 + 不可遗忘的关键事实，控制 token 不随时长爆炸。
export const SUMMARIZE_EVERY = 4; // 每多少回合压缩一次

export function buildSummarizerSystem() {
  return `你是一场跑团战役的"记忆官"。你的任务是把剧情压缩成简洁、对后续推进真正有用的记忆，不要流水账、不要文学描写。

请基于"此前摘要 + 已知关键事实 + 最近发生的内容"，输出更新后的记忆：
- summary：300 字以内的滚动摘要，保留对后续重要的信息：当前进展、地点、NPC 的关系与态度、双方调查员各自发现了什么、未解的疑点、嫌疑与精神状态的走向。
- key_facts：不可遗忘的硬事实清单（短句），例如"王病人已死"、"A 拿到撕角船票"、"地下室门已被撬开"、"护士开始巡逻"。只列确定发生、且影响后续的事实；已被推翻的旧事实要移除。

只输出 JSON：{"summary":"...","key_facts":["...","..."]}`;
}

// 注入给叙述器的记忆文本块
export function formatMemoryBlock(memory: any): string {
  const summary = memory?.summary?.trim();
  const facts = Array.isArray(memory?.key_facts) ? memory.key_facts : [];
  if (!summary && !facts.length) return '';
  return `
【战役记忆 · 截至前文的压缩摘要】${summary || '（暂无）'}
【不可遗忘的关键事实】${facts.length ? facts.join('；') : '（暂无）'}`;
}
