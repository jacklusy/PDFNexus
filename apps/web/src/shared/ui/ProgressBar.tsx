'use client';

import React from 'react';
import { cn } from '@/lib/utils';

export interface ProgressBarProps {
  /** Ignored when `indeterminate` is true. */
  value?: number;
  max?: number;
  label?: string;
  className?: string;
  /** Renders an animated, value-less bar (aria-valuenow is omitted). */
  indeterminate?: boolean;
  tone?: 'accent' | 'success' | 'danger' | 'warning';
}

const toneMap: Record<NonNullable<ProgressBarProps['tone']>, string> = {
  accent: 'bg-[color:var(--color-accent)]',
  success: 'bg-[color:var(--color-success)]',
  danger: 'bg-[color:var(--color-danger)]',
  warning: 'bg-[color:var(--color-warning)]',
};

export function ProgressBar({
  value = 0,
  max = 100,
  label,
  className,
  indeterminate = false,
  tone = 'accent',
}: ProgressBarProps) {
  const pct = max <= 0 ? 0 : Math.min(100, Math.round((value / max) * 100));
  return (
    <div className={cn('w-full', className)}>
      {label && (
        <div className="mb-1.5 flex items-center justify-between text-[11px] font-semibold text-[color:var(--color-muted)]">
          <span>{label}</span>
          {!indeterminate && <span>{pct}%</span>}
        </div>
      )}
      <div
        className="relative h-2 overflow-hidden rounded-full bg-[color:var(--color-surface-2)] border border-[color:var(--color-border)]"
        role="progressbar"
        aria-valuenow={indeterminate ? undefined : pct}
        aria-valuemin={indeterminate ? undefined : 0}
        aria-valuemax={indeterminate ? undefined : 100}
        aria-label={label || 'Progress'}
      >
        {indeterminate ? (
          <div className={cn('progress-indeterminate-bar rounded-full', toneMap[tone])} />
        ) : (
          <div
            className={cn(
              'h-full rounded-full transition-[width] duration-300',
              toneMap[tone]
            )}
            style={{ width: `${pct}%` }}
          />
        )}
      </div>
    </div>
  );
}
