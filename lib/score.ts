// 玩家综合评分 prompt：给每个真人玩家按多维指标打分（每人不同），并点评做得好/可改进之处。
// 通用于剧本杀(jbs)与克苏鲁调查(coc)，由 mode 决定指标维度。
export type PlayerInput = { seat: string; name: string; role?: string; goal?: string; actions: string[] };

const METRICS = {
  jbs: '推理逻辑、角色扮演、参与互动、任务达成（私人目标/任务完成度）、关键决断（最终指认是否合理）',
  coc: '调查推理、角色扮演、参与互动、危机决断、团队协作',
};

export function buildScorePrompt(opts: { mode: 'jbs' | 'coc'; scenario: string; truth?: string; players: PlayerInput[] }): string {
  const metrics = METRICS[opts.mode];
  const roster = opts.players.map((p) =>
    `【座位 ${p.seat}】${p.name}${p.role ? `（${p.role}）` : ''}${p.goal ? `｜目标：${p.goal}` : ''}\n其发言/行动记录：\n${p.actions.length ? p.actions.map((a, i) => `${i + 1}. ${a}`).join('\n') : '（几乎没有发言/行动）'}`
  ).join('\n\n');

  return `你是这局游戏的资深主持人，现在要给每个真人玩家做一份**客观、有区分度**的综合表现评分。不同玩家分数要拉开差距，不要都给差不多的分；发言少/划水的要明显低分，推理到位/沉浸投入/推动剧情的要高分。

【本局背景】${opts.scenario}
${opts.truth ? `【真相（仅供你评判推理是否正确，不要写进点评里剧透给别人）】${opts.truth}` : ''}

【评分维度（每项 0~100）】${metrics}

【待评分玩家】
${roster}

为每位玩家给出：每个维度的分数(0~100)+一句极简点评、综合总分(total，可为各维度加权或均值)、一句"做得好"(highlight)、一句"可改进"(improve)。语言与玩家所用语言一致。

只输出 JSON：
{
  "scores": [
    {
      "seat": "A",
      "name": "",
      "total": 0,
      "metrics": [ { "label": "维度名", "score": 0, "note": "极简点评" } ],
      "highlight": "这位玩家做得最好的一点",
      "improve": "可以改进的一点"
    }
  ]
}`;
}

// 把评分结构化结果格式化成展示文本。
export function formatScores(scores: any[], en: boolean): string {
  if (!Array.isArray(scores) || !scores.length) return '';
  const head = en ? '【PLAYER SCORECARD】' : '【玩家评分】';
  const blocks = scores.map((s) => {
    const metrics = (s.metrics || []).map((m: any) => `  · ${m.label} ${m.score}${m.note ? `（${m.note}）` : ''}`).join('\n');
    const hi = s.highlight ? `\n  ${en ? '👍 ' : '亮点：'}${s.highlight}` : '';
    const im = s.improve ? `\n  ${en ? '🔧 ' : '可改进：'}${s.improve}` : '';
    return `${s.name}${s.seat ? ` [${s.seat}]` : ''} — ${en ? 'Total' : '总分'} ${s.total}/100\n${metrics}${hi}${im}`;
  });
  return `${head}\n` + blocks.join('\n\n');
}
