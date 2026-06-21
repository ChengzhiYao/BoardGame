// 共享模组评审引擎：加权维度（每项0~10）→ 归一总分 complexity(0~100) + 结构性封顶 + 改稿潜力诊断。
// 复用于 CoC 案件、D&D 冒险蓝图、剧本杀剧本。借鉴讲故事模式的评分内核。

export type ReviewMode = 'coc' | 'dnd' | 'jbs';

type Dim = { key: string; label: string; w: number; hint: string };
type Cap = { key: string; below: number; cap: number; why: string };
type Rubric = { pass: number; intro: string; dims: Dim[]; caps: Cap[] };

export const MODULE_RUBRICS: Record<ReviewMode, Rubric> = {
  coc: {
    pass: 72,
    intro: '你是一位资深恐怖跑团（CoC）审稿人。下面是一份"隐藏案件档案"。请像审一份准备出版的人工模组那样，严格、挑剔地评估它作为双人/多人调查模组的质量。',
    dims: [
      { key: 'truth', label: '真相合理性', w: 10, hint: '真相"出人意料但事后合理"，不是天降信息' },
      { key: 'clues', label: '线索充分', w: 9, hint: '三线索法则：重要结论≥3条线索支撑，不会卡关' },
      { key: 'deduce', label: '可推理性', w: 8, hint: '玩家能凭线索真正推导出真相，而非被动告知' },
      { key: 'npc', label: 'NPC立体', w: 8, hint: 'NPC有秘密+当下欲望，有人说谎，目的互相冲突' },
      { key: 'twist', label: '反转与两难', w: 8, hint: '至少一个反转；高潮处有两难抉择' },
      { key: 'concrete', label: '具体可感', w: 8, hint: '线索/场景具体，无"古老邪恶"之类无支撑空壳套路' },
      { key: 'escalation', label: '升级压力', w: 7, hint: '态势随回合恶化/有时间压力，而非静止等玩家' },
      { key: 'horror', label: '恐怖核心', w: 7, hint: '真正营造不安/未知/压迫，而非只贴恐怖词' },
      { key: 'herring', label: '误导合理', w: 6, hint: '误导线索合理且最终能被排除' },
    ],
    caps: [
      { key: 'truth', below: 5, cap: 75, why: '真相站不住/天降信息' },
      { key: 'clues', below: 5, cap: 78, why: '线索不足易卡关' },
      { key: 'concrete', below: 6, cap: 86, why: '套路空壳、不具体' },
      { key: 'npc', below: 6, cap: 86, why: 'NPC是工具人' },
      { key: 'deduce', below: 6, cap: 88, why: '玩家推不出真相' },
      { key: 'twist', below: 5, cap: 82, why: '缺反转/两难' },
    ],
  },
  dnd: {
    pass: 70,
    intro: '你是资深龙与地下城审稿人。下面是一份隐藏冒险蓝图。请像审一份准备出版的单元模组那样，严格、挑剔地评估其质量。',
    dims: [
      { key: 'goal', label: '目标与动机', w: 9, hint: '核心目标与反派动机清晰且有张力' },
      { key: 'climax', label: '高潮Boss', w: 9, hint: '高潮/Boss战精彩、有两难或抉择' },
      { key: 'pacing', label: '节拍推进', w: 8, hint: '节拍有起伏、不拖沓不卡关' },
      { key: 'encounters', label: '遭遇配置', w: 8, hint: '遭遇难度曲线合理、贴合队伍' },
      { key: 'npc', label: 'NPC立体', w: 7, hint: '关键NPC有秘密+诉求+互相冲突，有人说谎' },
      { key: 'twist', label: '反转', w: 7, hint: '有出人意料但合理的反转' },
      { key: 'concrete', label: '场景具体', w: 7, hint: '场景具体可感，不空壳套路' },
      { key: 'agency', label: '玩家选择', w: 7, hint: '给玩家有意义的选择空间，而非单线推着走' },
      { key: 'reward', label: '奖励相称', w: 5, hint: '奖励与风险/难度相称' },
    ],
    caps: [
      { key: 'goal', below: 5, cap: 76, why: '目标/动机不清' },
      { key: 'climax', below: 5, cap: 80, why: '高潮平淡' },
      { key: 'concrete', below: 6, cap: 86, why: '场景空壳' },
      { key: 'encounters', below: 6, cap: 86, why: '遭遇配置失衡' },
      { key: 'agency', below: 6, cap: 88, why: '玩家无选择、单线' },
    ],
  },
  jbs: {
    pass: 72,
    intro: '你是资深剧本杀（谋杀推理本）审稿人。下面是一个剧本设定。请像审一份准备发行的商业本那样，严格、挑剔地评估其质量。',
    dims: [
      { key: 'case', label: '诡计合理', w: 9, hint: '核心案件/诡计合理、能自洽闭环' },
      { key: 'fairness', label: '可推理锁定', w: 8, hint: '凶手能被线索公平推理锁定，而非全靠投票/运气' },
      { key: 'clues', label: '线索分布', w: 8, hint: '线索分布公平、覆盖各角色、可拼出真相' },
      { key: 'roles', label: '角色与秘密', w: 8, hint: '每个角色独特、有秘密与私人任务/动机' },
      { key: 'motive', label: '动机交织', w: 8, hint: '人物动机互相交织冲突，关系网有张力' },
      { key: 'twist', label: '反转', w: 7, hint: '有出人意料但合理的反转' },
      { key: 'fun', label: '机制乐趣', w: 7, hint: '阵营/情感/机制带来真正的体验乐趣，非走流程' },
      { key: 'concrete', label: '具体可感', w: 6, hint: '设定具体，不靠空壳套路撑场面' },
    ],
    caps: [
      { key: 'case', below: 5, cap: 76, why: '诡计不自洽' },
      { key: 'fairness', below: 5, cap: 80, why: '凶手推不出、只能猜' },
      { key: 'clues', below: 6, cap: 86, why: '线索分布不公平' },
      { key: 'roles', below: 6, cap: 86, why: '角色扁平无秘密' },
      { key: 'motive', below: 6, cap: 88, why: '动机不交织' },
    ],
  },
};

