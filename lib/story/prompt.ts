// 讲故事模式 prompts：按参数生成 3 个 ~10 分钟故事选项 → 写全文 → 多维精确评分。

export const STORY_GENRES: { key: string; cn: string; en: string }[] = [
  { key: 'heal', cn: '治愈温馨', en: 'Heartwarming' },
  { key: 'romance', cn: '浪漫爱情', en: 'Romance' },
  { key: 'sweet', cn: '甜宠', en: 'Sweet & Fluffy' },
  { key: 'tearjerker', cn: '催泪', en: 'Tearjerker' },
  { key: 'horror', cn: '恐怖', en: 'Horror' },
  { key: 'suspense', cn: '悬疑推理', en: 'Mystery / Suspense' },
  { key: 'fantasy', cn: '奇幻', en: 'Fantasy' },
  { key: 'scifi', cn: '科幻', en: 'Sci-fi' },
  { key: 'ancient', cn: '古风', en: 'Ancient / Wuxia' },
  { key: 'fairy', cn: '童话', en: 'Fairy tale' },
  { key: 'bedtime', cn: '睡前轻松', en: 'Bedtime' },
];
// 恐怖体系细分（仅当选了"恐怖"时出现）
export const STORY_HORROR_SUB: { key: string; cn: string; en: string }[] = [
  { key: 'cthulhu', cn: '克苏鲁 / 宇宙恐怖', en: 'Cthulhu / Cosmic' },
  { key: 'chinese', cn: '中式恐怖', en: 'Chinese horror' },
  { key: 'jp', cn: '日式怪谈', en: 'Japanese kaidan' },
  { key: 'folk', cn: '民俗恐怖', en: 'Folk horror' },
  { key: 'psych', cn: '心理恐怖', en: 'Psychological' },
  { key: 'urban', cn: '都市传说', en: 'Urban legend' },
  { key: 'survival', cn: '生存恐怖', en: 'Survival' },
];
export const STORY_TONES: { key: string; cn: string; en: string }[] = [
  { key: 'tender', cn: '温柔', en: 'Tender' }, { key: 'passion', cn: '热烈', en: 'Passionate' },
  { key: 'melancholy', cn: '忧伤', en: 'Melancholy' }, { key: 'tense', cn: '紧张', en: 'Tense' },
  { key: 'sweet', cn: '甜蜜', en: 'Sweet' }, { key: 'dark', cn: '暗黑', en: 'Dark' },
  { key: 'nostalgic', cn: '怀旧', en: 'Nostalgic' }, { key: 'mysterious', cn: '神秘', en: 'Mysterious' },
];

function paramBlock(p: any) {
  const g = (Array.isArray(p?.genres) ? p.genres : []).map((k: string) => STORY_GENRES.find((x) => x.key === k)?.cn || k).join('、');
  const hs = (Array.isArray(p?.horror_sub) ? p.horror_sub : []).map((k: string) => STORY_HORROR_SUB.find((x) => x.key === k)?.cn || k).join('、');
  const t = STORY_TONES.find((x) => x.key === p?.tone)?.cn || p?.tone || '不限';
  return `- 题材/风格（可多选）：${g || '不限（你来定，三个各不相同）'}${hs ? `\n- 恐怖体系细分：${hs}（严格贴合该体系的设定、氛围与套路）` : ''}
- 基调：${t}
- 主角/称呼：${p?.hero || '由你设定一个名字'}
- 想表达的主题/情绪：${p?.theme || '不限'}
- 背景/世界：${p?.world || '不限'}
- 特别要求：${p?.special || '无'}
- 必须避免：${p?.forbidden || '无'}
- 单篇阅读时长：约 10 分钟（中文约 1600~2200 字 / 英文约 1300~1800 词）`;
}

// 生成 3 个故事选项（玩家可见的引子 + 一个快速吸引力分）
export function buildStoryOptionsPrompt(p: any, lang?: string) {
  const en = lang === 'en';
  return `你是一位极擅长讲故事的作者，要为一个特别的人写一篇约 10 分钟的故事。先给出 **3 个风格迥异**的故事方案供挑选。
参数：
${paramBlock(p)}
每个方案给：title 标题、genre 题材一句话、logline 一句话钩子（不剧透结局）、mood 基调、est_minutes 预计分钟、appeal 吸引力分(0-100，真实评估、别都打高分)。3 个尽量不同。
只输出 JSON（语言：${en ? 'English' : '中文'}）：
{ "options": [ { "title": "", "genre": "", "logline": "", "mood": "", "est_minutes": 10, "appeal": 0 } ] }`;
}

