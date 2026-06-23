import * as React from 'react';
type Variant = 'primary' | 'secondary' | 'ghost' | 'mystic';
const V: Record<Variant, string> = {
  primary: 'bg-accent/85 hover:bg-accent text-text-primary border border-accent',
  secondary: 'bg-bg-surface text-text-secondary border border-border/40',
  ghost: 'bg-transparent text-text-secondary border border-border/40',
  mystic: 'bg-mystic/20 text-text-primary border border-mystic',
};
export function Button({ variant = 'primary', className = '', ...p }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return <button {...p} className={`inline-flex items-center gap-2 rounded-md px-5 py-[11px] text-sm font-serif transition-colors disabled:opacity-50 ${V[variant]} ${className}`} />;
}
