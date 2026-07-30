'use client';

import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/shared/ui/Button';

export interface ToolErrorProps {
  message: string;
  fileName?: string;
  /** Original file remains on disk / in picker. Default true. */
  originalSafe?: boolean;
  onRetry?: () => void;
  cloudNote?: string;
}

/**
 * Task.md §14 consistent error surface for tools.
 */
export function ToolError({
  message,
  fileName,
  originalSafe = true,
  onRetry,
  cloudNote,
}: ToolErrorProps) {
  return (
    <div
      className="rounded-xl border border-[var(--color-danger)]/40 bg-[var(--color-danger)]/5 p-4"
      role="alert"
    >
      <div className="flex gap-3">
        <AlertTriangle
          className="mt-0.5 h-5 w-5 shrink-0 text-[var(--color-danger)]"
          aria-hidden
        />
        <div className="min-w-0 space-y-2 text-sm">
          <p className="font-semibold text-[var(--color-ink)]">Something went wrong</p>
          <p className="text-[var(--color-danger)]">{message}</p>
          {fileName ? (
            <p className="text-[var(--color-muted)]">
              Affected file: <span className="font-medium text-[var(--color-ink)]">{fileName}</span>
            </p>
          ) : null}
          {originalSafe ? (
            <p className="text-[var(--color-muted)]">
              Your original file is unchanged and still on this device.
            </p>
          ) : null}
          {cloudNote ? (
            <p className="text-[var(--color-muted)]">{cloudNote}</p>
          ) : null}
          {onRetry ? (
            <Button size="sm" variant="secondary" onClick={onRetry}>
              Retry
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
