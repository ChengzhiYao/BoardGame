// 讲故事模式 prompts：按参数生成 3 个 ~10 分钟故事选项 → 写全文 → 多维精确评分。

export const STORY_GENRES: { key: string; cn: string; en: string }[] = [
  { key: 'heal', cn: '温馨治愈', en: 'Heartwarming' },
  { key: 'romance', cn: '浪漫爱情', en: 'Romance' },
  { key: 'sweet', cn: '甜宠日常', en: 'Sweet & Fluffy' },
  { key: 'tearjerker', cn: '催泪虐心', en: 'Tearjerker' },
  { key: 'horror', cn: '恐怖', en: 'Horror' },
  { key: 'thriller', cn: '惊悚悬疑', en: 'Thriller / Suspense' },
  { key: 'mystery', cn: '推理悬疑', en: 'Mystery' },
  { key: 'fantasy', cn: '奇幻', en: 'Fantasy' },
  { key: 'scifi', cn: '科幻', en: 'Sci-fi' },
  { key: 'fairy', cn: '童话寓言', en: 'Fairy tale' },
  { key: 'ancient', cn: '古风', en: 'Historical / Ancient' },
  { key: 'urban', cn: '都市言情', en: 'Urban romance' },
  { key: 'slice', cn: '治愈日常', en: 'Slice of life' },
  { key: 'reflective', cn: '哲思治愈', en: 'Reflective' },
  { key: 'darkcomedy', cn: '黑色幽默', en: 'Dark comedy' },
  { key: 'bedtime', cn: '睡前轻松', en: 'Bedtime' },
];
export const STORY_TONES: { key: string; cn: string; en: string }[] = [
  { key: 'tender', cn: '温柔', en: 'Tender' }, { key: 'passion', cn: '热烈', en: 'Passionate' },
  { key: 'melancholy', cn: '忧伤', en: 'Melancholy' }, { key: 'tense', cn: '紧张', en: 'Tense' },
  { key: 'sweet', cn: '甜蜜', en: 'Sweet' }, { key: 'dark', cn: '暗黑', en: 'Dark' },
  { key: 'nostalgic', cn: '怀旧', en: 'Nostalgic' }, { key: 'mysterious', cn: '神秘', en: 'Mysterious' },
];

function paramBlock(p: any) {
  const g = (Array.isArray(p?.genres) ? p.genres : []).map((k: string) => STORY_GENRES.find((x) => x.key === k)?.cn || k).join('、');
  const t = STORY_TONES.find((x) => x.key === p?.tone)?.cn || p?.tone || '不限';
  return `- 题材/风格（可多选）：${g || '不限（你来定，三个各不相同）'}
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

// 多维精确评分（严格、挑剔、给具体分数与理由）
export function buildStoryRatePrompt(story: string, genre: string, lang?: string) {
  const en = lang === 'en';
  return `你是一位严苛的文学评审。对下面这篇故事做**精确、可信、有区分度**的打分——好就高、弱就低，绝不一律打高分。
故事题材：${genre}。
按以下 10 个维度各打 0~100 的**具体整数**（不要都给整十的圆数），每个维度给 ≤14 字的中肯理由：
1 emotional 情感张力 ｜ 2 prose 文笔语言 ｜ 3 immersion 沉浸代入 ｜ 4 pacing 节奏掌控 ｜ 5 character 角色塑造 ｜ 6 surprise 意外与转折 ｜ 7 atmosphere 氛围营造 ｜ 8 ending 结局收束 ｜ 9 originality 原创新意 ｜ 10 fit 题材契合
再给一个**题材专属维度** flavor（如治愈类给"治愈度"、恐怖类给"恐怖度"、催泪类给"泪点"、甜宠给"甜度"、悬疑给"悬疑度"），含 label 与 score。
overall 为加权总分（情感×2、文笔×1.5、沉浸×1.5、结局×1.5、其余×1，取一位小数）。
只输出 JSON（语言：${en ? 'English' : '中文'}）：
{
  "dimensions": [ { "key": "emotional", "label": "情感张力", "score": 0, "note": "" } ],
  "flavor": { "label": "", "score": 0 },
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
