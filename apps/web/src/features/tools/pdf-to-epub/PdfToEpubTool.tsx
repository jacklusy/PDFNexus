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
import { EPUB_LAYOUT_NOTICE, pdfToEpub } from './pdfToEpub';

export function PdfToEpubTool() {
  const { files, setFiles } = useToolHandoff();
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
      const fresh = await file.arrayBuffer();
      if (cancelledRef.current) {
        setProgress(null);
        return;
      }
      const title = file.name.replace(/\.pdf$/i, '') || 'PDF export';
      setProgress('Extracting text…');
      const result = await pdfToEpub({
        bytes: fresh,
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
      downloadBlobLocally(result.epubBlob, `${title}.epub`);
      setProgress(`Downloaded EPUB (${result.pageCount} page(s) of source text).`);
      setProgressCurrent(0);
      setProgressTotal(0);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg === 'Cancelled') {
        setProgress(null);
        setError(null);
      } else {
        setError(msg);
        setProgress(null);
      }
      setProgressCurrent(0);
      setProgressTotal(0);
    } finally {
      setBusy(false);
    }
  };

  return (
    <ToolWorkbench
      title="PDF to EPUB"
      description="Package reading-order text into a reflowable EPUB. Not a print-perfect layout clone."
      files={files}
      onFilesChange={setFiles}
      busy={busy}
      processingMode="local"
      footer={
        <Button
          variant="primary"
          disabled={!file || busy}
          loading={busy}
          onClick={() => void convert()}
        >
          Convert & download EPUB
        </Button>
      }
    >
      {sizeHint ? (
        <p className="text-sm text-[var(--color-muted)]" role="note">
          {sizeHint}
        </p>
      ) : null}
      <div
        className="flex gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm"
        role="note"
      >
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" aria-hidden />
        <p>{EPUB_LAYOUT_NOTICE}</p>
      </div>
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