// 写出选中方案的完整故事
export function buildStoryWritePrompt(chosen: any, p: any, lang?: string) {
  const en = lang === 'en';
  return `你是一位极擅长讲故事的作者。请把下面这个方案写成**完整的、约 10 分钟阅读**的故事。
方案：《${chosen?.title || ''}》｜${chosen?.genre || ''}｜钩子：${chosen?.logline || ''}｜基调：${chosen?.mood || ''}
参数：
${paramBlock(p)}
写作要求：
- ${en ? 'English' : '中文'}写作，约 ${en ? '1300~1800 words' : '1600~2200 字'}；情感真挚、有画面感、有起伏。
- 开头抓人，中段有推进与转折，结尾给一个有力量/有余味的收束（治愈类温暖、恐怖类有冲击、催泪类有泪点）。
- 若给了主角/称呼，就把 TA 写进故事；严格遵守"特别要求"与"必须避免"。
- 直接输出故事正文，不要解释、不要标题外的元信息。
只输出 JSON：{ "title": "最终标题", "story": "完整故事正文（可含换行）" }`;
}

// AI 改稿：针对评分弱项重写以提升分数（保留亮点，不是推倒重来）
export function buildStoryRevisePrompt(story: string, rating: any, p: any, genre: string, lang?: string, userNote?: string) {
  const en = lang === 'en';
  const dims = (Array.isArray(rating?.dimensions) ? rating.dimensions : []).map((d: any) => ({ ...d, score: Number(d?.score) || 0 }));
  // 改稿目标：所有"还没到 9 分"的维度，分数低的优先，连同评审的扣分理由一起喂给 AI
  const targets = dims.filter((d: any) => d.score < 9).sort((a: any, b: any) => a.score - b.score).slice(0, 10)
    .map((d: any) => `「${d.label}」当前 ${d.score}/10 — 扣分原因：${d.note || '还能更好'}`).join('\n  ');
  const allDimLine = dims.map((d: any) => `${d.label} ${d.score}`).join('、');
  return `你是一位顶尖的文学编辑兼作者。下面这篇故事经过严苛评审，总分 ${rating?.overall ?? '未知'}/100。请**在保留它原有优点的前提下重写一稿，目标是把总分冲到 90+**。
题材：${genre}。
当前各维度（满分10）：${allDimLine || '未知'}
评审一句话总评：${rating?.verdict || ''}
最关键改进建议：${rating?.improve || ''}${userNote && userNote.trim() ? `\n\n【⭐ 玩家本次特别要求 —— 最高优先，必须照做】\n${userNote.trim()}` : ''}

【必须逐条攻克的维度（把每一项都提到 9~10）】
  ${targets || (rating?.improve || '整体打磨')}

改稿纪律：
- **对上面列出的每一个维度，都按它的扣分原因做实质性修改**，不是换几个词。比如：信息控制差→删掉结尾的解释性段落、改用意象/留白暗示；记忆点细节差→加一个贯穿全篇、能被记住的标志性物件；台词复述差→把独白改写成有张力的对话、并让整篇能被人转述；情感张力差→把"叙述情绪"改成"用具体动作和细节让人自己感到"；结尾差→给一个有落点的反转或余味。
- 7、8 分的维度也要往 9、10 推，别停在"还行"。
- 保留原作的核心设定与已被肯定的亮点（${(Array.isArray(rating?.highlights) ? rating.highlights.join('、') : '') || '原有打动人的部分'}），不要推倒重来导致跑题。
- 仍是 ${en ? 'English' : '中文'}、约 ${en ? '1300~1800 words' : '1600~2200 字'}、约 10 分钟阅读；严格遵守原参数的"特别要求"与"必须避免"。
参数：
${paramBlock(p)}
只输出 JSON：{ "title": "标题", "story": "改写后的完整故事正文（可含换行）" }

原故事：
${String(story).slice(0, 6000)}`;
}

// 用各维度之和（每项0~10）换算成 0~100 总分，并写回 rating.overall —— 保证显示分=明细分
export function normalizeStoryRating(r: any): any {
  if (!r || !Array.isArray(r.dimensions) || !r.dimensions.length) return r;
  const dims = r.dimensions.map((d: any) => ({ ...d, score: Math.max(0, Math.min(10, Number(d.score) || 0)) }));
  const sum = dims.reduce((a: number, d: any) => a + d.score, 0);
  const overall = Math.round((sum / (dims.length * 10)) * 1000) / 10; // 一位小数
  return { ...r, dimensions: dims, overall };
}

