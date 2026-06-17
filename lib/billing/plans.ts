// 三档局数包（一次性购买，买断局数）。改这里即可调价/调量/换货币。
// 局数对所有模式通用：克苏鲁跑团 / 海龟汤 / 真心话大冒险，开房各消耗 1 局。
export interface Pack { id: string; games: number; price: number; label: string; perGame: string; tag?: string }
// price 单位：美分（USD）。
export const PACKS: Pack[] = [
  { id: 'p2',  games: 2,  price: 990,  label: '入门 · 2 局',  perGame: '约 $4.95/局' },
  { id: 'p5',  games: 5,  price: 1990, label: '标准 · 5 局',  perGame: '约 $3.98/局', tag: '最受欢迎' },
  { id: 'p15', games: 15, price: 3800, label: '超值 · 15 局', perGame: '约 $2.53/局', tag: '最划算' },
];
export const CURRENCY = 'usd';
export const CURRENCY_SYMBOL = '$';
export function packById(id: string) { return PACKS.find((p) => p.id === id); }
