import * as React from 'react';
export function ScoreBar({ label, score, max = 10 }: { label: string; score: number; max?: number }) {
  const pct = Math.max(0, Math.min(100, (score / max) * 100));
  const col = pct >= 85 ? 'bg-state-success' : pct >= 70 ? 'bg-mystic' : pct >= 50 ? 'bg-state-warning' : 'bg-state-danger';
  return (
    <div className="flex items-center gap-2">
      <span className="w-20 shrink-0 text-[11px] text-text-secondary">{label}</span>
      <div className="h-1.5 flex-1 overflow-hidden rounded bg-bg-page"><div className={`h-full ${col}`} style={{ width: `${pct}%` }} /></div>
      <span className="w-10 text-right text-[11px] text-text-primary">{score}<span className="text-text-muted">/{max}</span></span>
    </div>
  );
}
