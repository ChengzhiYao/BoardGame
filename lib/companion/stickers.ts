// 表情包(纯数据,前后端共用)
export const STICKERS: Record<string, { e: string; t: string; m?: string }> = {
  '捂脸': { e: '🤦', t: '捂脸' }, '笑哭': { e: '😂', t: '笑死' }, '狗头': { e: '🐶', t: '狗头保命' }, '委屈': { e: '🥺', t: '委屈' },
  '无语': { e: '😑', t: '无语' }, '白眼': { e: '🙄', t: '白眼' }, '吃瓜': { e: '🍉', t: '吃瓜' }, '哼': { e: '😤', t: '哼' },
  '抱抱': { e: '🫂', t: '抱抱' }, '好的': { e: '👌', t: '好的收到' }, '晚安': { e: '🌙', t: '晚安' }, '震惊': { e: '😱', t: '震惊' },
  '害羞': { e: '🙈', t: '害羞' }, '疑惑': { e: '🤔', t: '？' }, '摸摸': { e: '🫳', t: '摸摸头' }, '开心': { e: '🥳', t: '开心' },
  '困': { e: '😪', t: '困死了' }, '饿': { e: '🤤', t: '饿了' }, '裂开': { e: '🫠', t: '裂开' }, '耶': { e: '✌️', t: '耶' },
};
// 每个表情包背后的意思:AI 直接读这句话,不用识图
export const STICKER_MEANING: Record<string, string> = {
  '捂脸': '无奈、尴尬、没眼看', '笑哭': '笑死了、太好笑', '狗头': '开玩笑的、别当真、狗头保命', '委屈': '委屈、可怜巴巴、求安慰',
  '无语': '无语、懒得说', '白眼': '翻白眼、嫌弃', '吃瓜': '围观看热闹', '哼': '不爽、小生气、傲娇',
  '抱抱': '想抱抱、安慰', '好的': '好的、收到', '晚安': '晚安、要睡了', '震惊': '震惊、不敢相信',
  '害羞': '害羞、不好意思', '疑惑': '疑惑、没懂、啥意思', '摸摸': '摸摸头、安慰、宠溺', '开心': '开心、庆祝',
  '困': '困了、想睡觉', '饿': '饿了、馋', '裂开': '崩溃、心态裂开', '耶': '耶、得意、开心',
};
export const STICKER_RE = /^\[sticker:([^\]]+)\]$/;
// 照片消息:[photo:URL|画面描述]
export const PHOTO_RE = /^\[photo:([^|\]]+)\|?([^\]]*)\]$/;
// 推送/预览:像微信那样显示 [动画表情] / [图片]
export function previewText(t: string) {
  return t.split('\n').map((x) => (STICKER_RE.test(x.trim()) ? '[动画表情]' : PHOTO_RE.test(x.trim()) ? '[图片]' : x)).join('\n');
}
// 给模型看的版本:表情包换成文字含义,照片换成画面描述(不用识图)
export function forModel(t: string, fromUser: boolean) {
  const x = t.trim();
  const st = x.match(STICKER_RE);
  if (st) {
    const k = st[1].trim(); const m = STICKER_MEANING[k] || k;
    return fromUser ? `[对方发了个表情包「${k}」,意思是:${m}]` : x;
  }
  const ph = x.match(PHOTO_RE);
  if (ph) return fromUser ? '[对方发了一张图片]' : `[你刚发了一张照片:${ph[2] || '日常'}]`;
  return t;
}
