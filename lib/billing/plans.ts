// 三档局数包（一次性购买，买断局数）。改这里即可调价/调量/换货币。
// 局数对所有模式通用：克苏鲁跑团 / 海龟汤 / 真心话大冒险，开房各消耗 1 局。
export interface Pack {
  id: string;
  games: number;
  price: number; // 单位：美分（USD）
  label: { zh: string; en: string };
  perGame: { zh: string; en: string };
  tag?: { zh: string; en: string };
  best?: boolean;
}
export const PACKS: Pack[] = [
  { id: 'p2', games: 2, price: 495, label: { zh: '入门 · 2 局', en: 'Starter · 2 games' }, perGame: { zh: '约 $2.48/局', en: '~$2.48/game' } },
  { id: 'p5', games: 5, price: 995, label: { zh: '标准 · 5 局', en: 'Standard · 5 games' }, perGame: { zh: '约 $1.99/局', en: '~$1.99/game' }, tag: { zh: '最受欢迎', en: 'Popular' } },
  { id: 'p15', games: 15, price: 1900, label: { zh: '超值 · 15 局', en: 'Value · 15 games' }, perGame: { zh: '约 $1.27/局', en: '~$1.27/game' }, tag: { zh: '最划算', en: 'Best value' }, best: true },
];
export const CURRENCY = 'usd';
export const CURRENCY_SYMBOL = '$';
export function packById(id: string) { return PACKS.find((p) => p.id === id); }
