'use client';
// 午夜猫诅咒 · 原创卡面（纯 SVG 矢量，午夜闹鬼大宅主题）。全部为本项目原创美术。
import React from 'react';

type Key = 'curse' | 'ward' | 'nap' | 'swap' | 'peek' | 'shuffle' | 'hex' | 'thief' | 'noise' | 'lives' | 'hiss' | 'mirror';

const CFG: Record<Key, { c: string; e: string; zh: string; en: string; d_zh: string; d_en: string }> = {
  curse: { c: '#c83a32', e: '😼', zh: '诅咒猫', en: 'Curse Cat', d_zh: '抽到即出局，除非有护身铃', d_en: 'Draw it = out, unless warded' },
  ward: { c: '#e3b552', e: '🔔', zh: '护身铃', en: 'Ward Bell', d_zh: '化解诅咒猫并把它塞回牌堆', d_en: 'Cancel a drawn Curse Cat' },
  nap: { c: '#6c7bd0', e: '😴', zh: '打盹', en: 'Moon Nap', d_zh: '跳过抽牌，结束回合', d_en: 'Skip your draw' },
  swap: { c: '#4aa3a3', e: '🐾', zh: '换爪', en: 'Paw Swap', d_zh: '与一名玩家各换一张', d_en: 'Swap a card with a player' },
  peek: { c: '#d98b3a', e: '🕯️', zh: '烛光窥视', en: 'Candle Peek', d_zh: '偷看牌堆顶 3 张', d_en: 'See the top 3 cards' },
  shuffle: { c: '#8e7bd0', e: '🌀', zh: '走廊洗牌', en: 'Hallway Shuffle', d_zh: '把牌堆洗乱', d_en: 'Shuffle the deck' },
  hex: { c: '#b06a3a', e: '🧶', zh: '毛球诅咒', en: 'Hairball Hex', d_zh: '指定玩家连走两轮', d_en: 'A player takes 2 turns' },
  thief: { c: '#c98a4a', e: '🍤', zh: '零食小偷', en: 'Treat Thief', d_zh: '随机偷一名玩家一张牌', d_en: 'Steal a random card' },
  noise: { c: '#c04a7a', e: '🔊', zh: '地窖骚动', en: 'Basement Noise', d_zh: '所有人向左传一张牌', d_en: 'Everyone passes left' },
  lives: { c: '#4ab07a', e: '🐈', zh: '九条命', en: 'Nine Lives', d_zh: '从弃牌堆捡回一张牌', d_en: 'Recover a discarded card' },
  hiss: { c: '#d0533a', e: '🙀', zh: '嘶吼', en: 'Hiss', d_zh: '响应窗口取消他人出牌', d_en: 'Cancel a just-played card' },
  mirror: { c: '#6aa0c8', e: '🪞', zh: '镜爪', en: 'Mirror Paw', d_zh: '被指定时把矛头转给别人', d_en: 'Redirect a card aimed at you' },
};

function accents(k: Key, c: string) {
  switch (k) {
    case 'curse': return <g stroke={c} strokeWidth="1.4" opacity="0.7">{[0, 1, 2, 3, 4, 5].map((i) => { const a = (i * 60 + 30) * Math.PI / 180; return <line key={i} x1={60 + Math.cos(a) * 26} y1={52 + Math.sin(a) * 26} x2={60 + Math.cos(a) * 34} y2={52 + Math.sin(a) * 34} />; })}</g>;
    case 'ward': return <g fill="none" stroke={c} opacity="0.6"><circle cx="60" cy="52" r="30" /><circle cx="60" cy="52" r="34" strokeOpacity="0.4" /></g>;
    case 'nap': return <g fill={c} opacity="0.85"><text x="86" y="34" fontSize="11" fontWeight="700">z</text><text x="92" y="26" fontSize="8" fontWeight="700">z</text></g>;
    case 'swap': return <g fill="none" stroke={c} strokeWidth="1.6" opacity="0.7"><path d="M40 70 q20 12 40 0" markerEnd="" /><path d="M80 36 q-20 -12 -40 0" /></g>;
    case 'peek': return <g fill={c} opacity="0.8"><path d="M60 20 q5 8 0 14 q-5 -6 0 -14" /></g>;
    case 'shuffle': return <g fill="none" stroke={c} strokeWidth="1.5" opacity="0.6"><path d="M40 52 a20 20 0 1 1 6 14" /></g>;
    case 'hex': return <g fill="none" stroke={c} strokeWidth="1.3" opacity="0.6"><circle cx="60" cy="52" r="22" /><circle cx="60" cy="52" r="14" /></g>;
    case 'thief': return <g stroke={c} strokeWidth="1.4" strokeDasharray="3 3" opacity="0.7" fill="none"><path d="M30 78 q30 -18 60 0" /></g>;
    case 'noise': return <g fill="none" stroke={c} strokeWidth="1.6" opacity="0.6"><path d="M84 40 a14 14 0 0 1 0 24" /><path d="M90 34 a22 22 0 0 1 0 36" /></g>;
    case 'lives': return <text x="84" y="74" fontSize="16" fontWeight="800" fill={c} opacity="0.9">×9</text>;
    case 'hiss': return <g stroke={c} strokeWidth="1.6" opacity="0.75" fill="none"><path d="M82 44 l10 -4 l-7 8 l9 0 l-8 6" /></g>;
    case 'mirror': return <g stroke={c} strokeWidth="1.4" opacity="0.6"><line x1="60" y1="22" x2="60" y2="82" strokeDasharray="3 3" /></g>;
  }
}

export default function MccCard({ card, en, w = 80 }: { card: string; en?: boolean; w?: number }) {
  const k = card as Key; const m = CFG[k];
  if (!m) return null;
  const h = Math.round(w * 1.4);
  const id = `mcc-${k}`;
  return (
    <div style={{ width: w }} className="select-none">
      <svg viewBox="0 0 120 110" style={{ width: '100%', display: 'block' }}>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#15131c" />
            <stop offset="100%" stopColor="#0a0810" />
          </linearGradient>
        </defs>
        <rect x="2" y="2" width="116" height="106" rx="10" fill={`url(#${id})`} stroke={m.c} strokeWidth="2.5" />
        {/* 月亮 */}
        <circle cx="98" cy="18" r="8" fill="#f3ead0" opacity="0.9" /><circle cx="95" cy="16" r="7" fill="#0a0810" />
        {/* 窗棂暗纹 */}
        <g stroke={m.c} strokeOpacity="0.12" strokeWidth="1"><line x1="18" y1="14" x2="18" y2="100" /><line x1="102" y1="30" x2="102" y2="100" /></g>
        {/* 徽章圆盘 */}
        <circle cx="60" cy="52" r="27" fill={m.c} fillOpacity="0.16" stroke={m.c} strokeOpacity="0.5" strokeWidth="1.5" />
        <text x="60" y="64" fontSize="30" textAnchor="middle">{m.e}</text>
        {accents(k, m.c)}
        {/* 牌名横幅 */}
        <rect x="10" y="86" width="100" height="16" rx="4" fill={m.c} fillOpacity="0.9" />
        <text x="60" y="98" fontSize={en ? 8.5 : 10} fontWeight="700" textAnchor="middle" fill="#120f18">{en ? m.en : m.zh}</text>
      </svg>
      <div style={{ fontSize: 9, lineHeight: 1.15, color: 'rgba(232,228,216,0.55)', marginTop: 2, textAlign: 'center', minHeight: 22 }}>{en ? m.d_en : m.d_zh}</div>
    </div>
  );
}
