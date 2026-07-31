'use client';

import React, { useState } from 'react';
import { AlertTriangle } from 'lucide-react';

import { Button } from '@/shared/ui/Button';
import { downloadBlobLocally } from '@/features/files/localDownload';
import { DriveExportButton } from '@/features/cloud/DriveExportButton';
import { ToolWorkbench } from '../ToolWorkbench';
import { ToolError } from '../ToolError';
import { ToolProgress } from '../ToolProgress';
import { useTimedProgress } from '../useTimedProgress';
import { useToolHandoff } from '../useToolHandoff';
import { softLargePdfHint } from '../softLargePdfHint';
import { FLATTEN_WARNING, flattenPdf, shouldRefuseFlattenDownload } from './flattenPdf';

export function FlattenTool() {
  const { files, setFiles } = useToolHandoff();
  const [understood, setUnderstood] = useState(false);
  const [allowPartial, setAllowPartial] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [lastPdf, setLastPdf] = useState<File | null>(null);
  const cancelledRef = React.useRef(false);
  const { elapsedLabel } = useTimedProgress(busy);

  const file = files[0]?.file;
  const sizeHint = file ? softLargePdfHint(file.size) : null;

  const run = async () => {
    if (!file || !understood) return;
    cancelledRef.current = false;
    setBusy(true);
    setError(null);
    setProgress('Reading…');
    try {
      const bytes = await file.arrayBuffer();
      if (cancelledRef.current) {
        setProgress(null);
        return;
      }
      setProgress('Flattening forms and annotations…');
      const result = await flattenPdf(bytes);
      if (cancelledRef.current) {
        setProgress(null);
        return;
      }
      const annotationFailed =
        Boolean(result.annotationError) && !result.annotationsFlattened;

      if (shouldRefuseFlattenDownload(result, allowPartial)) {
        setError(
          `Annotation flatten failed: ${result.annotationError}. Check “Download forms-only result” to export anyway, or fix the PDF and retry.`
        );
        setProgress(null);
        return;
      }

      const name = file.name.replace(/\.pdf$/i, '') + '-flattened.pdf';
      const blob = new Blob([result.bytes], { type: 'application/pdf' });
      downloadBlobLocally(blob, name);
      setLastPdf(new File([blob], name, { type: 'application/pdf' }));
      const parts = [
        result.formsFlattened ? 'forms' : null,
        result.annotationsFlattened ? 'annotations' : null,
      ].filter(Boolean);
      let status = parts.length
        ? `Downloaded (flattened: ${parts.join(' + ')})`
        : 'Downloaded (no form fields found)';
      if (annotationFailed) {
        status += ` — annotations NOT flattened (${result.annotationError})`;
      }
      setProgress(status);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setProgress(null);
      setLastPdf(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <ToolWorkbench
      title="Flatten PDF"
      description="Merge form fields and annotations into page content so they can no longer be edited."
      files={files}
      onFilesChange={(next) => {
        setFiles(next);
        setUnderstood(false);
        setAllowPartial(false);
        setError(null);
        setProgress(null);
        setLastPdf(null);
      }}
      busy={busy}
      footer={
        <Button
          variant="primary"
          disabled={!file || busy || !understood}
          loading={busy}
          onClick={() => void run()}
        >
          Flatten & download
        </Button>
      }
    >
      <div
        className="flex gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-accent-soft)]/40 p-4"
        role="note"
      >
        <AlertTriangle
          className="mt-0.5 h-5 w-5 shrink-0 text-[var(--color-accent)]"
          aria-hidden
        />
        <p className="text-sm text-[var(--color-muted)]">{FLATTEN_WARNING}</p>
      </div>

      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          className="mt-1"
          checked={understood}
          onChange={(e) => setUnderstood(e.target.checked)}
          disabled={busy || !file}
        />
        <span>I understand flattening is permanent and irreversible.</span>
      </label>

      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          className="mt-1"
          checked={allowPartial}
          onChange={(e) => setAllowPartial(e.target.checked)}
          disabled={busy || !file}
        />
        <span>
          Download forms-only result if annotation flatten fails (annotations may
          remain editable)
        </span>
      </label>

      {sizeHint ? (
        <p className="text-sm text-[var(--color-muted)]" role="note">
          {sizeHint}
        </p>
      ) : null}
      {busy && progress ? (
        <ToolProgress
          stage={progress}
          elapsedLabel={elapsedLabel}
          onCancel={() => {
            cancelledRef.current = true;
            setProgress('Cancelling after current step…');
          }}
        />
      ) : progress && !busy ? (
        <p className="text-sm text-[var(--color-muted)]">{progress}</p>
      ) : null}
      {error ? (
        <ToolError message={error} fileName={file?.name} onRetry={() => { setError(null); void run(); }} />
      ) : null}

      {lastPdf ? <DriveExportButton file={lastPdf} disabled={busy} /> : null}
    </ToolWorkbench>
  );
}
