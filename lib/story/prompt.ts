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
export function buildStoryRevisePrompt(story: string, rating: any, p: any, genre: string, lang?: string, userNote?: string, intensity?: 'light' | 'medium' | 'deep') {
  const en = lang === 'en';
  const dims = (Array.isArray(rating?.dimensions) ? rating.dimensions : []).map((d: any) => ({ ...d, score: Number(d?.score) || 0 }));
  // 改稿目标：所有"还没到 9 分"的维度，分数低的优先，连同评审的扣分理由一起喂给 AI
  const wOf = (k: string) => (STORY_RATE_DIMS.find((x) => x.key === k)?.w ?? 6);
  const targets = dims.filter((d: any) => d.score < 9).sort((a: any, b: any) => (10 - b.score) * wOf(b.key) - (10 - a.score) * wOf(a.key)).slice(0, 10)
    .map((d: any) => `「${d.label}」当前 ${d.score}/10（权重${wOf(d.key)}）— 扣分原因：${d.note || '还能更好'}`).join('\n  ');
  const allDimLine = dims.map((d: any) => `${d.label} ${d.score}`).join('、');
  return `你是一位顶尖的文学编辑兼作者。下面这篇故事经过严苛评审，总分 ${rating?.overall ?? '未知'}/100。请**在保留它原有优点的前提下重写一稿，目标是把总分冲到 90+**。
题材：${genre}。
当前各维度（满分10）：${allDimLine || '未知'}
评审一句话总评：${rating?.verdict || ''}
最关键改进建议：${rating?.improve || ''}${rating?.capReasons?.length ? `\n当前被结构性封顶在 ${rating.cap} 分，原因：${rating.capReasons.join('、')} —— 不解决这些就突破不了，请优先动它们。` : ''}${rating?.potential?.best_fix ? `\n评审建议的最有效结构改法：${rating.potential.best_fix}` : ''}${userNote && userNote.trim() ? `\n\n【⭐ 玩家本次特别要求 —— 最高优先，必须照做】\n${userNote.trim()}` : ''}

【必须逐条攻克的维度（把每一项都提到 9~10）】
  ${targets || (rating?.improve || '整体打磨')}

改稿强度：${intensity === 'light' ? '【轻改 · 只润色】只改语言、节奏、删废话、强化画面与具体细节；严禁改动主线、人物关系功能、结尾逻辑、世界设定。目标 +1~3 分。' : intensity === 'medium' ? '【中改 · 增强】保留主线与设定骨架，但可以新增/替换 1~2 个具体强事件场景、删减中段解释设定、强化某个人物关系的"剧情作用"。目标 +3~6 分。' : `【深改 · 冲90】必须做结构级改动，不许只润色：${rating?.potential?.best_fix ? `本轮的核心改动就是落地这条最优改法——「${rating.potential.best_fix}」，围绕它重组剧情。` : '重构人物关系功能、把"解释设定"改成"具体发生"的事件、加一个中段强事件、重做结尾的不可替代回扣。'}${rating?.capReasons?.length ? `并彻底消除这些封顶硬伤：${rating.capReasons.join('、')}。` : ''}大胆改、敢动主线骨架，目标 ${rating?.potential?.deep_max || 90}+。`}

改稿纪律（核心：不要只润色句子，而是修复距 90 的结构性短板）：
- 先判断本文距 90 的结构性短板，**优先修复上面"必须攻克"里权重高、分数低的项**；不要把时间花在已经高分的文笔/氛围/开头上——那些保持别动。
- **若仅靠润色无法到 90，必须做结构级修改**（动人物功能、动中段事件、动结尾回扣），而不是把句子写得更华丽。反例：把"那颗星像眼睛"改成"如古老神祇的瞳孔缓缓张开"——更华丽但不涨分；正例：让那颗星同时倒映在冰原裂缝与主角眼里，并回扣配角离开前说过的一句话——这才把多个评分项一起拉起来。
- 对上面每个目标维度按其扣分原因做实质修改，不是换词。
- 保留原作已被肯定的亮点（${(Array.isArray(rating?.highlights) ? rating.highlights.join('、') : '') || '原有打动人的部分'}），不要推倒重来导致跑题。
- 仍是 ${en ? 'English' : '中文'}、约 ${en ? '1300~1800 words' : '1600~2200 字'}、约 10 分钟阅读；严格遵守原参数的"特别要求"与"必须避免"。
参数：
${paramBlock(p)}
只输出 JSON：{ "title": "标题", "story": "改写后的完整故事正文（可含换行）" }

原故事：
${String(story).slice(0, 6000)}`;
}

