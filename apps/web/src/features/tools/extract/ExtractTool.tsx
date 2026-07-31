'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '@/shared/ui/Button';
import { downloadBlobLocally } from '@/features/files/localDownload';
import { ToolWorkbench, type ToolFile } from '../ToolWorkbench';
import { loadReadablePdf } from '../assertPdfReadable';
import { parsePageRanges, PageRangeError } from '../parsePageRanges';
import { ToolError } from '../ToolError';
import { ToolProgress } from '../ToolProgress';
import { useTimedProgress } from '../useTimedProgress';
import { softLargePdfHint } from '../softLargePdfHint';
import { runWorkerTask, WorkerCancelledError, cancelAndAwait } from '../runInWorker';

export function ExtractTool() {
  const [files, setFiles] = useState<ToolFile[]>([]);
  const [pageCount, setPageCount] = useState(0);
  const [selected, setSelected] = useState<number[]>([]);
  const [rangeText, setRangeText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [progressCurrent, setProgressCurrent] = useState(0);
  const [progressTotal, setProgressTotal] = useState(0);
  const [sizeHint, setSizeHint] = useState<string | null>(null);
  const cancelRef = React.useRef<(() => void) | null>(null);
  const cancelledBeforeWorkerRef = React.useRef(false);
  const { elapsedLabel } = useTimedProgress(busy);

  const file = files[0]?.file;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!file) {
        setPageCount(0);
        setSelected([]);
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
          setSelected([]);
          setRangeText('');
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

  const selectedSet = useMemo(() => new Set(selected), [selected]);

  const toggle = (page: number) => {
    setSelected((prev) =>
      prev.includes(page) ? prev.filter((p) => p !== page) : [...prev, page]
    );
  };

  const applyRange = () => {
    try {
      const pages = parsePageRanges(rangeText, { pageCount, rejectOverlaps: false });
      setSelected(pages);
      setError(null);
    } catch (e) {
      setError(e instanceof PageRangeError || e instanceof Error ? e.message : String(e));
    }
  };

  const move = (index: number, dir: -1 | 1) => {
    setSelected((prev) => {
      const next = [...prev];
      const j = index + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[index], next[j]] = [next[j], next[index]];
      return next;
    });
  };

  const run = async () => {
    if (!file || selected.length === 0) return;
    cancelledBeforeWorkerRef.current = false;
    setBusy(true);
    setError(null);
    setProgress('Reading…');
    setProgressCurrent(0);
    setProgressTotal(0);
    try {
      const bytes = await file.arrayBuffer();
      if (cancelledBeforeWorkerRef.current) {
        throw new WorkerCancelledError();
      }
      const request = { bytes, pages: selected };
      let cancelWorker: (() => void) | null = null;
      cancelRef.current = () => {
        cancelledBeforeWorkerRef.current = true;
        cancelWorker?.();
      };
      if (cancelledBeforeWorkerRef.current) {
        throw new WorkerCancelledError();
      }
      const { promise, cancel } = runWorkerTask<
        { id: string; request: typeof request },
        { bytes: ArrayBuffer; pageCount: number }
      >({
        workerUrl: new URL('../split/extract.worker.ts', import.meta.url),
        request: { id: 'extract', request },
        transfer: [bytes],
        onProgress: (c, t) => {
          setProgressCurrent(c);
          setProgressTotal(t);
          setProgress(`Extracting ${c}/${t}…`);
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
      const outName = file.name.replace(/\.pdf$/i, '') + '-extract.pdf';
      downloadBlobLocally(
        new Blob([result.bytes], { type: 'application/pdf' }),
        outName
      );
      setProgress(`Done — ${result.pageCount} page${result.pageCount === 1 ? '' : 's'}`);
      setProgressCurrent(0);
      setProgressTotal(0);
    } catch (e) {
      if (e instanceof WorkerCancelledError) {
        setProgress(null);
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
      title="Extract pages"
      description="Pick pages and export a new PDF. Export order follows the selection list (reorder with ↑/↓)."
      files={files}
      onFilesChange={setFiles}
      busy={busy}
      footer={
        <Button
          variant="primary"
          disabled={!file || busy || selected.length === 0}
          loading={busy}
          onClick={() => void run()}
        >
          Extract & download
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
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="secondary"
              disabled={busy}
              onClick={() =>
                setSelected(Array.from({ length: pageCount }, (_, i) => i + 1))
              }
            >
              Select all
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={busy}
              onClick={() => setSelected([])}
            >
              Clear
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={busy}
              onClick={() => {
                const all = Array.from({ length: pageCount }, (_, i) => i + 1);
                setSelected(all.filter((p) => !selectedSet.has(p)));
              }}
            >
              Invert
            </Button>
          </div>

          <div className="flex flex-wrap items-end gap-2">
            <label className="min-w-[200px] flex-1 text-sm">
              <span className="font-medium text-[var(--color-ink)]">Range</span>
              <input
                className="mt-1 w-full rounded-lg border border-[var(--color-border)] px-3 py-2"
                value={rangeText}
                onChange={(e) => setRangeText(e.target.value)}
                placeholder="1, 3, 5-8, 12"
                disabled={busy}
              />
            </label>
            <Button size="sm" variant="outline" disabled={busy} onClick={applyRange}>
              Apply range
            </Button>
          </div>

          <div>
            <p className="text-sm font-medium text-[var(--color-ink)]">
              Selected: {selected.length} / {pageCount}
            </p>
            <div
              className="mt-2 grid max-h-56 grid-cols-4 gap-2 overflow-auto sm:grid-cols-6 md:grid-cols-8"
              role="listbox"
              aria-multiselectable
              aria-label="Pages"
            >
              {Array.from({ length: pageCount }, (_, i) => {
                const page = i + 1;
                const on = selectedSet.has(page);
                return (
                  <button
                    key={page}
                    type="button"
                    role="option"
                    aria-selected={on}
                    disabled={busy}
                    onClick={() => toggle(page)}
                    className={`rounded-lg border px-2 py-3 text-sm font-semibold ${
                      on
                        ? 'border-[var(--color-accent)] bg-[var(--color-accent-soft)] text-[var(--color-accent)]'
                        : 'border-[var(--color-border)] text-[var(--color-muted)]'
                    }`}
                  >
                    {page}
                  </button>
                );
              })}
            </div>
          </div>

          {selected.length > 0 ? (
            <div>
              <p className="text-sm font-medium text-[var(--color-ink)]">Export order</p>
              <ol className="mt-2 max-h-40 space-y-1 overflow-auto text-sm">
                {selected.map((p, i) => (
                  <li
                    key={`${p}-${i}`}
                    className="flex items-center justify-between gap-2 rounded border border-[var(--color-border)] px-2 py-1"
                  >
                    <span>
                      {i + 1}. Page {p}
                    </span>
                    <span className="flex gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={busy || i === 0}
                        onClick={() => move(i, -1)}
                        aria-label="Move up"
                      >
                        ↑
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={busy || i === selected.length - 1}
                        onClick={() => move(i, 1)}
                        aria-label="Move down"
                      >
                        ↓
                      </Button>
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          ) : null}
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
