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
import { zipOutputs } from '../zipOutputs';
import {
  BATES_NEXT_STORAGE_KEY,
  batesPdf,
  formatBatesNumber,
  type BatesAlign,
  type BatesPosition,
} from './batesPdf';

function readStoredNext(): number {
  try {
    const raw = localStorage.getItem(BATES_NEXT_STORAGE_KEY);
    const n = raw ? Number(raw) : NaN;
    return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 1;
  } catch {
    return 1;
  }
}

function writeStoredNext(n: number) {
  try {
    localStorage.setItem(BATES_NEXT_STORAGE_KEY, String(n));
  } catch {
    // ignore quota / private mode
  }
}

export function BatesTool() {
  const { files, setFiles } = useToolHandoff();
  const [pageCount, setPageCount] = useState(0);
  const [rangeText, setRangeText] = useState('');
  const [start, setStart] = useState(1);
  const [width, setWidth] = useState(6);
  const [prefix, setPrefix] = useState('CASE-');
  const [suffix, setSuffix] = useState('');
  const [position, setPosition] = useState<BatesPosition>('footer');
  const [align, setAlign] = useState<BatesAlign>('right');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [progressCurrent, setProgressCurrent] = useState(0);
  const [progressTotal, setProgressTotal] = useState(0);
  const [fileCurrent, setFileCurrent] = useState(0);
  const [fileTotal, setFileTotal] = useState(0);
  const cancelledRef = useRef(false);
  const { elapsedLabel } = useTimedProgress(busy);

  const firstFile = files[0]?.file;
  const preview = formatBatesNumber(start, width, prefix, suffix);

  useEffect(() => {
    setStart(readStoredNext());
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!firstFile) {
        setPageCount(0);
        return;
      }
      try {
        const buf = await firstFile.arrayBuffer();
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
  }, [firstFile]);

  const run = async () => {
    if (!files.length) return;
    cancelledRef.current = false;
    setBusy(true);
    setError(null);
    setProgress('Applying Bates numbers…');
    setProgressCurrent(0);
    setProgressTotal(0);
    setFileCurrent(0);
    setFileTotal(files.length);
    try {
      let next = start;
      const outputs: Array<{ fileName: string; blob: Blob }> = [];

      for (let i = 0; i < files.length; i++) {
        if (cancelledRef.current) throw new Error('Cancelled');
        const file = files[i].file;
        setFileCurrent(i + 1);
        setProgress(`File ${i + 1}/${files.length}: ${file.name}`);
        const buf = await file.arrayBuffer();
        const doc = await loadReadablePdf(buf);
        const n = doc.getPageCount();
        // First file uses the range field; later files stamp all pages for continuity.
        const pages =
          i === 0
            ? parsePageRanges(rangeText || `1-${n}`, {
                pageCount: n,
                rejectOverlaps: true,
              })
            : Array.from({ length: n }, (_, p) => p + 1);

        const result = await batesPdf({
          bytes: buf,
          pages,
          start: next,
          width,
          prefix,
          suffix,
          position,
          align,
          onProgress: (c, t) => {
            if (cancelledRef.current) throw new Error('Cancelled');
            setProgressCurrent(c);
            setProgressTotal(t);
            setProgress(`File ${i + 1}/${files.length}: page ${c}/${t}`);
          },
        });
        next = result.nextNumber;
        const name = file.name.replace(/\.pdf$/i, '') + '-bates.pdf';
        outputs.push({
          fileName: name,
          blob: new Blob([result.bytes], { type: 'application/pdf' }),
        });
      }

      writeStoredNext(next);
      setStart(next);

      if (outputs.length === 1) {
        downloadBlobLocally(outputs[0].blob, outputs[0].fileName);
      } else {
        const zip = await zipOutputs(outputs);
        downloadBlobLocally(zip, 'bates-numbered.zip');
      }
      setProgress(
        `Downloaded ${outputs.length} file(s). Next number saved as ${next} for continuity.`
      );
      setProgressCurrent(0);
      setProgressTotal(0);
      setFileCurrent(0);
      setFileTotal(0);
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
      setFileCurrent(0);
      setFileTotal(0);
    } finally {
      setBusy(false);
    }
  };

  return (
    <ToolWorkbench
      title="Bates numbering"
      description="Stamp sequential identifiers (prefix + zero-padded number + suffix). Multiple PDFs continue the sequence in upload order."
      files={files}
      onFilesChange={(next) => {
        setFiles(next);
        setError(null);
        setProgress(null);
      }}
      busy={busy}
      multiple
      maxFiles={25}
      footer={
        <Button
          variant="primary"
          disabled={!files.length || busy}
          loading={busy}
          onClick={() => void run()}
        >
          Apply & download{files.length > 1 ? ` (${files.length} files)` : ''}
        </Button>
      }
    >
      <p className="text-sm text-[var(--color-muted)]">
        Multi-file continuity: numbers advance across queued files in one run, and the next
        value is stored in{' '}
        <code className="rounded bg-[var(--color-surface-2)] px-1 text-xs">
          {BATES_NEXT_STORAGE_KEY}
        </code>{' '}
        for later sessions.
      </p>

      <p className="rounded-lg border border-[var(--color-border)] px-3 py-2 font-mono text-sm text-[var(--color-ink)]">
        Preview: {preview}
      </p>

      {pageCount > 0 ? (
        <>
          <label className="block text-sm">
            Pages (first file)
            <input
              className="mt-1 w-full rounded-lg border border-[var(--color-border)] px-3 py-2"
              value={rangeText}
              onChange={(e) => setRangeText(e.target.value)}
              disabled={busy}
            />
          </label>
          {files.length > 1 ? (
            <p className="text-xs text-[var(--color-muted)]">
              Additional files stamp all pages, continuing from the first file&apos;s last
              number.
            </p>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm">
              Start number
              <input
                type="number"
                min={0}
                className="mt-1 w-full rounded-lg border border-[var(--color-border)] px-3 py-2"
                value={start}
                onChange={(e) => setStart(Number(e.target.value) || 0)}
                disabled={busy}
              />
            </label>
            <label className="text-sm">
              Pad width
              <input
                type="number"
                min={1}
                max={12}
                className="mt-1 w-full rounded-lg border border-[var(--color-border)] px-3 py-2"
                value={width}
                onChange={(e) => setWidth(Number(e.target.value) || 1)}
                disabled={busy}
              />
            </label>
            <label className="text-sm">
              Prefix
              <input
                className="mt-1 w-full rounded-lg border border-[var(--color-border)] px-3 py-2"
                value={prefix}
                onChange={(e) => setPrefix(e.target.value)}
                disabled={busy}
              />
            </label>
            <label className="text-sm">
              Suffix
              <input
                className="mt-1 w-full rounded-lg border border-[var(--color-border)] px-3 py-2"
                value={suffix}
                onChange={(e) => setSuffix(e.target.value)}
                disabled={busy}
              />
            </label>
            <label className="text-sm">
              Position
              <select
                className="mt-1 w-full rounded-lg border border-[var(--color-border)] px-3 py-2"
                value={position}
                onChange={(e) => setPosition(e.target.value as BatesPosition)}
                disabled={busy}
              >
                <option value="header">Header</option>
                <option value="footer">Footer</option>
              </select>
            </label>
            <label className="text-sm">
              Align
              <select
                className="mt-1 w-full rounded-lg border border-[var(--color-border)] px-3 py-2"
                value={align}
                onChange={(e) => setAlign(e.target.value as BatesAlign)}
                disabled={busy}
              >
                <option value="left">Left</option>
                <option value="center">Center</option>
                <option value="right">Right</option>
              </select>
            </label>
          </div>
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
          currentFile={fileTotal > 0 ? fileCurrent : undefined}
          totalFiles={fileTotal > 0 ? fileTotal : undefined}
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
