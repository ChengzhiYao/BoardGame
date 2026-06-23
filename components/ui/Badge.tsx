import * as React from 'react';
type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'info';
const C: Record<Tone, string> = {
  neutral: 'bg-text-secondary/15 border-text-secondary/45 text-text-secondary',
  success: 'bg-state-success/15 border-state-success/45 text-state-success',
  warning: 'bg-state-warning/15 border-state-warning/45 text-state-warning',
  danger: 'bg-state-danger/15 border-state-danger/45 text-state-danger',
  info: 'bg-state-info/15 border-state-info/45 text-state-info',
};
export function Badge({ tone = 'neutral', children }: { tone?: Tone; children: React.ReactNode }) {
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-serif ${C[tone]}`}>{children}</span>;
}