// 评分维度表（每项 0~10，带权重 w；总分=加权归一到 100）。借鉴 Jestaz 的四大类设计，分离"写得漂亮"与"故事好"。
export const STORY_RATE_DIMS: { key: string; label: string; w: number; hint: string }[] = [
  { key: 'hook',         label: '开头钩子',        w: 8, hint: '30秒内有钩子（出事了/异常/选择/悬念）；只慢慢介绍设定人物地点→低分' },
  { key: 'mainline',     label: '主线清晰',        w: 8, hint: '一句话能概括（一个主角+一个异常+逐步逼近真相+落点）；人物设定解释太多像"简介"→低分' },
  { key: 'pacing',       label: '节奏推进',        w: 8, hint: '符合10分钟节拍，中段不拖、不堆说明文' },
  { key: 'conflict',     label: '冲突强度',        w: 8, hint: '外部压力+内部挣扎都要有；只是"讲了一件事"无对抗→低分' },
  { key: 'desire',       label: '人物欲望',        w: 6, hint: '主角有明确"想要的东西"' },
  { key: 'change',       label: '人物转变',        w: 6, hint: '主角有"主动"的变化，而非全程被事情推着走' },
  { key: 'relationship', label: '人物关系功能',    w: 8, hint: '关键关系要"推动剧情"——成为最后的选择/阻止/结局的原因；只是出场让主角显得可怜（工具人）→低分' },
  { key: 'emotion',      label: '情绪递进',        w: 8, hint: '情绪有层次地推进变化，不是从头到尾一个情绪' },
  { key: 'infoburden',   label: '信息控制·解释负担', w: 8, hint: '信息自然从事件里露出、真相能回扣前文；中段大段讲设定、名词太多、要记一堆规则才懂→低分' },
  { key: 'concrete',     label: '具体化程度',      w: 8, hint: '用具体事件/画面承载情绪，而非抽象概念。"墙上刻着自己明天才会写的字"高分；"时间与存在的边界正在崩坏""不可名状/永恒回响"堆砌→低分' },
  { key: 'detail',       label: '记忆点细节',      w: 6, hint: '有能被记住、承载情感/恐惧的标志性物件' },
  { key: 'ending',       label: '结尾力度',        w: 8, hint: '有"落点"（反转/释怀/回扣/余味）；"鬼把他杀了""原来是梦""最后全解释清楚"→低分' },
  { key: 'retell',       label: '可复述性',        w: 6, hint: '听完能一句话清楚转述给朋友（人物+异常+真相+选择）；只能说"很宏大很克苏鲁"→低分' },
  { key: 'language',     label: '语言画面',        w: 8, hint: '好懂、有画面，show不tell' },
  { key: 'genrefx',      label: '类型专属效果',    w: 6, hint: '按题材打：恐怖=不安递增/日常污染/未知保留/无退路/后劲余寒；温情=情感克制/关系真实/细节承载爱/前后回扣/余温；悬疑=谜题吸引/线索公平/误导有效/真相合理/揭示爽感；喜剧=笑点密度/反差/升级/人物认真感/结尾包袱' },
];
const STORY_DIM_W: Record<string, number> = Object.fromEntries(STORY_RATE_DIMS.map((d) => [d.key, d.w]));

