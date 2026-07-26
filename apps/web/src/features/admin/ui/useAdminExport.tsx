'use client';

import React, { useCallback, useState } from 'react';
import {
  TransferProgressModal,
  useTransferOperation,
  type TransferStageStep,
} from '@/features/transfer';
import { adminDownload, type QueryValue } from '../api';

const EXPORT_STEPS: TransferStageStep[] = [
  { key: 'processing', label: 'Generating export' },
  { key: 'uploading', label: 'Downloading' },
];

const TITLE_OVERRIDES = {
  preparing: 'Preparing export',
  processing: 'Generating export',
  uploading: 'Downloading export',
  finalizing: 'Finishing export',
  completed: 'Export downloaded',
  cancelled: 'Export cancelled',
  failed: 'Export failed',
} as const;

export interface RunExportArgs {
  /** Unique key for the triggering button (per-button busy state). */
  key: string;
  path: string;
  params?: Record<string, QueryValue | string[]>;
  filename: string;
  /** Friendly name shown in the modal, defaults to `filename`. */
  label?: string;
}

export interface UseAdminExportResult {
  run: (args: RunExportArgs) => Promise<void>;
  /** Key of the currently exporting button, or null. */
  busyKey: string | null;
  isExporting: boolean;
  /** Render this once per page to show export progress. */
  modal: React.ReactNode;
}

/**
 * Drives admin CSV/XLSX exports through the shared TransferProgressModal with
 * real byte progress (Content-Length), truncation warnings, cancellation, and
 * per-button busy keys (so CSV and Excel buttons don't toggle together).
 */
export function useAdminExport(): UseAdminExportResult {
  const transfer = useTransferOperation();
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [fileName, setFileName] = useState('export');
  const [truncated, setTruncated] = useState<{
    total: number | null;
    exported: number | null;
  } | null>(null);

  const run = useCallback(
    async ({ key, path, params, filename, label }: RunExportArgs) => {
      if (busyKey) return;
      setBusyKey(key);
      setFileName(label ?? filename);
      setTruncated(null);
      const signal = transfer.begin({
        phase: 'processing',
        stageLabel: 'Generating export…',
        percent: null,
        canCancel: true,
      });
      try {
        const result = await adminDownload(path, params, {
          filename,
          signal,
          onProgress: (p) => {
            transfer.update({
              phase: p.percent == null ? 'processing' : 'uploading',
              stageLabel:
                p.percent == null ? 'Generating export…' : 'Downloading…',
              percent: p.percent,
              bytesSent: p.receivedBytes,
              totalBytes: p.totalBytes ?? undefined,
            });
          },
        });
        if (result.truncated) {
          setTruncated({ total: result.total, exported: result.exported });
        }
        transfer.succeed({
          stageLabel: result.truncated
            ? 'Downloaded (partial export)'
            : 'Download complete',
          percent: 100,
        });
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          transfer.markCancelled({ stageLabel: 'Cancelled' });
        } else {
          transfer.fail(
            err instanceof Error && err.message ? err.message : 'Export failed'
          );
        }
      } finally {
        setBusyKey(null);
      }
    },
    [busyKey, transfer]
  );

  const truncationNote =
    truncated != null
      ? `Only the first ${truncated.exported?.toLocaleString() ?? ''} of ${
          truncated.total?.toLocaleString() ?? ''
        } rows were exported. Narrow your filters to export the rest.`
      : null;

  const modal = (
    <TransferProgressModal
      open={transfer.state.phase !== 'idle'}
      state={transfer.state}
      fileName={fileName}
      steps={EXPORT_STEPS}
      activeStepKey={
        transfer.state.phase === 'cancelling'
          ? undefined
          : transfer.state.phase === 'preparing'
            ? 'processing'
            : transfer.state.phase
      }
      titleOverrides={TITLE_OVERRIDES}
      emailNote={truncationNote}
      onCancel={() => transfer.requestCancel()}
      onClose={() => transfer.reset()}
    />
  );

  return {
    run,
    busyKey,
    isExporting: busyKey != null,
    modal,
  };
}
