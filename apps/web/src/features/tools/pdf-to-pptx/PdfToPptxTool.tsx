'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/shared/ui/Button';
import { downloadBlobLocally } from '@/features/files/localDownload';
import { ToolWorkbench } from '../ToolWorkbench';
import { ToolProgress } from '../ToolProgress';
import { useTimedProgress } from '../useTimedProgress';
import { useToolHandoff } from '../useToolHandoff';
import { loadReadablePdf } from '../assertPdfReadable';
import { parsePageRanges } from '../parsePageRanges';
import { pdfToPptx } from './pdfToPptx';

export function PdfToPptxTool() {
  const { files, setFiles } = useToolHandoff();
  const [pageCount, setPageCount] = useState(0);
  const [rangeText, setRangeText] = useState('');
  const [scale, setScale] = useState(2);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [progressCurrent, setProgressCurrent] = useState(0);
  const [progressTotal, setProgressTotal] = useState(0);
  const cancelledRef = useRef(false);
  const { elapsedLabel } = useTimedProgress(busy);

  const file = files[0]?.file;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!file) {
        setPageCount(0);
        return;
      }
      try {
        const buf = await file.arrayBuffer();
        const doc = await loadReadablePdf(buf);
        if (!cancelled) {
          const n = doc.getPageCount();
          setPageCount(n);
          setRangeText(`1-${n}`);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Could not read PDF');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [file]);

  const run = async () => {
    if (!file || !pageCount) return;
    cancelledRef.current = false;
    setBusy(true);
    setError(null);
    setProgress('Rendering slides…');
    setProgressCurrent(0);
    setProgressTotal(0);
    try {
      const pages = parsePageRanges(rangeText || `1-${pageCount}`, {
        pageCount,
        rejectOverlaps: true,
      });
      const bytes = await file.arrayBuffer();
      const baseName = file.name.replace(/\.pdf$/i, '') || 'presentation';
      const blob = await pdfToPptx({
        bytes,
        pages,
        scale,
        baseName,
        onProgress: (c, t) => {
          if (cancelledRef.current) throw new Error('Cancelled');
          setProgressCurrent(c);
          setProgressTotal(t);
          setProgress(`Building slide ${Math.min(c + 1, t)} / ${t}…`);
        },
      });
      if (cancelledRef.current) throw new Error('Cancelled');
      downloadBlobLocally(blob, `${baseName}.pptx`);
      setProgress(`Downloaded ${pages.length} image-based slide(s)`);
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
      title="PDF to PowerPoint"
      description="Convert each page into a full-slide PNG. Image-based, not editable text."
      files={files}
      onFilesChange={(next) => {
        setFiles(next);
        setError(null);
        setProgress(null);
      }}
      busy={busy}
      footer={
        <Button
          variant="primary"
          disabled={!file || busy}
          loading={busy}
          onClick={() => void run()}
        >
          Export .pptx
        </Button>
      }
    >
      <p className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)]/50 px-3 py-2 text-sm text-[var(--color-muted)]">
        Output is <strong className="text-[var(--color-ink)]">image-based, not editable</strong>.
        Text cannot be selected or edited in PowerPoint.
      </p>

      {pageCount > 0 ? (
        <>
          <label className="block text-sm">
            Pages
            <input
              className="mt-1 w-full rounded-lg border border-[var(--color-border)] px-3 py-2"
              value={rangeText}
              onChange={(e) => setRangeText(e.target.value)}
              disabled={busy}
            />
          </label>
          <label className="block text-sm">
            Render scale
            <input
              type="number"
              min={0.5}
              max={4}
              step={0.5}
              className="mt-1 w-full rounded-lg border border-[var(--color-border)] px-3 py-2"
              value={scale}
              onChange={(e) => setScale(Number(e.target.value) || 2)}
              disabled={busy}
            />
          </label>
        </>
      ) : null}

      {busy && progress ? (
        <ToolProgress
          stage={progress}
          percent={
            progressTotal > 0
              ? Math.round((progressCurrent / progressTotal) * 100)
              : null
          }
          currentPage={progressTotal > 0 ? progressCurrent : undefined}
          totalPages={progressTotal > 0 ? progressTotal : undefined}
          elapsedLabel={elapsedLabel}
          onCancel={() => {
            cancelledRef.current = true;
          }}
        />
      ) : progress && !busy ? (
        <p className="text-sm text-[var(--color-muted)]">{progress}</p>
      ) : null}
      {error ? (
        <p className="text-sm text-[var(--color-danger)]" role="alert">
          {error}
        </p>
      ) : null}
    </ToolWorkbench>
  );
}
