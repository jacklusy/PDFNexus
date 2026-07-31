'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/shared/ui/Button';
import { downloadBlobLocally } from '@/features/files/localDownload';
import { formatTransferBytes } from '@/features/transfer/transferFormat';
import { loadReadablePdf } from '../assertPdfReadable';
import { ToolWorkbench, type ToolFile } from '../ToolWorkbench';
import { ToolError } from '../ToolError';
import { ToolProgress } from '../ToolProgress';
import { useTimedProgress } from '../useTimedProgress';
import { softLargePdfHint } from '../softLargePdfHint';
import {
  settingsForPreset,
  type CompressPreset,
  type CompressResult,
} from './compressPdf';
import { runWorkerTask, WorkerCancelledError, cancelAndAwait } from '../runInWorker';
import { downloadWorkerOutputs } from '../downloadWorkerOutputs';
import { zipOutputs } from '../zipOutputs';

export function CompressTool() {
  const [files, setFiles] = useState<ToolFile[]>([]);
  const [pageCount, setPageCount] = useState(0);
  const [preset, setPreset] = useState<CompressPreset>('balanced');
  const [maxImagePx, setMaxImagePx] = useState(1600);
  const [jpegQuality, setJpegQuality] = useState(72);
  const [rasterize, setRasterize] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [progressCurrent, setProgressCurrent] = useState(0);
  const [progressTotal, setProgressTotal] = useState(0);
  const [stats, setStats] = useState<CompressResult | null>(null);
  const cancelledRef = useRef(false);
  const cancelWorkerRef = useRef<(() => void) | null>(null);
  const { elapsedLabel } = useTimedProgress(busy);

  const file = files[0]?.file;
  const sizeHint = file ? softLargePdfHint(file.size) : null;
  const settings = useMemo(
    () =>
      settingsForPreset(preset, {
        maxImagePx,
        jpegQuality: jpegQuality / 100,
        stripMetadata: true,
      }),
    [preset, maxImagePx, jpegQuality]
  );

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
          setPageCount(doc.getPageCount());
          setError(null);
          setStats(null);
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
    if (!file) return;
    cancelledRef.current = false;
    setBusy(true);
    setError(null);
    setStats(null);
    setProgress('Reading…');
    setProgressCurrent(0);
    setProgressTotal(0);
    try {
      const bytes = await file.arrayBuffer();
      if (cancelledRef.current) throw new WorkerCancelledError();

      // Structural + JPEG raster both run in module workers.
      const workerUrl = rasterize
        ? new URL('./compress-raster.worker.ts', import.meta.url)
        : new URL('./compress.worker.ts', import.meta.url);

      let cancelWorker: (() => void) | null = null;
      cancelWorkerRef.current = () => {
        cancelledRef.current = true;
        cancelWorker?.();
      };
      if (cancelledRef.current) throw new WorkerCancelledError();

      setProgress(rasterize ? 'Re-encoding pages…' : 'Compressing…');
      const { promise, cancel } = runWorkerTask<
        { id: string; bytes: ArrayBuffer; settings: typeof settings },
        {
          bytes: ArrayBuffer;
          originalSize: number;
          finalSize: number;
          reductionPercent: number;
          elapsedMs: number;
          settings: typeof settings;
          imagesReencoded: number;
        }
      >({
        workerUrl,
        request: { id: 'compress', bytes, settings },
        transfer: [bytes],
        onProgress: (c, t, msg) => {
          setProgressCurrent(c);
          setProgressTotal(t);
          setProgress(msg || `${c}/${t}`);
        },
      });
      cancelWorker = cancel;
      if (cancelledRef.current) {
        await cancelAndAwait(cancel, promise);
      }
      const workerResult = await promise;
      const result: CompressResult = {
        bytes: new Uint8Array(workerResult.bytes),
        originalSize: workerResult.originalSize,
        finalSize: workerResult.finalSize,
        reductionPercent: workerResult.reductionPercent,
        elapsedMs: workerResult.elapsedMs,
        settings: workerResult.settings,
        imagesReencoded: workerResult.imagesReencoded,
      };
      const name = file.name.replace(/\.pdf$/i, '') + '-compressed.pdf';
      const outcome = await downloadWorkerOutputs({
        isCancelled: () => cancelledRef.current,
        files: [
          {
            fileName: name,
            blob: new Blob([result.bytes], { type: 'application/pdf' }),
          },
        ],
        zipName: name.replace(/\.pdf$/i, '') + '.zip',
        download: downloadBlobLocally,
        zipOutputs,
      });
      if (outcome === 'cancelled') {
        throw new WorkerCancelledError();
      }
      setStats(result);
      setProgress('Downloaded');
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
      cancelWorkerRef.current = null;
      setBusy(false);
    }
  };

  return (
    <ToolWorkbench
      title="Compress PDF"
      description="Reduce file size locally. Sizes shown are measured after processing — not estimates. JPEG re-encode runs in a background worker."
      files={files}
      onFilesChange={setFiles}
      busy={busy}
      footer={
        <Button
          variant="primary"
          disabled={!file || busy}
          loading={busy}
          onClick={() => void run()}
        >
          Compress & download
        </Button>
      }
    >
      {sizeHint ? (
        <p className="text-sm text-[var(--color-muted)]" role="note">
          {sizeHint}
        </p>
      ) : null}
      {pageCount > 0 ? (
        <p className="text-sm text-[var(--color-muted)]">{pageCount} page(s)</p>
      ) : null}

      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold">Preset</legend>
        <div className="flex flex-wrap gap-2">
          {(['low', 'balanced', 'high', 'custom'] as const).map((p) => (
            <label
              key={p}
              className="inline-flex items-center gap-2 rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-sm capitalize"
            >
              <input
                type="radio"
                name="compress-preset"
                checked={preset === p}
                onChange={() => setPreset(p)}
                disabled={busy}
              />
              {p}
            </label>
          ))}
        </div>
      </fieldset>

      {preset === 'custom' ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">
            <span className="font-medium">Max image edge (px)</span>
            <input
              type="number"
              min={400}
              max={4000}
              className="mt-1 w-full rounded-lg border px-3 py-2"
              value={maxImagePx}
              onChange={(e) => setMaxImagePx(Number(e.target.value) || 1600)}
              disabled={busy}
            />
          </label>
          <label className="text-sm">
            <span className="font-medium">JPEG quality (%)</span>
            <input
              type="number"
              min={40}
              max={95}
              className="mt-1 w-full rounded-lg border px-3 py-2"
              value={jpegQuality}
              onChange={(e) => setJpegQuality(Number(e.target.value) || 72)}
              disabled={busy}
            />
          </label>
        </div>
      ) : (
        <p className="text-xs text-[var(--color-muted)]">
          Target ~{settings.maxImagePx}px / {Math.round(settings.jpegQuality * 100)}% JPEG
        </p>
      )}

      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          className="mt-1"
          checked={rasterize}
          onChange={(e) => setRasterize(e.target.checked)}
          disabled={busy}
        />
        <span>
          Re-encode pages as JPEG (stronger compression; quality loss). When off, only
          structural compression runs.
        </span>
      </label>

      {stats ? (
        <dl className="grid grid-cols-2 gap-2 rounded-xl bg-[var(--color-surface-2)] p-3 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-[var(--color-muted)]">Original</dt>
            <dd className="font-semibold">{formatTransferBytes(stats.originalSize)}</dd>
          </div>
          <div>
            <dt className="text-[var(--color-muted)]">Final</dt>
            <dd className="font-semibold">{formatTransferBytes(stats.finalSize)}</dd>
          </div>
          <div>
            <dt className="text-[var(--color-muted)]">Reduction</dt>
            <dd className="font-semibold">{stats.reductionPercent}%</dd>
          </div>
          <div>
            <dt className="text-[var(--color-muted)]">Time</dt>
            <dd className="font-semibold">{(stats.elapsedMs / 1000).toFixed(1)}s</dd>
          </div>
        </dl>
      ) : null}

      {busy && progress ? (
        <ToolProgress
          stage={progress}
          percent={
            progressTotal > 0
              ? Math.round((progressCurrent / progressTotal) * 100)
              : null
          }
          currentPage={progressTotal > 0 ? Math.max(1, progressCurrent) : undefined}
          totalPages={progressTotal > 0 ? progressTotal : undefined}
          elapsedLabel={elapsedLabel}
          onCancel={() => {
            cancelledRef.current = true;
            cancelWorkerRef.current?.();
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
