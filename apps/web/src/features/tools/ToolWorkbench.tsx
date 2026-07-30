'use client';

import React, { useCallback, useId, useRef, useState } from 'react';
import { FileUp, Lock, ShieldCheck, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/shared/ui/Button';
import { formatTransferBytes } from '@/features/transfer/transferFormat';
import {
  badgeForProcessingMode,
  defaultDropHint,
  defaultPrivacyNote,
  type ProcessingMode,
} from './processingMode';

export interface ToolFile {
  id: string;
  file: File;
  name: string;
  size: number;
}

export interface ToolWorkbenchProps {
  title?: string;
  description?: string;
  accept?: string;
  multiple?: boolean;
  maxFiles?: number;
  files: ToolFile[];
  onFilesChange: (files: ToolFile[]) => void;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  busy?: boolean;
  /** Task.md §12 processing transparency. Default: local. */
  processingMode?: ProcessingMode;
  /** Optional override; otherwise derived from processingMode. */
  badgeLabel?: string;
  /** Drop-zone primary hint. */
  dropLabel?: string;
  /** Drop-zone secondary hint. */
  dropHint?: string;
  /** Footer privacy note under the lock icon. */
  privacyNote?: string;
  /** Accessible label for the file picker control. */
  pickerLabel?: string;
  /** Append “· experimental” to the mode badge. */
  experimental?: boolean;
}

function makeToolFile(file: File): ToolFile {
  return {
    id: `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2, 8)}`,
    file,
    name: file.name,
    size: file.size,
  };
}

export function ToolWorkbench({
  title,
  description,
  accept = 'application/pdf,.pdf',
  multiple = false,
  maxFiles = 1,
  files,
  onFilesChange,
  children,
  footer,
  className,
  busy = false,
  processingMode = 'local',
  badgeLabel,
  dropLabel = 'Drop a PDF here or click to browse',
  dropHint,
  privacyNote,
  pickerLabel = 'Choose PDF file',
  experimental = false,
}: ToolWorkbenchProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const resolvedBadge =
    badgeLabel ?? badgeForProcessingMode(processingMode, experimental);
  const resolvedPrivacy = privacyNote ?? defaultPrivacyNote(processingMode);
  const resolvedDropHint = dropHint ?? defaultDropHint(processingMode);

  const addFiles = useCallback(
    (list: FileList | File[]) => {
      const incoming = Array.from(list).filter((f) => {
        const lower = f.name.toLowerCase();
        const acceptParts = accept.split(',').map((a) => a.trim().toLowerCase());
        const okExt = acceptParts.some((a) => {
          if (a.startsWith('.')) return lower.endsWith(a);
          if (a.includes('/')) return false;
          return lower.endsWith(`.${a.replace('*', '')}`);
        });
        const okType =
          f.type === 'application/pdf' ||
          lower.endsWith('.pdf') ||
          (Boolean(f.type) && accept.includes(f.type)) ||
          okExt ||
          accept.includes('image/');
        return okType;
      });
      if (!incoming.length) return;
      if (multiple) {
        const next = [...files, ...incoming.map(makeToolFile)].slice(0, maxFiles);
        onFilesChange(next);
      } else {
        onFilesChange([makeToolFile(incoming[0])]);
      }
    },
    [accept, files, maxFiles, multiple, onFilesChange]
  );

  const removeFile = (id: string) => {
    onFilesChange(files.filter((f) => f.id !== id));
  };

  return (
    <section
      className={cn(
        'rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-sm md:p-6',
        className
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          {title ? (
            <h2 className="font-display text-xl text-[var(--color-ink)]">{title}</h2>
          ) : null}
          {description ? (
            <p className="mt-1 text-sm text-[var(--color-muted)]">{description}</p>
          ) : null}
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-accent-soft)] px-3 py-1 text-xs font-semibold text-[var(--color-accent)]">
          <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
          {resolvedBadge}
        </span>
      </div>

      <div
        className={cn(
          'mt-4 flex min-h-[140px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-8 transition-colors',
          dragOver
            ? 'border-[var(--color-accent)] bg-[var(--color-accent-soft)]'
            : 'border-[var(--color-border)] bg-[var(--color-surface-2)]/40 hover:border-[var(--color-accent)]/60',
          busy && 'pointer-events-none opacity-60'
        )}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        role="button"
        tabIndex={0}
        aria-controls={inputId}
        aria-label={pickerLabel}
      >
        <FileUp className="h-8 w-8 text-[var(--color-accent)]" aria-hidden />
        <p className="mt-2 text-sm font-medium text-[var(--color-ink)]">{dropLabel}</p>
        <p className="mt-1 text-xs text-[var(--color-muted)]">{resolvedDropHint}</p>
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept={accept}
          multiple={multiple}
          className="sr-only"
          disabled={busy}
          onChange={(e) => {
            if (e.target.files?.length) addFiles(e.target.files);
            e.target.value = '';
          }}
        />
      </div>

      {files.length > 0 ? (
        <ul className="mt-3 space-y-2" aria-label="Selected files">
          {files.map((f) => (
            <li
              key={f.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-[var(--color-ink)]">{f.name}</p>
                <p className="text-xs text-[var(--color-muted)]">
                  {formatTransferBytes(f.size)}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Remove ${f.name}`}
                disabled={busy}
                onClick={() => removeFile(f.id)}
              >
                <X className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
      ) : null}

      {children ? <div className="mt-5 space-y-4">{children}</div> : null}

      <p className="mt-4 flex items-start gap-2 text-xs text-[var(--color-muted)]">
        <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
        {resolvedPrivacy}
      </p>

      {footer ? <div className="mt-4 flex flex-wrap gap-2">{footer}</div> : null}
    </section>
  );
}
