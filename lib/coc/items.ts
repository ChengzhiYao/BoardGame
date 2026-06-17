// 开局可选随身道具（玩家建卡时挑选，之后只能使用真正持有的道具）。中英两套，按对局语言显示。
export const ITEMS_ZH: string[] = [
  '手电筒', '火柴与打火机', '急救包', '撬棍', '绳索（15米）',
  '相机', '笔记本与钢笔', '猎刀', '怀表', '地图与指南针',
  '放大镜', '锁匠工具', '油灯', '护身符', '随身酒壶',
  '左轮手枪', '弹药一盒', '猎枪', '医疗箱', '听诊器', '口哨', '十字架/经文',
];
export const ITEMS_EN: string[] = [
  'Flashlight', 'Matches & lighter', 'First-aid kit', 'Crowbar', 'Rope (15 m)',
  'Camera', 'Notebook & pen', 'Hunting knife', 'Pocket watch', 'Map & compass',
  'Magnifying glass', 'Lockpicks', 'Oil lamp', 'Amulet', 'Hip flask',
  'Revolver', 'Box of ammo', 'Shotgun', 'Medical bag', 'Stethoscope', 'Whistle', 'Crucifix / scripture',
];
export function itemsFor(lang?: string): string[] {
  return lang === 'en' ? ITEMS_EN : ITEMS_ZH;
}
export const ITEMS = ITEMS_ZH;
export const MAX_ITEMS = 5;
