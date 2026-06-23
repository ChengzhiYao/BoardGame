import * as React from 'react';
export function Card({ className = '', ...p }: React.HTMLAttributes<HTMLDivElement>) {
  return <div {...p} className={`rounded-lg border border-border/30 bg-bg-surface/70 p-4 ${className}`} />;
}
