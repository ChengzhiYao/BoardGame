// 真心话大冒险内置题库（派对级、健康有趣，零 token）。
// intensity: mild 轻松 / medium 适中 / bold 大胆但不越界。
export interface TDItem { text: string; intensity: 'mild' | 'medium' | 'bold'; }

export const TRUTHS: TDItem[] = [
  { text: '你做过最尴尬的一件事是什么？', intensity: 'mild' },
  { text: '你最近一次撒谎是为了什么？', intensity: 'mild' },
  { text: '在场的人里，你第一印象最好的是谁？', intensity: 'mild' },
  { text: '你手机相册里最舍不得删的一张照片是什么？', intensity: 'mild' },
  { text: '你有什么从没告诉过别人的小爱好？', intensity: 'mild' },
  { text: '你最怕别人发现你的哪个缺点？', intensity: 'medium' },
  { text: '你做过最冲动的一个决定是什么？', intensity: 'medium' },
  { text: '在场的人里，你觉得谁最可能瞒着大家一个秘密？', intensity: 'medium' },
  { text: '你最近一次偷偷哭是因为什么？', intensity: 'medium' },
  { text: '你曾经暗恋过谁却没说出口？（可以只说当时的感觉）', intensity: 'medium' },
  { text: '如果可以匿名对在场某人说一句真心话，你会说什么？', intensity: 'bold' },
  { text: '你最后悔的一件事，如果能重来你会怎么做？', intensity: 'bold' },
  { text: '你心里偷偷羡慕在场的哪个人？为什么？', intensity: 'bold' },
  { text: '你做过最叛逆的一件事是什么？', intensity: 'bold' },
  { text: '你有没有为了合群而违心做过的事？', intensity: 'bold' },
];

export const DARES: TDItem[] = [
  { text: '用最夸张的表情和语气念一段绕口令。', intensity: 'mild' },
  { text: '模仿在场一个人的口头禅或动作，让大家猜是谁。', intensity: 'mild' },
  { text: '原地转五圈再走一条直线。', intensity: 'mild' },
  { text: '用唱歌的方式说出接下来的三句话。', intensity: 'mild' },
  { text: '给在场每个人一个真诚的夸奖。', intensity: 'mild' },
  { text: '学三种动物的叫声，让大家评分。', intensity: 'medium' },
  { text: '用身体摆出一个字，让大家猜。', intensity: 'medium' },
  { text: '闭眼凭记忆画出在场某人的头像，画完展示。', intensity: 'medium' },
  { text: '即兴表演"刚中了大奖"的反应，持续十秒。', intensity: 'medium' },
  { text: '用方言或假装的外语口音说一段自我介绍。', intensity: 'medium' },
  { text: '让在场的人各出一个词，把它们编进一句话里说出来。', intensity: 'bold' },
  { text: '给在场一个人发一条真诚的、平时不好意思说的赞美（当面说）。', intensity: 'bold' },
  { text: '即兴讲一个关于自己的、好笑的糗事。', intensity: 'bold' },
  { text: '模仿一位你喜欢的明星或角色，表演三十秒。', intensity: 'bold' },
  { text: '让左手边的人指定一个无害的小动作，由你完成。', intensity: 'bold' },
];

const ORDER: Record<string, number> = { mild: 0, medium: 1, bold: 2 };
export function filterByIntensity(items: TDItem[], cap: string): TDItem[] {
  const c = ORDER[cap] ?? 1;
  return items.filter((i) => (ORDER[i.intensity] ?? 0) <= c);
}
