'use client';
import { useMemo, useState } from 'react';
import { parseBeat, splitBeats } from '@/lib/narrate';

// 旁白呈现：一个节拍一行，逐拍浮现；动作/喊叫/低语/音效/对白各用不同字体、字号、颜色。
export default function Narration({ text, lang, fresh = false, tone = 'kp', label, collapse = true }: {
  text: string; lang?: string; fresh?: boolean; tone?: 'kp' | 'danger' | 'reveal' | 'quiet'; label?: string; collapse?: boolean;
}) {
  const beats = useMemo(() => splitBeats(text, lang), [text, lang]);
  const [open, setOpen] = useState(false);
  const cut = collapse && !fresh && !open && beats.length > 5;
  const shown = cut ? beats.slice(0, 3) : beats;
  const en = lang === 'en';
  return (
    <div className={`nf nf-${tone} mx-auto w-full max-w-2xl`}>
      {label && <div className="nf-label">{label}</div>}
      <div className="nf-body">
        {shown.map((b, i) => (
          <p key={i} className={`nf-beat ${fresh ? 'nf-in' : ''}`} style={fresh ? { animationDelay: `${Math.min(i, 6) * 0.55}s` } : undefined}>
            {parseBeat(b).map((s, j) => {
              if (s.k === 'text') return <span key={j}>{s.t}</span>;
              if (s.k === 'say') return <span key={j} className="nf-say">{en ? `“${s.t}”` : `「${s.t}」`}</span>;
              return <span key={j} className={`nf-${s.k}`}>{s.t}</span>;
            })}
          </p>
        ))}
      </div>
      {cut && (
        <button onClick={() => setOpen(true)} className="nf-more">{en ? `Read the rest (${beats.length - 3} more)` : `展开全文（还有 ${beats.length - 3} 段）`}</button>
      )}
    </div>
  );
}
