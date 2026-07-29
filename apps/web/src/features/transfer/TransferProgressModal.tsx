'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  Download,
  FileText,
  FolderOpen,
  Loader2,
  RotateCcw,
  X,
} from 'lucide-react';
import { Dialog } from '@/shared/ui/Dialog';
import { ProgressBar } from '@/shared/ui/ProgressBar';
import { cn } from '@/lib/utils';
import type { TransferPhase, TransferState } from './useTransferOperation';
import { isActivePhase } from './useTransferOperation';
import {
  formatElapsed,
  formatTransferBytes,
  formatTransferEta,
  formatTransferSpeed,
} from './transferFormat';

export interface TransferStageStep {
  key: string;
  label: string;
}

export interface TransferProgressModalProps {
  open: boolean;
  state: TransferState;
  fileName: string;
  /** Short kind label, e.g. "PDF" or "Word". */
  fileKind?: string;
  steps?: TransferStageStep[];
  /** Which step key the current phase maps to (for the stepper). */
  activeStepKey?: string;
  /** Override the phase-derived heading (e.g. downloads vs uploads). */
  titleOverrides?: Partial<Record<TransferPhase, string>>;
  emailNote?: string | null;
  onCancel?: () => void;
  onClose: () => void;
  onDownload?: () => void;
  onOpen?: () => void;
  /** Optional cloud delivery after a local export succeeds. */
  onEmailCopy?: () => void;
  onRetry?: () => void;
  downloadDisabled?: boolean;
}

const TITLE_BY_PHASE: Record<TransferPhase, string> = {
  idle: 'Preparing',
  preparing: 'Preparing your file',
  processing: 'Processing your file',
  uploading: 'Uploading your file',
  finalizing: 'Finalizing',
  cancelling: 'Cancelling…',
  cancelled: 'Transfer cancelled',
  completed: 'Ready to download',
  failed: 'Something went wrong',
};

function milestoneMessage(state: TransferState, fileName: string): string {
  switch (state.phase) {
    case 'completed':
      return `${fileName || 'File'} ready to download.`;
    case 'failed':
      return `Transfer failed. ${state.error ?? ''}`.trim();
    case 'cancelled':
      return 'Transfer cancelled.';
    case 'cancelling':
      return 'Cancelling transfer.';
    default: {
      const stage = state.stageLabel || TITLE_BY_PHASE[state.phase];
      if (state.percent != null) {
        return `${stage}, ${state.percent} percent.`;
      }
      return stage;
    }
  }
}

/** Only announce crossing 25/50/75 to avoid spamming the live region. */
function milestoneBucket(percent: number | null): number {
  if (percent == null) return -1;
  if (percent >= 100) return 100;
  if (percent >= 75) return 75;
  if (percent >= 50) return 50;
  if (percent >= 25) return 25;
  return 0;
}

