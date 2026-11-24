'use client';
// 故事文字里的排版标记 → 夸张的视觉：动作加粗发光、喊叫放大抖动、低语变小变淡、拟声做成发光标签
import { parseBeat } from '@/lib/narrate';

export const BEAT_CSS = `@keyframes gsShake{0%,100%{transform:translate(0,0)}20%{transform:translate(-2px,1px) rotate(-1deg)}40%{transform:translate(2px,-1px) rotate(1deg)}60%{transform:translate(-1px,-1px)}80%{transform:translate(1px,1px)}}.gs-shake{animation:gsShake .35s linear 3}@keyframes gsPulse{0%,100%{box-shadow:0 0 0 0 rgba(232,168,124,0)}50%{box-shadow:0 0 18px 2px rgba(232,168,124,.45)}}.gs-pulse{animation:gsPulse 1.4s ease-in-out 2}`;

export default function Beat({ text, cur }: { text: string; cur?: boolean }) {
  const segs = parseBeat(text);
  return <>{segs.map((g, i) => {
    if (g.k === 'act') return <b key={i} className="font-semibold text-[#ffd98f] [text-shadow:0_0_14px_rgba(255,190,90,.35)]">{g.t}</b>;
    if (g.k === 'shout') return <span key={i} className={`inline-block mx-0.5 font-black text-[1.55em] leading-none text-[#ff5a4f] [text-shadow:0_0_22px_rgba(255,60,50,.6)] ${cur ? 'gs-shake' : ''}`}>{g.t}</span>;
    if (g.k === 'whisper') return <span key={i} className="italic text-[0.86em] tracking-[.18em] text-[#b9c6dd]/75 [text-shadow:0_0_10px_rgba(150,170,210,.35)]">{g.t}</span>;
    if (g.k === 'sfx') return <span key={i} className={`inline-block mx-1 px-2 py-0.5 rounded-md border border-[#e8a87c]/40 bg-[#e8a87c]/10 text-[0.78em] tracking-[.32em] text-[#f2c09a] align-middle ${cur ? 'gs-pulse' : ''}`}>{g.t}</span>;
    if (g.k === 'say') return <span key={i} className="text-[#fff0dc]">「{g.t}」</span>;
    return <span key={i}>{g.t}</span>;
  })}</>;
}
