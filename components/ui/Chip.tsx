import * as React from 'react';
export function Chip({ selected = false, children, onClick }: { selected?: boolean; children: React.ReactNode; onClick?: () => void }) {
  return (
    <button onClick={onClick} className={`rounded-full border px-3.5 py-[7px] text-[13px] font-serif transition-colors ${selected ? 'bg-accent/30 border-accent text-text-primary' : 'bg-bg-surface border-border/30 text-text-secondary'}`}>
      {children}
    </button>
  );
}
