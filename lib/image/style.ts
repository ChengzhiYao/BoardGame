// 全局美术风格锁 —— 唯一标准。头像与所有场景图都必须套用 ART_STYLE，
// 保证整个游戏的视觉高度一致。任何新的出图入口都要走这里的 builder。

// 默认（克苏鲁）风格
export const ART_STYLE =
  '【统一美术风格，必须严格遵守】阴郁的恐怖插画；铜版画／蚀刻质感，细密线条与排线；' +
  '低饱和、暗调配色（炭黑、灰烬、深青、暗干血红）；浓重阴影与雾气；细腻胶片颗粒；' +
  '克苏鲁式的不安与压抑；克制的笔触，不夸张、不卡通、不鲜艳；画面无文字、无水印、无边框。';

// 中式恐怖风格
const ART_STYLE_CN =
  '【统一美术风格，必须严格遵守】中式民俗恐怖；水墨与旧版画质感，枯笔皴擦；' +
  '低饱和暗调，朱砂红、墨黑、纸黄、烛火昏光；祠堂、纸扎、香火与阴翳；潮湿陈旧；细腻胶片颗粒；' +
  '阴森压抑，克制不卡通不鲜艳；画面无文字、无水印、无边框。';

// 日式怪谈风格
const ART_STYLE_JP =
  '【统一美术风格，必须严格遵守】日式怪谈；浮世绘版画与胶片质感交融；' +
  '低饱和暗调，靛蓝、墨黑、苍白、暗红；阴湿雨夜、和室纸障、神社阴影；幽冥而克制；细腻颗粒；' +
  '不卡通不鲜艳；画面无文字、无水印、无边框。';

// 现代都市/校园怪谈风格
const ART_STYLE_MODERN =
  '【统一美术风格，必须严格遵守】现代都市恐怖；冷调胶片摄影质感，颗粒与暗角；' +
  '低饱和，冷青灰、惨白、暗红霓虹；荧光灯、走廊、深夜场景；写实而压抑；' +
  '不卡通不鲜艳；画面无文字、无水印、无边框。';

export function artStyleFor(theme?: string): string {
  const t = theme || '';
  if (/中式|民俗|东方|古代|祠|墓|村/.test(t)) return ART_STYLE_CN;
  if (/日式|怪谈|和|神社/.test(t)) return ART_STYLE_JP;
  if (/校园|都市传说|现代|医院|地铁|学校/.test(t)) return ART_STYLE_MODERN;
  return ART_STYLE;
}

function eraStyle(era?: string): string {
  if (!era) return '';
  return `时代背景：${era}，服装、道具、建筑需符合该时代。`;
}

// 由属性值推导外形特征（让头像真正贴合角色卡）
function derivePhysique(c: any): string {
  const out: string[] = [];
  if ((c?.siz ?? 0) >= 70) out.push('身材高大'); else if ((c?.siz ?? 99) <= 45) out.push('身形瘦小');
  if ((c?.str ?? 0) >= 70) out.push('体格健壮'); else if ((c?.con ?? 99) <= 40) out.push('面色虚弱');
  if ((c?.app ?? 0) >= 70) out.push('相貌出众'); else if ((c?.app ?? 99) <= 30) out.push('其貌不扬');
  if ((c?.edu ?? 0) >= 75) out.push('书卷气');
  return out.join('，');
}

// 角色头像：走统一的 npc_portrait 类型（同一套分类与画风），
// 综合性别、年龄、职业、外貌、性格、属性推导特征，避免千篇一律。
export function buildAvatarPrompt(char: any, era?: string, theme?: string): string {
  const g = char?.gender === 'male' ? '男性' : char?.gender === 'female' ? '女性' : '';
  const bits = [
    char?.age ? `${char.age}岁` : '',
    char?.occupation || '',
    derivePhysique(char),
    char?.appearance || '',
    char?.personality ? `气质：${char.personality}` : '',
    era ? `${era}着装` : '',
  ].filter(Boolean).join('，');
  const subject = `${g || '一名'}调查员，神情疲惫而警觉：${bits || '一名普通调查员'}`;
  return buildImagePrompt('npc_portrait', subject, era, theme);
}