export function TransferProgressModal({
  open,
  state,
  fileName,
  fileKind,
  steps,
  activeStepKey,
  titleOverrides,
  emailNote,
  onCancel,
  onClose,
  onDownload,
  onOpen,
  onEmailCopy,
  onRetry,
  downloadDisabled,
}: TransferProgressModalProps) {
  const active = isActivePhase(state.phase);
  const title = titleOverrides?.[state.phase] ?? TITLE_BY_PHASE[state.phase];
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  const lastBucketRef = useRef<number>(-1);
  const lastStageRef = useRef<string>('');
  const lastPhaseRef = useRef<TransferPhase>('idle');

  // Announce milestone / stage / phase changes only (polite live region).
  useEffect(() => {
    if (!open) return;
    const bucket = milestoneBucket(state.percent);
    const phaseChanged = lastPhaseRef.current !== state.phase;
    const stageChanged = lastStageRef.current !== state.stageLabel;
    const bucketChanged = bucket !== lastBucketRef.current;
    if (phaseChanged || stageChanged || (bucketChanged && bucket > 0)) {
      setAnnouncement(milestoneMessage(state, fileName));
      lastPhaseRef.current = state.phase;
      lastStageRef.current = state.stageLabel;
      lastBucketRef.current = bucket;
    }
  }, [open, state, fileName]);

  useEffect(() => {
    if (!active) setConfirmingCancel(false);
  }, [active]);

  const handleClose = () => {
    if (active) {
      // Escape / overlay during an active transfer maps to Cancel intent.
      if (state.canCancel) attemptCancel();
      return;
    }
    onClose();
  };

  const attemptCancel = () => {
    if (!state.canCancel || !onCancel) return;
    const hasProgress =
      (state.percent != null && state.percent >= 25) ||
      (state.bytesSent != null && state.bytesSent > 0);
    if (hasProgress && !confirmingCancel) {
      setConfirmingCancel(true);
      return;
    }
    setConfirmingCancel(false);
    onCancel();
  };

  const showMeta =
    state.bytesSent != null ||
    state.speedBps != null ||
    state.etaSeconds != null ||
    state.unitsTotal != null;

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      size="md"
      showClose={false}
      closeOnOverlay={!active}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <PhaseIcon phase={state.phase} />
          <div>
            <h2 className="font-display text-lg text-[color:var(--color-ink)]">
              {title}
            </h2>
            {fileKind && (
              <p className="text-xs font-medium text-[color:var(--color-muted)]">
                {fileKind} document
              </p>
            )}
          </div>
        </div>
        {!active && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="rounded-lg p-1.5 text-[color:var(--color-muted)] hover:bg-[color:var(--color-surface-2)] hover:text-[color:var(--color-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-accent)]"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      <div className="mt-4 flex items-center gap-3 rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] p-3">
        <div className="rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-2.5 text-[color:var(--color-accent)]">
          <FileText className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p
            className="truncate text-sm font-semibold text-[color:var(--color-ink)]"
            title={fileName}
          >
            {fileName}
          </p>
          {state.totalBytes != null && state.totalBytes > 0 && (
            <p className="text-[11px] font-medium text-[color:var(--color-muted)]">
              {formatTransferBytes(state.totalBytes)}
            </p>
          )}
        </div>
      </div>

      {steps && steps.length > 0 && (
        <ol className="mt-4 space-y-1.5">
          {steps.map((step) => {
            const status = stepStatus(step.key, activeStepKey, state.phase, steps);
            return (
              <li
                key={step.key}
                className="flex items-center gap-2.5 text-xs font-medium"
              >
                <StepDot status={status} />
                <span
                  className={cn(
                    status === 'done' && 'text-[color:var(--color-ink)]',
                    status === 'active' && 'text-[color:var(--color-accent)] font-semibold',
                    status === 'pending' && 'text-[color:var(--color-muted)]'
                  )}
                >
                  {step.label}
                </span>
              </li>
            );
          })}
        </ol>
      )}

      {(active || state.phase === 'cancelling') && (
        <div className="mt-4">
          <ProgressBar
            value={state.percent ?? 0}
            indeterminate={state.percent == null || state.phase === 'cancelling'}
            label={state.stageLabel || TITLE_BY_PHASE[state.phase]}
            tone="accent"
          />
        </div>
      )}

      {showMeta && (active || state.phase === 'cancelling') && (
        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-xs sm:grid-cols-4">
          {state.bytesSent != null && state.totalBytes != null && (
            <Meta label="Transferred">
              {formatTransferBytes(state.bytesSent)} /{' '}
              {formatTransferBytes(state.totalBytes)}
            </Meta>
          )}
          {state.unitsTotal != null && (
            <Meta label={state.unitLabel ?? 'Items'}>
              {state.unitsDone ?? 0} / {state.unitsTotal}
            </Meta>
          )}
          {state.speedBps != null && (
            <Meta label="Speed">{formatTransferSpeed(state.speedBps)}</Meta>
          )}
          {state.etaSeconds !== undefined && (
            <Meta label="ETA">{formatTransferEta(state.etaSeconds)}</Meta>
          )}
          <Meta label="Elapsed">{formatElapsed(state.elapsedMs)}</Meta>
        </dl>
      )}

      {state.phase === 'failed' && state.error && (
        <div className="mt-4 flex items-start gap-2 rounded-xl border border-[color:var(--color-danger)]/30 bg-[color:var(--color-danger-soft)] px-3 py-2.5 text-xs font-medium text-[color:var(--color-danger)]">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{state.error}</span>
        </div>
      )}

      {state.phase === 'finalizing' && !state.canCancel && (
        <p className="mt-3 text-[11px] font-medium text-[color:var(--color-muted)]">
          Finalizing — cancellation is unavailable at this step.
        </p>
      )}

      {emailNote && (state.phase === 'completed' || state.phase === 'finalizing') && (
        <p className="mt-3 rounded-xl border border-[color:var(--color-info)]/30 bg-[color:var(--color-info-soft)] px-3 py-2 text-[11px] font-medium text-[color:var(--color-info)]">
          {emailNote}
        </p>
      )}

      <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        {active && state.canCancel && onCancel && (
          <>
            {confirmingCancel ? (
              <>
                <SecondaryButton onClick={() => setConfirmingCancel(false)}>
                  Keep going
                </SecondaryButton>
                <DangerButton onClick={attemptCancel}>Cancel transfer</DangerButton>
              </>
            ) : (
              <SecondaryButton onClick={attemptCancel}>Cancel</SecondaryButton>
            )}
          </>
        )}

        {state.phase === 'failed' && (
          <>
            <SecondaryButton onClick={onClose}>Close</SecondaryButton>
            {onRetry && (
              <PrimaryButton onClick={onRetry}>
                <RotateCcw className="h-4 w-4" /> Try again
              </PrimaryButton>
            )}
          </>
        )}

        {state.phase === 'cancelled' && (
          <>
            <SecondaryButton onClick={onClose}>Close</SecondaryButton>
            {onRetry && (
              <PrimaryButton onClick={onRetry}>
                <RotateCcw className="h-4 w-4" /> Try again
              </PrimaryButton>
            )}
          </>
        )}

        {state.phase === 'completed' && (
          <>
            <SecondaryButton onClick={onClose}>Done</SecondaryButton>
            {onEmailCopy && (
              <SecondaryButton onClick={onEmailCopy}>Email a copy</SecondaryButton>
            )}
            {onOpen && (
              <SecondaryButton onClick={onOpen}>
                <FolderOpen className="h-4 w-4" /> Open
              </SecondaryButton>
            )}
            {onDownload && (
              <PrimaryButton onClick={onDownload} disabled={downloadDisabled}>
                <Download className="h-4 w-4" /> Download
              </PrimaryButton>
            )}
          </>
        )}
      </div>

      <div aria-live="polite" role="status" className="sr-only">
        {announcement}
      </div>
    </Dialog>
  );
}