// 加权归一：每维 0~10 × 权重，求和后归一到 0~100（一位小数）。保证显示分=明细加权结果。
export function normalizeStoryRating(r: any): any {
  if (!r || !Array.isArray(r.dimensions) || !r.dimensions.length) return r;
  const dims = r.dimensions.map((d: any) => ({ ...d, score: Math.max(0, Math.min(10, Number(d.score) || 0)) }));
  let num = 0, den = 0;
  for (const d of dims) { const w = STORY_DIM_W[d.key] ?? 6; num += d.score * w; den += 10 * w; }
  let overall = den ? Math.round((num / den) * 1000) / 10 : 0;
  // 结构性封顶（虚高检测）：文笔再好，结构硬伤也压住总分——逼用户做结构级改动才能突破
  const sc = (k: string) => { const d = dims.find((x: any) => x.key === k); return d ? d.score : 10; };
  let cap = 100; const reasons: string[] = [];
  const hit = (c: number, why: string) => { if (c < cap) cap = c; reasons.push(why); };
  if (sc('mainline') < 5) hit(75, '主线不清');
  if (sc('conflict') < 5) hit(78, '没有明确冲突');
  if (sc('ending') < 5) hit(80, '结尾没有落点');
  if (sc('genrefx') <= 5) hit(82, '类型核心效果不足');
  if (sc('infoburden') <= 6) hit(86, '中段主要靠解释设定');
  if (sc('relationship') <= 6) hit(88, '人物关系不推动剧情');
  if (sc('retell') <= 6) hit(88, '可复述性弱');
  const capped = Math.min(overall, cap);
  return { ...r, dimensions: dims, overall: capped, ...(cap < 100 ? { cap, capReasons: reasons } : {}) };
}

// 多维精确评分：四大类（类型完成度/故事结构/人物情感/表达与传播）拆成 15 个带权维度。
export function buildStoryRatePrompt(story: string, genre: string, lang?: string) {
  const en = lang === 'en';
  const lines = STORY_RATE_DIMS.map((d, i) => `${i + 1} ${d.key} ${d.label}(权重${d.w})：${d.hint}`).join('\n');
  const tmpl = STORY_RATE_DIMS.map((d) => `    { "key": "${d.key}", "label": "${d.label}", "score": 0, "note": "" }`).join(',\n');
  return `你是一位专业、公正的短篇故事评审。这是一篇"约 10 分钟口述故事"。请逐项打分——既严谨有区分度，也要公平：真正做到位的维度就给该有的高分，但**绝不只奖励"文笔漂亮"**，要同样看重"故事是否好听、好记、好转述、不靠堆抽象概念"。
故事题材：${genre}。

【15 个维度，每项 0~10 分（系统会按权重换算总分，所以请如实评、别都给 8~9）】
${lines}

【打分锚点】9~10 该维度出色/几近完美；8 优秀小瑕；6~7 合格但普通；4~5 平庸有明显问题；0~3 缺失或很差。一篇好故事通常有 3~6 项落 9~10，但"具体化/解释负担/可复述/人物关系功能"这类难项要如实，AI 味浓、靠抽象词撑场面的就压到 5~7。
【总分参考】普通 70~79；优秀 80~88；卓越 89~94；殿堂 95+。明显优秀的故事应落在 84~90。

只输出 JSON（语言：${en ? 'English' : '中文'}）：
{
  "dimensions": [
${tmpl}
  ],
  "overall": 0,
  "tags": ["3~5 个风格标签"],
  "verdict": "一句话总评",
  "highlights": ["1~2 个亮点"],
  "improve": "一句最关键的可改进点",
  "read_minutes": 10,
  "potential": { "light_max": 0, "medium_max": 0, "deep_max": 0, "blockers": ["拖分主因 2~3 条，点名是哪几个维度、为什么"], "best_fix": "最有效的一个结构级改法（具体到怎么改）" }
}

【改稿潜力 potential（务必如实，别乐观）】light_max=只润色语言/节奏/画面、不动结构能到的上限；medium_max=保留主线但加/换关键场景、删解释、强化人物关系剧情作用能到的上限；deep_max=允许改结构/人物关系/结尾回扣能到的上限。**关键认知：文笔、氛围、开头已经很高的故事，靠润色到不了 90——要 90 必须让"人物关系真正推动剧情、中段有具体强事件、结尾产生不可替代的回扣、恐怖从解释设定变成具体发生、听众能一句话复述"。** blockers 要诚实点名这些结构短板。

故事正文：
${String(story).slice(0, 6000)}`;
}