// 剧本杀角色肖像：画风【不固定】，按本剧的本型/题材/时代与这名角色自身的描述来决定，
// 每一局、每个角色都不一样，而不是套用克苏鲁那套锁定风格。
const JBS_MOOD: Record<string, string> = {
  恐怖: '幽暗不安、冷调、阴影浓重、令人紧张的氛围',
  欢乐: '明亮温暖、轻松俏皮、色彩活泼明快',
  情感: '柔和温暖的电影感，细腻的情绪与淡淡怀旧',
  推理: '冷峻的黑色电影氛围，戏剧性的明暗对比',
  阵营: '史诗、张力十足的戏剧光影',
  还原: '泛黄褪色的旧时光与回忆质感',
  机制: '冷静、现代、利落、商战般的质感',
};

export function buildJbsPortraitPrompt(c: any, meta: { type?: string; genre?: string; era?: string; place?: string }): string {
  const looks = [
    c?.age ? `${c.age}` : '',
    c?.occupation || '',
    c?.personality ? `性格气质：${c.personality}` : '',
    c?.background ? `背景：${String(c.background).slice(0, 90)}` : '',
    c?.public_info ? String(c.public_info).slice(0, 70) : '',
  ].filter(Boolean).join('，');
  const subject = `${c?.name || '角色'}——${looks || '一名角色'}`;
  const mood = JBS_MOOD[meta.type || ''] || '写实而有戏剧感的电影氛围';
  const era = meta.era ? `时代背景：${meta.era}，服装、发型、道具须贴合该时代。` : '';
  return `人物半身肖像：${subject}。单人，正面略侧，神情可辨，深色中性背景。`
    + `${era}题材风格：${meta.genre || ''}${meta.place ? `（${meta.place}）` : ''}。`
    + `【画风随这名角色与本剧设定而定，不要套用固定风格】体现${mood}；`
    + `写实细腻的插画/绘画质感，整组角色风格协调但各自贴合人物个性、年龄与职业；`
    + `仅在题材本身轻松时才偏卡通，否则写实；画面无文字、无水印、无边框。`;
}

// 场景／NPC／怪物等场景图 prompt（在 AI 给出的画面描述前后套上统一风格）
export function buildScenePrompt(scene: string, era?: string): string {
  return `画面：${scene}。${eraStyle(era)} ${ART_STYLE}`;
}

// 按图片类型构图。禁止把抽象概念/线索标题直接出图，强调具体的物理画面。
export type ImageType = 'scene_image' | 'npc_portrait' | 'clue_evidence' | 'monster_image' | 'event_illustration';

const TYPE_TEMPLATES: Record<ImageType, (s: string) => string> = {
  scene_image: (s) => `场景环境空镜：${s}。展现这个地点的空间、结构、光线与氛围；无人物特写，不放抽象元素。`,
  npc_portrait: (s) => `人物半身肖像：${s}。单人，正面略侧，深色中性背景，神情可辨。`,
  clue_evidence: (s) => `证物特写照片：${s}。桌面或手持的近景，聚焦这件实物本身（例如一张撕角的旧船票、一页带血迹的纸、一把锈钥匙）；不要画人在阅读，不要画抽象概念。`,
  monster_image: (s) => `异常存在 / 怪物：${s}。半隐于阴影与雾气，不完全显形，令人不安。`,
  event_illustration: (s) => `关键事件定格：${s}。一个具体的戏剧性瞬间，有明确的动作与环境。`,
};

export function buildImagePrompt(type: string, subject: string, era?: string, theme?: string): string {
  const fn = TYPE_TEMPLATES[(type as ImageType)] || TYPE_TEMPLATES.scene_image;
  return `${fn(subject || '一处不安的场景')} ${eraStyle(era)} ${artStyleFor(theme)}`;
}