type StepState = 'done' | 'active' | 'pending';

function stepStatus(
  key: string,
  activeStepKey: string | undefined,
  phase: TransferPhase,
  steps: TransferStageStep[]
): StepState {
  if (phase === 'completed') return 'done';
  if (!activeStepKey) return 'pending';
  const activeIdx = steps.findIndex((s) => s.key === activeStepKey);
  const thisIdx = steps.findIndex((s) => s.key === key);
  if (thisIdx < activeIdx) return 'done';
  if (thisIdx === activeIdx) return 'active';
  return 'pending';
}

function StepDot({ status }: { status: StepState }) {
  if (status === 'done') {
    return <CheckCircle2 className="h-4 w-4 text-[color:var(--color-success)]" />;
  }
  if (status === 'active') {
    return <Loader2 className="h-4 w-4 animate-spin text-[color:var(--color-accent)]" />;
  }
  return (
    <span className="flex h-4 w-4 items-center justify-center">
      <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--color-border)]" />
    </span>
  );
}

function PhaseIcon({ phase }: { phase: TransferPhase }) {
  const base = 'flex h-10 w-10 items-center justify-center rounded-full border';
  if (phase === 'completed') {
    return (
      <div
        className={cn(
          base,
          'border-[color:var(--color-success)]/30 bg-[color:var(--color-success-soft)] text-[color:var(--color-success)]'
        )}
      >
        <CheckCircle2 className="h-5 w-5" />
      </div>
    );
  }
  if (phase === 'failed') {
    return (
      <div
        className={cn(
          base,
          'border-[color:var(--color-danger)]/30 bg-[color:var(--color-danger-soft)] text-[color:var(--color-danger)]'
        )}
      >
        <AlertTriangle className="h-5 w-5" />
      </div>
    );
  }
  if (phase === 'cancelled') {
    return (
      <div
        className={cn(
          base,
          'border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] text-[color:var(--color-muted)]'
        )}
      >
        <Ban className="h-5 w-5" />
      </div>
    );
  }
  return (
    <div
      className={cn(
        base,
        'border-[color:var(--color-accent)]/30 bg-[color:var(--color-accent-soft)] text-[color:var(--color-accent)]'
      )}
    >
      <Loader2 className="h-5 w-5 animate-spin" />
    </div>
  );
}

function Meta({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[10px] font-semibold uppercase tracking-wide text-[color:var(--color-muted)]">
        {label}
      </dt>
      <dd className="mt-0.5 font-semibold text-[color:var(--color-ink)]">{children}</dd>
    </div>
  );
}

function PrimaryButton({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[color:var(--color-accent)] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[color:var(--color-accent-hover)] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-accent)]"
    >
      {children}
    </button>
  );
}

function SecondaryButton({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-4 py-2.5 text-sm font-semibold text-[color:var(--color-ink)] hover:bg-[color:var(--color-surface-2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-accent)]"
    >
      {children}
    </button>
  );
}

function DangerButton({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[color:var(--color-danger)] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-danger)]"
    >
      {children}
    </button>
  );
}
