'use client';

import React, { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/shared/ui/Button';
import { downloadBlobLocally } from '@/features/files/localDownload';
import { ToolWorkbench, type ToolFile } from '../ToolWorkbench';
import { FLATTEN_WARNING, flattenPdf } from './flattenPdf';

export function FlattenTool() {
  const [files, setFiles] = useState<ToolFile[]>([]);
  const [understood, setUnderstood] = useState(false);
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
      const name = file.name.replace(/\.pdf$/i, '') + '-flattened.pdf';
      downloadBlobLocally(
        new Blob([result.bytes], { type: 'application/pdf' }),
        name
      );
      const parts = [
        result.formsFlattened ? 'forms' : null,
        result.annotationsFlattened ? 'annotations' : null,
      ].filter(Boolean);
      setProgress(
        parts.length
          ? `Downloaded (flattened: ${parts.join(' + ')})`
          : 'Downloaded (no forms found; annotation pass attempted)'
      );
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
        role="alert"
      >
        <AlertTriangle
          className="mt-0.5 h-5 w-5 shrink-0 text-[var(--color-accent)]"
          aria-hidden
        />
        <div className="space-y-2 text-sm">
          <p className="font-semibold text-[var(--color-ink)]">
            Permanently non-editable
          </p>
          <p className="text-[var(--color-muted)]">{FLATTEN_WARNING}</p>
        </div>
      </div>

      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          className="mt-1"
          checked={understood}
          onChange={(e) => setUnderstood(e.target.checked)}
          disabled={busy || !file}
        />
        <span>
          I understand that flattening makes form fields and annotations permanently
          non-editable.
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
