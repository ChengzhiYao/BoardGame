// 隐晦测验题：不直接问"你要什么性格/职业",而是情景偏好,交给模型去推最配的伴侣。
export type QOpt = { key: string; zh: string; en: string };
export type Q = { id: string; zh: string; en: string; opts: QOpt[] };

export const QUIZ: Q[] = [
  { id: 'evening', zh: '一个完全空出来的夜晚,你最想怎么过?', en: 'A totally free evening — what do you want?',
    opts: [
      { key: 'alone', zh: '一个人窝着,书或游戏,谁也别找我', en: 'Curled up alone with a book/game' },
      { key: 'few', zh: '约两三个老友,小聚慢聊', en: 'A quiet hang with a couple of close friends' },
      { key: 'party', zh: '去个热闹的局,人越多越带劲', en: 'Somewhere lively, the more people the better' },
      { key: 'wander', zh: '临时起意出门乱逛,看心情', en: 'Head out on a whim and wander' },
    ] },
  { id: 'down', zh: '心情很糟的时候,你其实想要的是?', en: 'When you feel low, what you actually want is…',
    opts: [
      { key: 'quiet', zh: '有人静静陪着,别追问', en: 'Someone quietly there, no questions' },
      { key: 'distract', zh: '有人逗我笑,把我拽出来', en: 'Someone to make me laugh, pull me out' },
      { key: 'reason', zh: '有人帮我理清、给点主意', en: 'Someone to help me think it through' },
      { key: 'space', zh: '自己待着,谁都别烦我', en: 'Just leave me alone' },
    ] },
  { id: 'scene', zh: '哪个画面莫名戳中你?', en: 'Which scene quietly pulls at you?',
    opts: [
      { key: 'city', zh: '深夜便利店的暖光', en: 'The warm light of a late-night convenience store' },
      { key: 'books', zh: '雨天的旧书店', en: 'An old bookshop in the rain' },
      { key: 'sea', zh: '清晨海边的风', en: 'Sea wind at dawn' },
      { key: 'neon', zh: '霓虹下喧嚣的街头', en: 'A loud neon-lit street' },
    ] },
  { id: 'talk', zh: '你喜欢别人怎么跟你说话?', en: 'How do you like being talked to?',
    opts: [
      { key: 'gentle', zh: '温柔耐心', en: 'Gentle and patient' },
      { key: 'blunt', zh: '直来直去,不绕弯', en: 'Blunt, no beating around' },
      { key: 'tease', zh: '爱损我、斗嘴', en: 'Teasing, banter' },
      { key: 'quiet', zh: '话不多,但很懂', en: 'Few words, but gets me' },
    ] },
  { id: 'draw', zh: '一个人身上什么特质最让你上头?', en: 'What trait in someone gets you hooked?',
    opts: [
      { key: 'talent', zh: '有才华/有手艺', en: 'Talent / craft' },
      { key: 'mystery', zh: '神秘、看不透', en: 'Mystery, hard to read' },
      { key: 'steady', zh: '踏实可靠', en: 'Steady and reliable' },
      { key: 'wild', zh: '不羁、有故事', en: 'Untamed, a story behind them' },
    ] },
  { id: 'close', zh: '你理想中的"距离感"是?', en: 'Your ideal closeness?',
    opts: [
      { key: 'clingy', zh: '最好时刻黏着', en: 'Clingy, all the time' },
      { key: 'balance', zh: '常联系,但各有空间', en: 'Often in touch, with space' },
      { key: 'indep', zh: '君子之交,各自独立', en: 'Independent, light touch' },
      { key: 'unpred', zh: '忽远忽近,有点捉摸不定', en: 'Hot and cold, unpredictable' },
    ] },
];
