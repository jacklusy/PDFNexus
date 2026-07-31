'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/shared/ui/Button';
import { downloadBlobLocally } from '@/features/files/localDownload';
import { ToolWorkbench, type ToolFile } from '../ToolWorkbench';
import { ToolError } from '../ToolError';
import { ToolProgress } from '../ToolProgress';
import { useTimedProgress } from '../useTimedProgress';
import { loadReadablePdf } from '../assertPdfReadable';
import { parsePageRanges } from '../parsePageRanges';
import { zipOutputs } from '../zipOutputs';
import { runWorkerTask, WorkerCancelledError, cancelAndAwait } from '../runInWorker';
import { softLargePdfHint } from '../softLargePdfHint';
import { downloadWorkerOutputs } from '../downloadWorkerOutputs';
import { type ImageExportFormat, PDF_TO_IMAGES_MIN_SCALE } from './pdfToImages';

export function PdfToImagesTool() {
  const [files, setFiles] = useState<ToolFile[]>([]);
  const [pageCount, setPageCount] = useState(0);
  const [rangeText, setRangeText] = useState('');
  const [format, setFormat] = useState<ImageExportFormat>('image/jpeg');
  const [scale, setScale] = useState(2);
  const [quality, setQuality] = useState(85);
  const [background, setBackground] = useState('#ffffff');
  const [namePattern, setNamePattern] = useState('{name}-p{n}');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [progressCurrent, setProgressCurrent] = useState(0);
  const [progressTotal, setProgressTotal] = useState(0);
  const [sizeHint, setSizeHint] = useState<string | null>(null);
  const cancelRef = useRef<(() => void) | null>(null);
  const cancelledBeforeWorkerRef = useRef(false);
  const { elapsedLabel } = useTimedProgress(busy);

  const file = files[0]?.file;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!file) {
        setPageCount(0);
        setSizeHint(null);
        return;
      }
      setSizeHint(softLargePdfHint(file.size));
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
        if (!cancelled) {
          setPageCount(0);
          setError(e instanceof Error ? e.message : 'Could not read PDF');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [file]);

  const run = async () => {
    if (!file || !pageCount) return;
    cancelledBeforeWorkerRef.current = false;
    setBusy(true);
    setError(null);
    setProgress('Reading…');
    setProgressCurrent(0);
    setProgressTotal(0);
    try {
      const pages = parsePageRanges(rangeText || `1-${pageCount}`, {
        pageCount,
        rejectOverlaps: true,
      });
      const bytes = await file.arrayBuffer();
      // Cancel during arrayBuffer is checked after the read (parity Split/Extract).
      if (cancelledBeforeWorkerRef.current) {
        throw new WorkerCancelledError();
      }
      const baseName = file.name.replace(/\.pdf$/i, '') || 'page';
      const request = {
        id: 'pdf-to-images',
        bytes,
        pages,
        format,
        scale,
        quality: quality / 100,
        background,
        namePattern,
        baseName,
      };
      let cancelWorker: (() => void) | null = null;
      cancelRef.current = () => {
        cancelledBeforeWorkerRef.current = true;
        cancelWorker?.();
      };
      if (cancelledBeforeWorkerRef.current) {
        throw new WorkerCancelledError();
      }
      const { promise, cancel } = runWorkerTask<
        typeof request,
        {
          files: Array<{ fileName: string; bytes: ArrayBuffer; mimeType: ImageExportFormat }>;
        }
      >({
        workerUrl: new URL('./pdf-to-images.worker.ts', import.meta.url),
        request,
        transfer: [bytes],
        onProgress: (c, t) => {
          setProgressCurrent(c);
          setProgressTotal(t);
          setProgress(`Rendering ${c}/${t}…`);
        },
      });
      cancelWorker = cancel;
      if (cancelledBeforeWorkerRef.current) {
        await cancelAndAwait(cancel, promise);
      }
      const result = await promise;
      if (cancelledBeforeWorkerRef.current) {
        throw new WorkerCancelledError();
      }
      const named = result.files.map((f) => ({
        fileName: f.fileName,
        blob: new Blob([f.bytes], { type: f.mimeType }),
      }));
      const outcome = await downloadWorkerOutputs({
        isCancelled: () => cancelledBeforeWorkerRef.current,
        files: named,
        zipName: `${baseName}-images.zip`,
        download: downloadBlobLocally,
        zipOutputs,
        onBuildingZip: () => setProgress('Building ZIP…'),
      });
      if (outcome === 'cancelled') {
        throw new WorkerCancelledError();
      }
      setProgress(`Done — ${named.length} image(s)`);
      setProgressCurrent(0);
      setProgressTotal(0);
    } catch (e) {
      if (e instanceof WorkerCancelledError) {
        setProgress(null);
        setError(null);
      } else {
        setError(e instanceof Error ? e.message : String(e));
        setProgress(null);
      }
      setProgressCurrent(0);
      setProgressTotal(0);
    } finally {
      cancelRef.current = null;
      setBusy(false);
    }
  };

  return (
    <ToolWorkbench
      title="PDF to images"
      description="Export pages as JPG, PNG, or WebP. Multi-page results download as a ZIP. Rendering runs in a background worker."
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
          disabled={!file || busy || pageCount === 0}
          loading={busy}
          onClick={() => void run()}
        >
          Export & download
        </Button>
      }
    >
      {sizeHint ? (
        <p className="text-sm text-[var(--color-muted)]" role="note">
          {sizeHint}
        </p>
      ) : null}
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
          <fieldset className="flex flex-wrap gap-2">
            <legend className="text-sm font-semibold">Format</legend>
            {(
              [
                ['image/jpeg', 'JPG'],
                ['image/png', 'PNG'],
                ['image/webp', 'WebP'],
              ] as const
            ).map(([value, label]) => (
              <label
                key={value}
                className="inline-flex items-center gap-2 rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-sm"
              >
                <input
                  type="radio"
                  name="img-format"
                  checked={format === value}
                  onChange={() => setFormat(value)}
                  disabled={busy}
                />
                {label}
              </label>
            ))}
          </fieldset>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="text-sm">
              Scale
              <input
                type="number"
                min={PDF_TO_IMAGES_MIN_SCALE}
                max={4}
                step={0.5}
                className="mt-1 w-full rounded-lg border px-3 py-2"
                value={scale}
                onChange={(e) => setScale(Number(e.target.value) || 2)}
                disabled={busy}
              />
            </label>
            <label className="text-sm">
              Quality %
              <input
                type="number"
                min={40}
                max={100}
                className="mt-1 w-full rounded-lg border px-3 py-2"
                value={quality}
                onChange={(e) => setQuality(Number(e.target.value) || 85)}
                disabled={busy || format === 'image/png'}
              />
            </label>
            <label className="text-sm">
              Background
              <input
                type="color"
                className="mt-1 h-10 w-full rounded-lg border px-1"
                value={background}
                onChange={(e) => setBackground(e.target.value)}
                disabled={busy}
              />
            </label>
          </div>
          <label className="block text-sm">
            Name pattern ({'{n}'} = page, {'{name}'} = file stem)
            <input
              className="mt-1 w-full rounded-lg border border-[var(--color-border)] px-3 py-2"
              value={namePattern}
              onChange={(e) => setNamePattern(e.target.value)}
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
            cancelledBeforeWorkerRef.current = true;
            cancelRef.current?.();
          }}
        />
      ) : progress && !busy ? (
        <p className="text-sm text-[var(--color-muted)]">{progress}</p>
      ) : null}
      {error ? (
        <ToolError message={error} fileName={file?.name} onRetry={() => { setError(null); void run(); }} />
      ) : null}
    </ToolWorkbench>
  );
}
