import { SEO_GAMES } from '@/lib/seo-content';

export const BLOG_RATE_DIMS: { key: string; label: string; w: number; hint: string }[] = [
  { key: 'hook', label: '开头钩子', w: 8, hint: '前两句就抓住读者或点出价值，不是泛泛开场/正确的废话' },
  { key: 'useful', label: '实用价值', w: 9, hint: '读者真能学到/获得具体东西；空泛、人尽皆知→低分' },
  { key: 'keyword', label: '关键词覆盖', w: 7, hint: '目标长尾词自然出现在标题/小标题/正文；堆砌或答非所问→低分' },
  { key: 'structure', label: '结构清晰', w: 7, hint: '有小标题、可扫读、逻辑顺；一坨到底→低分' },
  { key: 'concrete', label: '具体化', w: 8, hint: '用具体例子/场景/数字承载观点，而非抽象空话' },
  { key: 'angle', label: '观点角度', w: 6, hint: '有真实角度或新意；百度百科式罗列→低分' },
  { key: 'cta', label: '引导转化', w: 6, hint: '自然引到去试玩 MystNight 且有内链；不引导或硬广尬吹→低分' },
  { key: 'language', label: '语言流畅', w: 7, hint: '好读、不 AI 腔、不重复啰嗦' },
  { key: 'retell', label: '一句话价值', w: 6, hint: '读完能一句话说出收获/为什么值得读' },
];
const W: Record<string, number> = Object.fromEntries(BLOG_RATE_DIMS.map((d) => [d.key, d.w]));

export function normalizeBlogRating(r: any): any {
  if (!r || !Array.isArray(r.dimensions) || !r.dimensions.length) return r;
  const dims = r.dimensions.map((d: any) => ({ ...d, score: Math.max(0, Math.min(10, Number(d.score) || 0)) }));
  let num = 0, den = 0;
  for (const d of dims) { const w = W[d.key] ?? 6; num += d.score * w; den += 10 * w; }
  const overall = den ? Math.round((num / den) * 1000) / 10 : 0;
  const sc = (k: string) => { const d = dims.find((x: any) => x.key === k); return d ? d.score : 10; };
  let cap = 100; const reasons: string[] = [];
  const hit = (c: number, why: string) => { if (c < cap) cap = c; reasons.push(why); };
  if (sc('useful') < 4) hit(80, '实用价值不足');
  if (sc('keyword') < 4) hit(85, '关键词覆盖弱');
  if (sc('structure') < 4) hit(85, '结构松散');
  if (sc('language') <= 3) hit(86, '语言生硬/AI腔');
  const capped = Math.min(overall, cap);
  return { ...r, dimensions: dims, overall: capped, raw: overall, ...(cap < 100 ? { cap, capReasons: reasons } : {}) };
}

const gamesList = (en: boolean) => SEO_GAMES.map((g) => `- ${en ? g.en.name : g.zh.name} → /games/${g.slug}`).join('\n');

