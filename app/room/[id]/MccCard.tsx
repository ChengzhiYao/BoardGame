'use client';
// 午夜猫诅咒 · 原创卡面（黑底白线，两色极简，神秘玄幻风）。全部为本项目原创矢量美术。
import React from 'react';

type Key = 'curse' | 'ward' | 'nap' | 'swap' | 'peek' | 'shuffle' | 'hex' | 'thief' | 'noise' | 'lives' | 'hiss' | 'mirror';
const W = '#ece9e2'; // 唯一的"白"

const INFO: Record<Key, { zh: string; en: string; d_zh: string; d_en: string }> = {
  curse: { zh: '诅咒猫', en: 'CURSE CAT', d_zh: '抽到即出局，除非有护身铃', d_en: 'Draw it and you are out — unless warded' },
  ward: { zh: '护身铃', en: 'WARD BELL', d_zh: '化解诅咒猫，并把它塞回牌堆', d_en: 'Cancel a drawn Curse Cat; hide it back' },
  nap: { zh: '打盹', en: 'MOON NAP', d_zh: '跳过抽牌，直接结束回合', d_en: 'Skip your draw and end your turn' },
  swap: { zh: '换爪', en: 'PAW SWAP', d_zh: '与一名玩家各随机交换一张牌', d_en: 'Swap one random card with a player' },
  peek: { zh: '烛光窥视', en: 'CANDLE PEEK', d_zh: '偷看牌堆顶的 3 张牌', d_en: 'Look at the top three cards' },
  shuffle: { zh: '走廊洗牌', en: 'HALLWAY SHUFFLE', d_zh: '把整个牌堆彻底洗乱', d_en: 'Shuffle the entire deck' },
  hex: { zh: '毛球诅咒', en: 'HAIRBALL HEX', d_zh: '指定一名玩家，他要连走两轮', d_en: 'A chosen player must take two turns' },
  thief: { zh: '零食小偷', en: 'TREAT THIEF', d_zh: '随机偷走一名玩家的一张牌', d_en: 'Steal one random card from a player' },
  noise: { zh: '地窖骚动', en: 'BASEMENT NOISE', d_zh: '所有人向左手边传一张牌', d_en: 'Everyone passes one card to the left' },
  lives: { zh: '九条命', en: 'NINE LIVES', d_zh: '从弃牌堆里捡回一张牌', d_en: 'Recover one card from the discard' },
  hiss: { zh: '嘶吼', en: 'HISS', d_zh: '在响应窗口取消别人刚出的牌', d_en: 'Cancel a just-played card (reaction)' },
  mirror: { zh: '镜爪', en: 'MIRROR PAW', d_zh: '被指定为目标时，把矛头转给别人', d_en: 'When targeted, redirect it elsewhere' },
};

function paw(cx: number, cy: number, r = 4) {
  return <g fill={W}><circle cx={cx} cy={cy} r={r} /><circle cx={cx - r - 1} cy={cy - r - 1} r={r * 0.42} /><circle cx={cx} cy={cy - r - 2} r={r * 0.42} /><circle cx={cx + r + 1} cy={cy - r - 1} r={r * 0.42} /></g>;
}