// 多维精确评分（14 维度，每项 0~10；总分由各维之和换算，保证显示分=明细分）
export function buildStoryRatePrompt(story: string, genre: string, lang?: string) {
  const en = lang === 'en';
  return `你是一位专业、公正的短篇故事评审。这是一篇"约 10 分钟口述故事"。请按下面这套**精确标准**逐项打分——既要严谨有区分度，也要**公平**：真正做到位的维度就要给到该有的高分，不要反射性压分。
故事题材：${genre}。

【评分标准 · 14 项，每项 0~10 分（允许 7、8 这类，不要清一色给满）】
1 hook 开头钩子：是否 30 秒内就有钩子（"出事了/有个不正常的东西/主角必须做选择/一个温柔或恐怖的悬念"）。只是慢慢介绍设定人物地点 → 6 分以下。
2 emotional 情感张力：是否有真正的情绪冲击力，而非平淡叙述。恐怖→不安压迫；温情→遗憾被爱释怀；悲伤→"本可更好却来不及"。
3 fit 类型契合：有没有兑现类型承诺。恐怖不止出现鬼、温情不止让人哭、悬疑要让人想猜、喜剧要逻辑越来越离谱而人物还认真。
4 mainline 主线清晰：能否一句话概括（一个主角 + 一个异常 + 逐步逼近真相 + 结尾反转/释放）。人物/设定/解释太多像"简介" → 低分。
5 conflict 冲突强度：是否有压力（外部：鬼在靠近/时间快到/出不去；内部：不敢面对/原谅/说出口）。只"讲了一件事"无冲突 → 低分。
6 info 信息控制：听众应"一直知道一点点，永远差最后一块"。给太早或最后才突然解释一大堆 → 低分。恐怖尤其先给迹象（门锁自己反了/镜中钟慢三分/邻居说"你不是一个人住吗"）。
7 pacing 节奏推进：是否符合 10 分钟节拍（0-1 钩子｜1-4 立人物与异常｜4-7 升级冲突｜7-9 揭真相/做选择｜9-10 留余味）。恐怖避免一上来鬼就冲出来，温情避免一上来就煽情。
8 arc 情绪曲线：情绪要变化推进（恐怖：平静→奇怪→不安→恐惧→余寒；温情：日常→误解→遗憾→理解→释怀）。从头到尾一个情绪 → 低分。
9 change 人物转变与欲望：主角要有明确欲望并最好有转变（不信鬼→不得不信；恨父亲→理解父亲；逃避→主动打开那扇门）。被推着走、毫无变化 → 低分。
10 detail 记忆点细节：是否有能被记住、承载情感/恐惧的标志性物件（永不灭的灯/不会叫的黑猫/没寄出的信/门后的童谣）。
11 atmosphere 氛围营造：场景质感与代入感是否到位、足够浓郁。
12 ending 结尾力度：必须有"落点"（恐怖反转/温情释怀/悲剧回扣/开放余味）。烂结尾（"鬼把他杀了""他们都哭了""原来是一场梦""最后全解释清楚"）→ 低分。
13 language 语言画面感：好懂、有画面（"门缝下那双脚，脚尖朝着天花板"胜过"难以名状的恐惧"）。抽象空泛 → 低分。
14 dialogue 台词与可复述：台词像人说话而非作者解释主题；整篇能被听众转述给别人。散到复述不出 → 低分。

【每项打分锚点（0~10，公平校准，别把好维度习惯性压在 7~8）】
- 9~10：该维度做得出色/几近完美（短篇里只要这一项真的强，就该给 9；接近无可挑剔给 10）。一篇好故事通常会有 3~6 个维度落在 9~10。
- 8：明确做到位、优秀，只有很小的不足。
- 6~7：合格但普通，有可见短板。
- 4~5：平庸、有明显问题。
- 0~3：缺失或很差。
【总分参考分布（=各维度之和换算）】普通 70~79；优秀 80~88；卓越 89~94；殿堂级 95+。一篇明显优秀的故事就应该落在 84~90，别无故压到 80 以下。
【纪律】每项给 0~10 的整数并附 ≤14 字理由；扣分要有具体依据，给高分也要敢给。系统用各维度之和换算总分，请如实评价、不夸大也不刻意压低。

只输出 JSON（语言：${en ? 'English' : '中文'}）：
{
  "dimensions": [
    { "key": "hook", "label": "开头钩子", "score": 0, "note": "" },
    { "key": "emotional", "label": "情感张力", "score": 0, "note": "" },
    { "key": "fit", "label": "类型契合", "score": 0, "note": "" },
    { "key": "mainline", "label": "主线清晰", "score": 0, "note": "" },
    { "key": "conflict", "label": "冲突强度", "score": 0, "note": "" },
    { "key": "info", "label": "信息控制", "score": 0, "note": "" },
    { "key": "pacing", "label": "节奏推进", "score": 0, "note": "" },
    { "key": "arc", "label": "情绪曲线", "score": 0, "note": "" },
    { "key": "change", "label": "人物转变", "score": 0, "note": "" },
    { "key": "detail", "label": "记忆点细节", "score": 0, "note": "" },
    { "key": "atmosphere", "label": "氛围营造", "score": 0, "note": "" },
    { "key": "ending", "label": "结尾力度", "score": 0, "note": "" },
    { "key": "language", "label": "语言画面", "score": 0, "note": "" },
    { "key": "dialogue", "label": "台词复述", "score": 0, "note": "" }
  ],
  "overall": 0,
  "tags": ["3~5 个风格标签"],
  "verdict": "一句话总评",
  "highlights": ["1~2 个亮点"],
  "improve": "一句最关键的可改进点",
  "read_minutes": 10
}

故事正文：
${String(story).slice(0, 6000)}`;
}
