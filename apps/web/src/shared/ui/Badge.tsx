import React from 'react';
import { cn } from '@/lib/utils';

export type BadgeTone =
  | 'neutral'
  | 'accent'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info';

const tones: Record<BadgeTone, string> = {
  neutral:
    'bg-[var(--color-surface-2)] text-[var(--color-muted)]',
  accent:
    'bg-[var(--color-accent-soft)] text-[var(--color-accent)]',
  success:
    'bg-[var(--color-success-soft)] text-[var(--color-success)]',
  warning:
    'bg-[var(--color-warning-soft)] text-[var(--color-warning)]',
  danger:
    'bg-[var(--color-danger-soft)] text-[var(--color-danger)]',
  info:
    'bg-[var(--color-info-soft)] text-[var(--color-info)]',
};

export function Badge({
  tone = 'neutral',
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide',
        tones[tone],
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}