export function buildModuleReviewSystem(mode: ReviewMode, lang?: string): string {
  const en = lang === 'en';
  const R = MODULE_RUBRICS[mode];
  const lines = R.dims.map((d, i) => `${i + 1} ${d.key} ${d.label}(权重${d.w})：${d.hint}`).join('\n');
  const tmpl = R.dims.map((d) => `    { "key": "${d.key}", "label": "${d.label}", "score": 0, "note": "" }`).join(',\n');
  return `${R.intro}
逐项按 0~10 打分（系统会按权重换算总分，所以请如实评、别都给 8~9）：
${lines}

【打分锚点】9~10 出色/几近出版水准；8 优秀小瑕；6~7 合格但普通；4~5 平庸有明显问题；0~3 缺失或很差。平庸套路压到 5~7，有巧思有张力才给 9~10。
【改稿潜力 potential】light_max=只润色措辞能到的上限；medium_max=补线索/加NPC秘密/调节拍能到的上限；deep_max=重构诡计/反转/动机网能到的上限。blockers 诚实点名结构短板。

只输出 JSON（语言：${en ? 'English' : '中文'}）：
{
  "dimensions": [
${tmpl}
  ],
  "complexity": 0,
  "pass": true,
  "issues": ["具体问题，简短，2~4 条"],
  "verdict": "一句话总评",
  "potential": { "light_max": 0, "medium_max": 0, "deep_max": 0, "blockers": ["拖分主因 2~3 条"], "best_fix": "最有效的一个结构级改法" }
}`;
}

// 归一 + 封顶：返回带 complexity(0~100整数)/dimensions/cap/capReasons/potential/issues/pass 的质量对象
export function normalizeModuleQuality(review: any, mode: ReviewMode): any {
  const R = MODULE_RUBRICS[mode];
  const W: Record<string, number> = Object.fromEntries(R.dims.map((d) => [d.key, d.w]));
  const dims = (Array.isArray(review?.dimensions) ? review.dimensions : []).map((d: any) => ({ ...d, score: Math.max(0, Math.min(10, Number(d.score) || 0)) }));
  let complexity: number;
  if (dims.length) {
    let num = 0, den = 0;
    for (const d of dims) { const w = W[d.key] ?? 6; num += d.score * w; den += 10 * w; }
    complexity = den ? Math.round((num / den) * 100) : 0;
  } else {
    complexity = Math.max(0, Math.min(100, Math.round(Number(review?.complexity) || 0)));
  }
  const sc = (k: string) => { const d = dims.find((x: any) => x.key === k); return d ? d.score : 10; };
  let cap = 100; const reasons: string[] = [];
  if (dims.length) for (const c of R.caps) { if (sc(c.key) < c.below) { if (c.cap < cap) cap = c.cap; reasons.push(c.why); } }
  const capped = Math.min(complexity, cap);
  return {
    complexity: capped,
    pass: capped >= R.pass,
    issues: Array.isArray(review?.issues) ? review.issues.slice(0, 5) : [],
    verdict: review?.verdict || '',
    dimensions: dims,
    potential: review?.potential || null,
    ...(cap < 100 ? { cap, capReasons: reasons } : {}),
  };
}

export const modulePass = (mode: ReviewMode) => MODULE_RUBRICS[mode].pass;
