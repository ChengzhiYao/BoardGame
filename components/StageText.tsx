'use client';
// 念到哪、字就从哪冒出来：屏幕中间只放正在念的那一句，大字，一个字一个字跟着声音出现。
// 喊叫的字放大、发红、抖着蹦出来；低语的字慢慢浮现、发虚；动作和关键细节发金光；拟声做成会亮的标签；安静的段落字出现得更慢更柔。
import { parseBeat } from '@/lib/narrate';

export const STAGE_CSS = `
@keyframes chIn{from{opacity:0;transform:translateY(.25em);filter:blur(6px)}to{opacity:1;transform:none;filter:none}}
@keyframes chSoft{from{opacity:0;filter:blur(8px)}to{opacity:1;filter:none}}
@keyframes chPop{0%{opacity:0;transform:scale(2.4) rotate(-6deg)}45%{opacity:1;transform:scale(.88) rotate(3deg)}65%{transform:scale(1.12) rotate(-2deg)}80%{transform:translate(-2px,1px)}90%{transform:translate(2px,-1px)}100%{transform:none}}
@keyframes chGhost{from{opacity:0;transform:translateY(-.15em);filter:blur(10px)}to{opacity:.72;filter:blur(.6px)}}
@keyframes chGlow{0%{opacity:0;text-shadow:0 0 0 rgba(255,200,110,0)}50%{opacity:1;text-shadow:0 0 28px rgba(255,200,110,.9)}100%{opacity:1;text-shadow:0 0 14px rgba(255,190,90,.4)}}
@keyframes sfxIn{0%{opacity:0;transform:scale(.6)}60%{opacity:1;transform:scale(1.15)}100%{transform:none;box-shadow:0 0 22px rgba(232,168,124,.5)}}
@keyframes stFlicker{0%,100%{opacity:1}47%{opacity:1}48%{opacity:.55}50%{opacity:1}73%{opacity:.8}74%{opacity:1}}
@keyframes prevUp{from{opacity:.9;transform:translateY(0)}to{opacity:.28;transform:translateY(-6px)}}
.ch{display:inline-block;white-space:pre}
.ch-wait{opacity:0}
.ch-in{animation:chIn .32s ease-out both}
.ch-soft{animation:chSoft 1.1s ease-out both}
.ch-pop{animation:chPop .6s cubic-bezier(.2,1.6,.4,1) both;color:#ff4d42;font-weight:900;text-shadow:0 0 26px rgba(255,60,50,.75)}
.ch-ghost{animation:chGhost 1.3s ease-out both;color:#b9c6dd;font-style:italic;letter-spacing:.12em}
.ch-glow{animation:chGlow .9s ease-out both;color:#ffd98f;font-weight:600}
.ch-say{color:#fff0dc}
.st-scary{animation:stFlicker 3.2s linear infinite}
.prev-line{animation:prevUp .5s ease-out both}
`;

// 按句子切（不在标记中间切断）
export function splitSentences(text: string): string[] {
  const out: string[] = []; let cur = ''; let open = { b: false, s: false, w: 0, x: 0, q: 0 };
  const t = String(text || '');
  for (let i = 0; i < t.length; i++) {
    const two = t.slice(i, i + 2);
    if (two === '**') { open.b = !open.b; cur += two; i++; continue; }
    if (two === '!!') { open.s = !open.s; cur += two; i++; continue; }
    if (two === '((') { open.w++; cur += two; i++; continue; }
    if (two === '))') { open.w = Math.max(0, open.w - 1); cur += two; i++; continue; }
    if (two === '[[') { open.x++; cur += two; i++; continue; }
    if (two === ']]') { open.x = Math.max(0, open.x - 1); cur += two; i++; continue; }
    const ch = t[i]; cur += ch;
    if (ch === '「' || ch === '“') open.q++;
    if (ch === '」' || ch === '”') open.q = Math.max(0, open.q - 1);
    const inside = open.b || open.s || open.w || open.x;
    const end = /[。！？!?…]/.test(ch) && !/[。！？!?…」”]/.test(t[i + 1] || '') && !inside && !open.q;
    const endQ = (ch === '」' || ch === '”') && !open.q && !inside;
    if ((end || endQ) && cur.replace(/\*\*|!!|\(\(|\)\)|\[\[|\]\]/g, '').trim().length >= 6) { out.push(cur.trim()); cur = ''; }
  }
  if (cur.trim()) { if (out.length && cur.replace(/\*\*|!!|\(\(|\)\)|\[\[|\]\]/g, '').trim().length < 4) out[out.length - 1] += cur; else out.push(cur.trim()); }
  return out.length ? out : [t];
}

const plainLen = (s: string) => parseBeat(s).reduce((a, g) => a + Array.from(g.t).length + (g.k === 'say' ? 2 : 0), 0);
export { plainLen };

// 把 0~1 的进度换算成"这一段里念到第几句、这一句念到百分之几"
export function locate(sentences: string[], p: number): { si: number; sp: number } {
  const lens = sentences.map((s) => Math.max(1, plainLen(s)));
  const total = lens.reduce((a, b) => a + b, 0);
  let x = Math.max(0, Math.min(0.9999, p)) * total;
  for (let i = 0; i < lens.length; i++) { if (x < lens[i]) return { si: i, sp: x / lens[i] }; x -= lens[i]; }
  return { si: lens.length - 1, sp: 1 };
}

export default function StageText({ text, p, calm, scary, label, labelColor }: { text: string; p: number; calm?: boolean; scary?: boolean; label?: string; labelColor?: string }) {
  const segs = parseBeat(text);
  const chars: { c: string; k: string }[] = [];
  for (const g of segs) {
    if (g.k === 'say') { chars.push({ c: '「', k: 'say' }); Array.from(g.t).forEach((c) => chars.push({ c, k: 'say' })); chars.push({ c: '」', k: 'say' }); }
    else Array.from(g.t).forEach((c) => chars.push({ c, k: g.k }));
  }
  const n = chars.length;
  const shown = Math.min(n, Math.ceil(Math.max(0, Math.min(1, p)) * n * 1.04));
  const size = n <= 12 ? 'clamp(30px, 9vw, 46px)' : n <= 24 ? 'clamp(26px, 7.4vw, 38px)' : n <= 40 ? 'clamp(22px, 6.2vw, 32px)' : 'clamp(19px, 5.2vw, 27px)';
  return (
    <div className={`text-center font-serif leading-[1.55] text-[#f7ecd8] ${scary ? 'st-scary' : ''}`} style={{ fontSize: size }}>
      <style>{STAGE_CSS}</style>
      {label && <div className="mb-3 text-[13px] tracking-[.25em] font-sans" style={{ color: labelColor || '#c9a96e' }}>{label}</div>}
      {chars.map((x, i) => {
        if (i >= shown) return <span key={i} className="ch ch-wait">{x.c}</span>;
        const cls = x.k === 'shout' ? 'ch-pop' : x.k === 'whisper' ? 'ch-ghost' : x.k === 'act' ? 'ch-glow' : x.k === 'say' ? 'ch-in ch-say' : x.k === 'sfx' ? 'ch-in' : calm ? 'ch-soft' : 'ch-in';
        if (x.k === 'sfx') return <span key={i} className="ch" style={{ animation: 'sfxIn .5s ease-out both', color: '#f2c09a', letterSpacing: '.3em', fontSize: '.7em', padding: '0 .1em', borderBottom: '2px solid rgba(232,168,124,.45)' }}>{x.c}</span>;
        return <span key={i} className={`ch ${cls}`}>{x.c}</span>;
      })}
    </div>
  );
}
