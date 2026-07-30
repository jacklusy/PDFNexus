'use client';

import React, { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/shared/ui/Button';
import { downloadBlobLocally } from '@/features/files/localDownload';
import { ToolWorkbench } from '../ToolWorkbench';
import { useToolHandoff } from '../useToolHandoff';
import { FLATTEN_WARNING, flattenPdf, shouldRefuseFlattenDownload } from './flattenPdf';

export function FlattenTool() {
  const { files, setFiles } = useToolHandoff();
  const [understood, setUnderstood] = useState(false);
  const [allowPartial, setAllowPartial] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);

  const file = files[0]?.file;

  const run = async () => {
    if (!file || !understood) return;
    setBusy(true);
    setError(null);
    setProgress('Flattening forms and annotations…');
    try {
      const bytes = await file.arrayBuffer();
      const result = await flattenPdf(bytes);
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
      downloadBlobLocally(
        new Blob([result.bytes], { type: 'application/pdf' }),
        name
      );
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

      {progress ? <p className="text-sm text-[var(--color-muted)]">{progress}</p> : null}
      {error ? (
        <p className="text-sm text-[var(--color-danger)]" role="alert">
          {error}
        </p>
      ) : null}
    </ToolWorkbench>
  );
}
