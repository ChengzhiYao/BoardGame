// 一起听故事的表情贴纸（自己画的，不用系统 emoji）
export const STICKERS: { k: string; zh: string; en: string; bg: string }[] = [
  { k: 'scared', zh: '吓死', en: 'Eek', bg: '#3d5a8a' },
  { k: 'creep', zh: '发毛', en: 'Creepy', bg: '#4a3f6b' },
  { k: 'wow', zh: '哇', en: 'Whoa', bg: '#8a6a2a' },
  { k: 'warm', zh: '好暖', en: 'Aww', bg: '#9a4a5a' },
  { k: 'cry', zh: '想哭', en: 'Sob', bg: '#2f6b7a' },
  { k: 'lol', zh: '哈哈', en: 'Haha', bg: '#9a7a2a' },
];

export default function Sticker({ k, size = 40 }: { k: string; size?: number }) {
  const s = STICKERS.find((x) => x.k === k) || STICKERS[0];
  const eye = '#1b1410';
  const face = (
    <>
      <circle cx="32" cy="32" r="27" fill="#f6d78f" />
      <circle cx="32" cy="32" r="27" fill="url(#g)" />
    </>
  );
  const parts: Record<string, JSX.Element> = {
    scared: <><ellipse cx="23" cy="27" rx="5" ry="6.5" fill="#fff" /><ellipse cx="41" cy="27" rx="5" ry="6.5" fill="#fff" /><circle cx="23" cy="28" r="2.2" fill={eye} /><circle cx="41" cy="28" r="2.2" fill={eye} /><ellipse cx="32" cy="44" rx="5.5" ry="7" fill={eye} /><path d="M14 18l6 3M50 18l-6 3" stroke={eye} strokeWidth="2.4" strokeLinecap="round" /><path d="M52 34c3 2 3 6 0 7" stroke="#7fb6ff" strokeWidth="2.6" fill="none" strokeLinecap="round" /></>,
    creep: <><path d="M18 27h10M36 27h10" stroke={eye} strokeWidth="3" strokeLinecap="round" /><path d="M20 44c3-3 5 3 8 0s5 3 8 0 5 3 8 0" stroke={eye} strokeWidth="2.6" fill="none" strokeLinecap="round" /><path d="M50 14c2 3 2 6 0 8M54 20c1.5 2 1.5 4 0 6" stroke="#9fd0ff" strokeWidth="2.2" fill="none" strokeLinecap="round" /></>,
    wow: <><circle cx="23" cy="27" r="3.2" fill={eye} /><circle cx="41" cy="27" r="3.2" fill={eye} /><circle cx="32" cy="43" r="6" fill={eye} /><path d="M17 19l7-2M47 19l-7-2" stroke={eye} strokeWidth="2.4" strokeLinecap="round" /></>,
    warm: <><path d="M17 29c2-4 8-4 10 0M37 29c2-4 8-4 10 0" stroke={eye} strokeWidth="2.6" fill="none" strokeLinecap="round" /><path d="M24 40c4 5 12 5 16 0" stroke={eye} strokeWidth="2.6" fill="none" strokeLinecap="round" /><circle cx="17" cy="37" r="4" fill="#f29a9a" opacity=".7" /><circle cx="47" cy="37" r="4" fill="#f29a9a" opacity=".7" /><path d="M50 8c2-3 6-1 5 2-1 3-5 5-5 5s-4-2-5-5c-1-3 3-5 5-2z" fill="#ff6b81" /></>,
    cry: <><path d="M17 28c3 2 7 2 10 0M37 28c3 2 7 2 10 0" stroke={eye} strokeWidth="2.6" fill="none" strokeLinecap="round" /><path d="M25 46c4-4 10-4 14 0" stroke={eye} strokeWidth="2.6" fill="none" strokeLinecap="round" /><path d="M21 31c-1 6-3 10-2 13M43 31c1 6 3 10 2 13" stroke="#7fc4ff" strokeWidth="3.2" fill="none" strokeLinecap="round" /></>,
    lol: <><path d="M17 28l6-3-6-3M47 28l-6-3 6-3" stroke={eye} strokeWidth="2.6" fill="none" strokeLinecap="round" strokeLinejoin="round" /><path d="M20 37h24c0 8-6 12-12 12s-12-4-12-12z" fill={eye} /><path d="M25 44c4 2 10 2 14 0" stroke="#ff8a8a" strokeWidth="3" fill="none" strokeLinecap="round" /></>,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-label={s.zh} className="shrink-0">
      <defs><radialGradient id="g" cx="35%" cy="30%" r="75%"><stop offset="0" stopColor="#fff6d6" stopOpacity=".6" /><stop offset="1" stopColor="#d9a64a" stopOpacity=".55" /></radialGradient></defs>
      {face}
      {parts[s.k]}
    </svg>
  );
}
