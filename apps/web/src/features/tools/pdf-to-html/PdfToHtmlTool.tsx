'use client';

import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/shared/ui/Button';
import { downloadBlobLocally } from '@/features/files/localDownload';
import { ToolWorkbench } from '../ToolWorkbench';
import { ToolError } from '../ToolError';
import { ToolProgress } from '../ToolProgress';
import { useTimedProgress } from '../useTimedProgress';
import { useToolHandoff } from '../useToolHandoff';
import { softLargePdfHint } from '../softLargePdfHint';
import { loadReadablePdf } from '../assertPdfReadable';
import { pdfToHtml } from './pdfToHtml';

export function PdfToHtmlTool() {
  const { files, setFiles } = useToolHandoff();
  const [html, setHtml] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [progressCurrent, setProgressCurrent] = useState(0);
  const [progressTotal, setProgressTotal] = useState(0);
  const cancelledRef = useRef(false);
  const { elapsedLabel } = useTimedProgress(busy);

  const file = files[0]?.file;
  const sizeHint = file ? softLargePdfHint(file.size) : null;

  useEffect(() => {
    setHtml(null);
    setError(null);
    setProgress(null);
  }, [file]);

  const convert = async () => {
    if (!file) return;
    cancelledRef.current = false;
    setBusy(true);
    setError(null);
    setProgress('Reading…');
    setProgressCurrent(0);
    setProgressTotal(0);
    try {
      const bytes = await file.arrayBuffer();
      if (cancelledRef.current) {
        setProgress(null);
        return;
      }
      await loadReadablePdf(bytes);
      if (cancelledRef.current) {
        setProgress(null);
        return;
      }
      const title = file.name.replace(/\.pdf$/i, '') || 'PDF export';
      setProgress('Extracting text…');
      const result = await pdfToHtml({
        bytes,
        title,
        onProgress: (c, t) => {
          if (cancelledRef.current) throw new Error('Cancelled');
          setProgressCurrent(c);
          setProgressTotal(t);
          setProgress(`Page ${Math.min(c + 1, t)} / ${t}`);
        },
      });
      if (cancelledRef.current) {
        setProgress(null);
        return;
      }
      setHtml(result.html);
      setProgress(`Ready — ${result.pageCount} page(s)`);
      setProgressCurrent(0);
      setProgressTotal(0);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg === 'Cancelled') {
        setProgress(null);
        setError(null);
      } else {
        setError(msg);
        setHtml(null);
        setProgress(null);
      }
      setProgressCurrent(0);
      setProgressTotal(0);
    } finally {
      setBusy(false);
    }
  };

  const download = () => {
    if (!html || !file) return;
    const name = file.name.replace(/\.pdf$/i, '') + '.html';
    downloadBlobLocally(new Blob([html], { type: 'text/html;charset=utf-8' }), name);
    setProgress('Downloaded .html');
  };

  return (
    <ToolWorkbench
      title="PDF to HTML"
      description="Export reading-order text as a simple HTML article. Preview before download."
      files={files}
      onFilesChange={(next) => {
        setFiles(next);
        setError(null);
        setProgress(null);
      }}
      busy={busy}
      processingMode="local"
      footer={
        <>
          <Button
            variant="primary"
            disabled={!file || busy}
            loading={busy}
            onClick={() => void convert()}
          >
            Convert
          </Button>
          <Button
            variant="outline"
            disabled={!html || busy}
            onClick={download}
          >
            Download .html
          </Button>
        </>
      }
    >
      {sizeHint ? (
        <p className="text-sm text-[var(--color-muted)]" role="note">
          {sizeHint}
        </p>
      ) : null}
      <div
        className="flex gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-accent-soft)]/40 p-4"
        role="note"
      >
        <AlertTriangle
          className="mt-0.5 h-5 w-5 shrink-0 text-[var(--color-accent)]"
          aria-hidden
        />
        <div className="space-y-1 text-sm">
          <p className="font-semibold text-[var(--color-ink)]">Layout warning</p>
          <p className="text-[var(--color-muted)]">
            Output follows reading order (top→bottom, left→right). Multi-column
            layouts, tables, and scanned pages may not match the original appearance.
          </p>
        </div>
      </div>

      {html ? (
        <div className="space-y-2">
          <p className="text-sm font-semibold text-[var(--color-ink)]">Preview</p>
          <iframe
            title="HTML preview"
            srcDoc={html}
            className="h-[420px] w-full rounded-xl border border-[var(--color-border)] bg-white"
            sandbox=""
          />
        </div>
      ) : null}

      {busy && progress ? (
        <ToolProgress
          stage={progress}
          percent={
            progressTotal > 0
              ? Math.round((progressCurrent / progressTotal) * 100)
              : null
          }
          currentPage={progressTotal > 0 ? Math.min(progressCurrent + 1, progressTotal) : undefined}
          totalPages={progressTotal > 0 ? progressTotal : undefined}
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
        <ToolError message={error} fileName={file?.name} onRetry={() => { setError(null); void convert(); }} />
      ) : null}
    </ToolWorkbench>
  );
}
