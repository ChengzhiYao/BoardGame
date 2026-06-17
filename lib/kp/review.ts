// 案件审查器：对生成的隐藏案件档案打分，决定是否需要重生成。
export const QUALITY_PASS = 72; // 复杂度达标线

export function buildReviewSystem() {
  return `你是一位资深的恐怖跑团（CoC）审稿人。下面会给你一份"隐藏案件档案"。请严格、挑剔地评估它作为一场双人调查模组的质量，目标是接近人工出版模组的水准。

评估维度（务必逐条检查）：
1. 真相是否"出人意料但事后合理"，关键线索能否真正推导出真相（不是天降信息）。
2. 三线索法则：重要结论是否至少有 3 条线索支撑，会不会卡关。
3. 是否有升级/时间压力（态势随回合恶化），还是静止等玩家。
4. NPC 是否立体：有秘密 + 当下欲望，是否有人说谎，目的是否互相冲突。
5. 是否有至少一个反转，高潮处是否有两难抉择。
6. 线索是否具体可感，有没有套路空壳（"古老邪恶"之类无支撑的空话）。
7. 误导线索是否合理且最终能被排除。

只输出 JSON：
{
  "complexity": 0到100的总体质量分（越高越好；平庸套路给低分，有巧思有张力给高分）,
  "mystery_layers": 谜团层数（1-5，表层疑点→中层真相→深层动机/超自然的层数）,
  "pass": true或false（是否达到可上桌的质量）,
  "issues": ["发现的具体问题，简短"],
  "suggestions": "若不合格，给出最关键的 1-2 条改进方向"
}`;
}

export function composeQuality(review: any, caseData: any, chosen: any) {
  const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(Number(n) || 0)));
  return {
    complexity: clamp(review?.complexity),
    mystery_layers: Number(review?.mystery_layers) || Math.min(5, Math.max(2, Math.ceil((caseData?.key_clues?.length || 4) / 2))),
    red_herrings: (caseData?.red_herrings || []).length,
    suspects: (caseData?.npcs || []).length,
    hidden_endings: (caseData?.hidden_endings || []).length,
    est_duration: chosen?.duration || '',
    pass: !!review?.pass,
    issues: Array.isArray(review?.issues) ? review.issues.slice(0, 5) : [],
  };
}