export function buildBlogWritePrompt(topic: string, keywords: string, lang?: string) {
  const en = lang === 'en';
  const system = en
    ? `You are an expert SEO content writer for MystNight (mystnight.com), a site where an AI hosts tabletop games — murder mystery, Cthulhu, D&D, lateral-thinking soup, truth or dare, an original card game and social deduction — for two players or a full table. Write a genuinely useful, engaging blog post that ranks for long-tail searches and gently leads readers to try the games. Rules: clean HTML only using <h2>, <p>, <strong>, <a>; 600-900 words; cover the target keywords naturally in the title, headings and body; include 1-3 internal links to relevant game pages using the EXACT paths below; end with one soft call-to-action; no fluff, no AI clichés, no repetition, no code fences, no <h1>.\nGame pages you may link to:\n${gamesList(true)}`
    : `你是 MystNight(mystnight.com)的资深 SEO 内容写手。MystNight 是"AI 当主持人陪你玩桌游"的网站（剧本杀、克苏鲁跑团、D&D、海龟汤、真心话大冒险、原创卡牌、社交推理），两个人就能玩。请写一篇真正有用、好读、能命中长尾搜索、并自然引导读者去试玩的博客文章。规则：只用干净 HTML（<h2><p><strong><a>，不要 <h1>）；约 700~1000 字；目标关键词自然出现在标题/小标题/正文；正文里用下面给的准确路径插 1~3 个游戏页内链；结尾一句不尬的引导去玩；不要正确的废话、不要 AI 腔、不要重复、不要代码块。\n可内链的游戏页：\n${gamesList(false)}`;
  const user = en
    ? `Topic: ${topic}\nTarget keywords: ${keywords || topic}\nOutput ONLY JSON: { "title": "compelling SEO title", "slug": "kebab-case-english-seo-slug", "excerpt": "1-2 sentence summary", "html": "<h2>..</h2><p>..</p>" }`
    : `主题：${topic}\n目标关键词：${keywords || topic}\n只输出 JSON：{ "title":"吸引人的中文 SEO 标题", "slug":"kebab-case-english-seo-slug", "excerpt":"一两句话摘要", "html":"<h2>..</h2><p>..</p>" }`;
  return { system, user };
}

export function buildBlogRatePrompt(title: string, html: string, keywords: string, lang?: string) {
  const lines = BLOG_RATE_DIMS.map((d, i) => `${i + 1} ${d.key} ${d.label}(权重${d.w})：${d.hint}`).join('\n');
  const tmpl = BLOG_RATE_DIMS.map((d) => `    { "key": "${d.key}", "label": "${d.label}", "score": 0, "note": "" }`).join(',\n');
  const system = `你是严格但公正的 SEO 内容编辑，给一篇博客文章逐项打分（每项 0~10，系统按权重换算总分，请如实评、有区分度，别都给 8~9）。目标关键词：${keywords}。
维度：
${lines}
锚点：9~10 出色；8 优秀小瑕；6~7 合格但普通；4~5 平庸有明显问题；0~3 差。一篇真正有用、好读、结构清晰、自然带内链的文章应到 85+。
只输出 JSON：
{ "dimensions": [
${tmpl}
  ], "overall": 0, "verdict": "一句话总评", "improve": "一句最关键的改进点" }`;
  const user = `标题：${title}\n正文 HTML：\n${String(html).slice(0, 7000)}`;
  return { system, user };
}

export function slugify(s: string) {
  const base = (s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
  return base || ('post-' + Date.now().toString(36));
}

export function buildBlogTranslatePrompt(title: string, html: string, excerpt: string, toLang: 'zh' | 'en') {
  const toEn = toLang === 'en';
  const system = toEn
    ? `You are a bilingual editor for MystNight (an AI-hosted tabletop games site). Translate and LOCALIZE the blog post below into natural, fluent English — not a literal translation; it should read like it was written in English. Keep the HTML structure and tags (<h2>, <p>, <strong>, <a>). Keep every internal link path (e.g. /games/cthulhu) EXACTLY as-is. No <h1>, no code fences.`
    : `你是 MystNight（AI 主持桌游网站）的双语编辑。把下面这篇博客文章自然地翻译并本地化成流畅的中文——不要逐字直译，读起来要像中文原创。保留 HTML 结构与标签（<h2><p><strong><a>）。所有站内链接路径（如 /games/cthulhu）原样保留。不要 <h1>，不要代码块。`;
  const user = toEn
    ? `Translate this post to English. Output ONLY JSON: { "title": "...", "excerpt": "1-2 sentence summary", "html": "<h2>..</h2><p>..</p>" }\n\nTITLE: ${title}\nEXCERPT: ${excerpt}\nHTML:\n${String(html).slice(0, 8000)}`
    : `把这篇文章翻成中文。只输出 JSON：{ "title":"中文标题", "excerpt":"一两句话摘要", "html":"<h2>..</h2><p>..</p>" }\n\n标题：${title}\n摘要：${excerpt}\nHTML：\n${String(html).slice(0, 8000)}`;
  return { system, user };
}