function Icon({ k }: { k: Key }) {
  const S = { fill: 'none', stroke: W, strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  switch (k) {
    case 'curse': return <g><g {...S}><path d="M18 19 L14 7 L25 16" /><path d="M46 19 L50 7 L39 16" /><path d="M14 21 q18 -9 36 0 q3 15 -18 21 q-21 -6 -18 -21 Z" /><path d="M7 27 H19 M45 27 H57" strokeWidth={1.1} opacity={0.65} /></g><g fill={W}><path d="M24 24 l4 2 l-4 2 Z" /><path d="M40 24 l-4 2 l4 2 Z" /></g></g>;
    case 'ward': return <g {...S}><path d="M32 8 v3" /><path d="M22 41 q-2 -23 10 -28 q12 5 10 28 Z" /><path d="M17 41 H47" /><path d="M28 45 a4.5 4.5 0 0 0 8 0" /><path d="M12 20 l-4 -2 M52 20 l4 -2 M14 30 l-5 0 M50 30 l5 0" strokeWidth={1.2} opacity={0.6} /></g>;
    case 'nap': return <g {...S}><path d="M38 10 a17 17 0 1 0 0 32 a14 14 0 0 1 0 -32 Z" /><path d="M46 10 h9 l-9 9 h9" strokeWidth={1.6} /></g>;
    case 'swap': return <g>{paw(22, 34, 5)}{paw(42, 34, 5)}<g {...S} strokeWidth={1.6}><path d="M24 15 q8 -5 15 0" /><path d="M39 15 l-1 -4 M39 15 l-4 0" /><path d="M40 21 q-8 5 -15 0" /><path d="M25 21 l1 4 M25 21 l4 0" /></g></g>;
    case 'peek': return <g {...S}><path d="M14 17 q9 -8 18 0 q-9 8 -18 0 Z" /><circle cx={23} cy={17} r={2} fill={W} stroke="none" /><rect x={27} y={28} width={10} height={16} rx={1.5} /><path d="M32 28 q4 -6 0 -11 q-4 5 0 11 Z" fill={W} stroke="none" /></g>;
    case 'shuffle': return <g fill="#070708" stroke={W} strokeWidth={2} strokeLinejoin="round"><rect x={17} y={17} width={20} height={27} rx={2} transform="rotate(-13 27 30)" /><rect x={27} y={15} width={20} height={27} rx={2} transform="rotate(9 37 28)" /></g>;
    case 'hex': return <g {...S}><circle cx={32} cy={28} r={15} /><path d="M20 21 q22 7 0 16 M44 21 q-22 7 0 16 M18 28 H46" strokeWidth={1.5} opacity={0.85} /></g>;
    case 'thief': return <g {...S}><path d="M14 28 H44 l9 -9 v18 l-9 -9" /><path d="M22 21 v14 M29 19 v18 M36 21 v14 M42 24 v8" strokeWidth={1.5} opacity={0.85} /><circle cx={17} cy={28} r={1.6} fill={W} stroke="none" /></g>;
    case 'noise': return <g {...S}><path d="M20 23 v10 l9 6 V17 Z" fill={W} stroke="none" /><path d="M36 22 a8 8 0 0 1 0 12 M41 17 a15 15 0 0 1 0 22" /></g>;
    case 'lives': return <g><path d="M22 42 q-7 -3 -7 -13 q0 -10 9 -13 q1 -5 4 -5 q3 0 4 5 q9 3 9 13" fill="none" stroke={W} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /><path d="M19 17 l3 5 M37 17 l-3 5" stroke={W} strokeWidth={1.6} strokeLinecap="round" /><text x={44} y={42} fontSize={15} fontWeight={700} fill={W}>9</text></g>;
    case 'hiss': return <g {...S}><path d="M20 24 q12 -9 24 0" /><path d="M25 25 l2 7 l3 -6 l3 6 l3 -6 l3 6 l2 -7" strokeWidth={1.6} /><path d="M48 16 l7 -3 l-5 7 l7 0 l-6 6" strokeWidth={1.6} opacity={0.85} /></g>;
    case 'mirror': return <g>{paw(28, 20, 4.5)}<g opacity={0.45}>{paw(28, 41, 4.5)}</g><line x1={12} y1={30} x2={52} y2={30} stroke={W} strokeWidth={1.4} strokeDasharray="3 3" /></g>;
  }
}

export default function MccCard({ card, en, w = 120 }: { card: string; en?: boolean; w?: number }) {
  const k = card as Key; const m = INFO[k];
  if (!m) return null;
  return (
    <div style={{ width: w }} className="select-none rounded-xl border border-white/25 bg-[#070708] overflow-hidden flex flex-col" >
      <div className="px-2 pt-2">
        <div className="rounded-lg border border-white/10 bg-black relative">
          <svg viewBox="0 0 64 60" style={{ width: '100%', height: 'auto', display: 'block' }}>
            {/* 神秘暗纹：淡淡的圆环符印 */}
            <circle cx="32" cy="28" r="24" fill="none" stroke={W} strokeOpacity="0.07" />
            <circle cx="32" cy="28" r="27" fill="none" stroke={W} strokeOpacity="0.04" />
            {/* 四角刻痕 */}
            <g stroke={W} strokeOpacity="0.25" strokeWidth="1"><path d="M6 6 h5 M6 6 v5 M58 6 h-5 M58 6 v5 M6 54 h5 M6 54 v-5 M58 54 h-5 M58 54 v-5" /></g>
            <Icon k={k} />
          </svg>
        </div>
      </div>
      <div className="px-1.5 pt-2 text-center text-[10.5px] font-serif" style={{ color: W, letterSpacing: en ? '0.12em' : '0.22em' }}>{en ? m.en : m.zh}</div>
      <div className="mx-2 my-1 border-t border-white/12" />
      <div className="px-2 pb-2 text-center leading-snug" style={{ color: 'rgba(236,233,226,0.62)', fontSize: w >= 110 ? 10 : 9 }}>{en ? m.d_en : m.d_zh}</div>
    </div>
  );
}
