'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '@/shared/ui/Button';
import { downloadBlobLocally } from '@/features/files/localDownload';
import { ToolWorkbench, type ToolFile } from '../ToolWorkbench';
import { ToolError } from '../ToolError';
import { loadReadablePdf } from '../assertPdfReadable';
import { zipOutputs } from '../zipOutputs';
import { planSplitRanges, type SplitMode } from './splitPdf';
import { runWorkerTask, WorkerCancelledError } from '../runInWorker';

function baseName(name: string) {
  return name.replace(/\.pdf$/i, '') || 'split';
}

export function SplitTool() {
  const [files, setFiles] = useState<ToolFile[]>([]);
  const [pageCount, setPageCount] = useState(0);
  const [mode, setMode] = useState<SplitMode>('ranges');
  const [rangeText, setRangeText] = useState('1-1');
  const [everyN, setEveryN] = useState(2);
  const [splitBeforeText, setSplitBeforeText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [names, setNames] = useState<Record<number, string>>({});
  const cancelRef = React.useRef<(() => void) | null>(null);

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
          setPageCount(doc.getPageCount());
          setRangeText(`1-${doc.getPageCount()}`);
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

  const planned = useMemo(() => {
    if (!pageCount) return [];
    try {
      const splitBefore = splitBeforeText
        .split(',')
        .map((s) => Number(s.trim()))
        .filter((n) => Number.isInteger(n) && n > 1);
      return planSplitRanges(pageCount, {
        mode,
        rangeText,
        everyN,
        splitBefore,
        baseName: file ? baseName(file.name) : 'split',
      }).map((r, i) => ({
        ...r,
        fileName: names[i] || r.fileName || `part-${i + 1}.pdf`,
      }));
    } catch {
      return [];
    }
  }, [pageCount, mode, rangeText, everyN, splitBeforeText, file, names]);

  const run = async () => {
    if (!file || !pageCount) return;
    setBusy(true);
    setError(null);
    setProgress('Preparing…');
    try {
      const bytes = await file.arrayBuffer();
      const request = {
        bytes,
        mode,
        rangeText,
        everyN,
        splitBefore: splitBeforeText
          .split(',')
          .map((s) => Number(s.trim()))
          .filter((n) => Number.isInteger(n) && n > 1),
        baseName: baseName(file.name),
      };
      // Validate plan first on main thread
      const plan = planSplitRanges(pageCount, request).map((r, i) => ({
        ...r,
        fileName: names[i] || r.fileName,
      }));

      const { promise, cancel } = runWorkerTask<
        { id: string; request: typeof request },
        { parts: Array<{ bytes: ArrayBuffer; fileName: string }> }
      >({
        workerUrl: new URL('./split.worker.ts', import.meta.url),
        request: { id: 'split', request },
        transfer: [bytes],
        onProgress: (c, t) => setProgress(`Splitting ${c}/${t}…`),
      });
      cancelRef.current = cancel;
      const result = await promise;
      const named = result.parts.map((p, i) => ({
        fileName: plan[i]?.fileName || p.fileName || `part-${i + 1}.pdf`,
        blob: new Blob([p.bytes], { type: 'application/pdf' }),
      }));

      if (named.length === 1) {
        downloadBlobLocally(named[0].blob, named[0].fileName);
      } else {
        setProgress('Building ZIP…');
        const zip = await zipOutputs(named);
        downloadBlobLocally(zip, `${baseName(file.name)}-split.zip`);
      }
      setProgress(`Done — ${named.length} file${named.length === 1 ? '' : 's'}`);
    } catch (e) {
      if (e instanceof WorkerCancelledError) {
        setProgress(null);
      } else {
        setError(e instanceof Error ? e.message : String(e));
        setProgress(null);
      }
    } finally {
      cancelRef.current = null;
      setBusy(false);
    }
  };

  return (
    <ToolWorkbench
      title="Split PDF"
      description="Divide one PDF into multiple files. Download is immediate and local."
      files={files}
      onFilesChange={setFiles}
      busy={busy}
      footer={
        <>
          <Button
            variant="primary"
            disabled={!file || busy || planned.length === 0}
            loading={busy}
            onClick={() => void run()}
          >
            Split & download
          </Button>
          {busy ? (
            <Button
              variant="outline"
              onClick={() => {
                cancelRef.current?.();
                setBusy(false);
                setProgress(null);
              }}
            >
              Cancel
            </Button>
          ) : null}
        </>
      }
    >
      {pageCount > 0 ? (
        <>
          <fieldset className="space-y-2">
            <legend className="text-sm font-semibold text-[var(--color-ink)]">Split mode</legend>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ['ranges', 'Custom ranges'],
                  ['every', 'Every N pages'],
                  ['individual', 'Each page'],
                  ['at', 'At positions'],
                ] as const
              ).map(([value, label]) => (
                <label
                  key={value}
                  className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-sm"
                >
                  <input
                    type="radio"
                    name="split-mode"
                    checked={mode === value}
                    onChange={() => setMode(value)}
                    disabled={busy}
                  />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>

          {mode === 'ranges' ? (
            <label className="block text-sm">
              <span className="font-medium text-[var(--color-ink)]">
                Ranges (use ; between output files)
              </span>
              <input
                className="mt-1 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2"
                value={rangeText}
                onChange={(e) => setRangeText(e.target.value)}
                placeholder="1-5; 6-10; 11-15"
                disabled={busy}
              />
              <span className="mt-1 block text-xs text-[var(--color-muted)]">
                Use <code>;</code> between output files. Commas alone merge pages into one
                contiguous range (e.g. <code>1,3,5</code> → pages 1–5 in a single file).
              </span>
            </label>
          ) : null}

          {mode === 'every' ? (
            <label className="block text-sm">
              <span className="font-medium text-[var(--color-ink)]">Pages per file</span>
              <input
                type="number"
                min={1}
                max={pageCount}
                className="mt-1 w-32 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2"
                value={everyN}
                onChange={(e) => setEveryN(Math.max(1, Number(e.target.value) || 1))}
                disabled={busy}
              />
            </label>
          ) : null}

          {mode === 'at' ? (
            <label className="block text-sm">
              <span className="font-medium text-[var(--color-ink)]">
                Split before pages (comma-separated, excluding 1)
              </span>
              <input
                className="mt-1 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2"
                value={splitBeforeText}
                onChange={(e) => setSplitBeforeText(e.target.value)}
                placeholder="4, 8, 12"
                disabled={busy}
              />
            </label>
          ) : null}

          <div>
            <p className="text-sm font-medium text-[var(--color-ink)]">
              Output: {planned.length} file{planned.length === 1 ? '' : 's'}
              {pageCount ? ` · ${pageCount} pages source` : ''}
            </p>
            {planned.length > 0 ? (
              <ul className="mt-2 max-h-48 space-y-1 overflow-auto text-sm">
                {planned.map((p, i) => (
                  <li key={`${p.start}-${p.end}-${i}`} className="flex items-center gap-2">
                    <span className="w-24 shrink-0 text-[var(--color-muted)]">
                      {p.start === p.end ? `p${p.start}` : `${p.start}–${p.end}`}
                    </span>
                    <input
                      className="min-w-0 flex-1 rounded border border-[var(--color-border)] px-2 py-1"
                      value={names[i] ?? p.fileName ?? ''}
                      onChange={(e) =>
                        setNames((prev) => ({ ...prev, [i]: e.target.value }))
                      }
                      disabled={busy}
                      aria-label={`Rename output ${i + 1}`}
                    />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-1 text-xs text-[var(--color-danger)]">
                Adjust ranges to preview output files.
              </p>
            )}
          </div>
        </>
      ) : null}

      {progress ? <p className="text-sm text-[var(--color-muted)]">{progress}</p> : null}
      {error ? (
        <ToolError message={error} fileName={file?.name} onRetry={() => setError(null)} />
      ) : null}
    </ToolWorkbench>
  );
}
