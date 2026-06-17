// AI 定制真心话/大冒险（按设置生成，严格安全边界）。
export interface TDSettings {
  types?: string[];     // ['truth','dare']
  intensity?: string;   // mild | medium | bold
  forbidden?: string;   // 禁止的元素
  environment?: string; // 所处环境（家里/酒吧/公园/线上语音…）
}

export function buildTDGenPrompt(kind: 'truth' | 'dare', s: TDSettings) {
  const label = kind === 'truth' ? '真心话问题' : '大冒险任务';
  return `你是派对游戏「真心话大冒险」的出题人。请原创一个**${label}**，要有趣、好玩、适合朋友聚会。

参数：
- 尺度：${s.intensity || 'medium'}（mild 轻松 / medium 适中 / bold 大胆但绝不越界）
- 所处环境：${s.environment || '不限'}（任务必须在这个环境里可执行，例如线上语音就别让人去户外做事）
- 禁止出现/涉及：${s.forbidden || '无'}

【安全红线，必须严格遵守】
- 绝不涉及任何露骨、色情、性相关内容；不针对任何人的身体或外貌做冒犯。
- 绝不包含危险、违法、伤害自己或他人、损坏财物、饮酒过量等内容。
- 不涉及未成年人相关的不当内容；保持健康、尊重、人人可玩。
- 严格避开"禁止出现"里列的内容。
- 大冒险要在所给环境里安全可完成；真心话不要逼人透露会造成伤害的敏感隐私。

只输出 JSON：{ "text": "题目内容（一句话）", "intensity": "mild/medium/bold" }`;
}
