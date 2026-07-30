'use client';

import React from 'react';
import { Button } from '@/shared/ui/Button';

export interface ToolProgressProps {
  /** Current stage / status message. */
  stage: string;
  /**
   * Real progress 0–100. Omit or pass null/undefined for indeterminate
   * (no fake percentages).
   */
  percent?: number | null;
  currentPage?: number;
  totalPages?: number;
  currentFile?: number;
  totalFiles?: number;
  /** Preformatted elapsed time, e.g. `01:23`. */
  elapsedLabel?: string;
  onCancel?: () => void;
  className?: string;
}

function clampPercent(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(100, Math.max(0, Math.round(n)));
}

export function ToolProgress({
  stage,
  percent,
  currentPage,
  totalPages,
  currentFile,
  totalFiles,
  elapsedLabel,
  onCancel,
  className,
}: ToolProgressProps) {
  const hasPercent = percent != null && Number.isFinite(percent);
  const pct = hasPercent ? clampPercent(percent as number) : null;
  const hasPages =
    currentPage != null && totalPages != null && totalPages > 0;
  const hasFiles =
    currentFile != null && totalFiles != null && totalFiles > 0;

  return (
    <div
      className={`space-y-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)]/60 p-3 ${className ?? ''}`}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="min-w-0 flex-1 text-sm font-medium text-[var(--color-ink)]">
          {stage}
        </p>
        <div className="flex flex-shrink-0 items-center gap-3 text-xs text-[var(--color-muted)]">
          {elapsedLabel ? (
            <span className="font-mono tabular-nums" title="Elapsed">
              {elapsedLabel}
            </span>
          ) : null}
          {pct != null ? (
            <span className="font-semibold tabular-nums text-[var(--color-ink)]">
              {pct}%
            </span>
          ) : null}
          {onCancel ? (
            <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
              Cancel
            </Button>
          ) : null}
        </div>
      </div>

      <div
        className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--color-border)]"
        aria-hidden
      >
        {pct != null ? (
          <div
            className="h-full rounded-full bg-[var(--color-accent)] transition-[width] duration-200"
            style={{ width: `${pct}%` }}
          />
        ) : (
          <div className="h-full w-full animate-pulse rounded-full bg-[var(--color-accent)]/50" />
        )}
      </div>

      {(hasPages || hasFiles) && (
        <p className="text-xs text-[var(--color-muted)]">
          {hasPages ? (
            <span>
              Page {Math.min(currentPage!, totalPages!)} / {totalPages}
            </span>
          ) : null}
          {hasPages && hasFiles ? <span aria-hidden> · </span> : null}
          {hasFiles ? (
            <span>
              File {Math.min(currentFile!, totalFiles!)} / {totalFiles}
            </span>
          ) : null}
        </p>
      )}
    </div>
  );
}

export default ToolProgress;
