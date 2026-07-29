'use client';

import React, { useEffect, useState } from 'react';
import { Button } from '@/shared/ui/Button';
import { downloadBlobLocally } from '@/features/files/localDownload';
import { ToolWorkbench, type ToolFile } from '../ToolWorkbench';
import { loadReadablePdf } from '../assertPdfReadable';
import { parsePageRanges } from '../parsePageRanges';
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
  const [files, setFiles] = useState<ToolFile[]>([]);
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

  const file = files[0]?.file;
  const preview = formatBatesNumber(start, width, prefix, suffix);

  useEffect(() => {
    setStart(readStoredNext());
  }, []);

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
    setBusy(true);
    setError(null);
    setProgress('Applying Bates numbers…');
    try {
      const pages = parsePageRanges(rangeText || `1-${pageCount}`, {
        pageCount,
        rejectOverlaps: true,
      });
      const bytes = await file.arrayBuffer();
      const result = await batesPdf({
        bytes,
        pages,
        start,
        width,
        prefix,
        suffix,
        position,
        align,
        onProgress: (c, t) => setProgress(`Page ${Math.min(c + 1, t)} / ${t}`),
      });
      writeStoredNext(result.nextNumber);
      setStart(result.nextNumber);
      const name = file.name.replace(/\.pdf$/i, '') + '-bates.pdf';
      downloadBlobLocally(new Blob([result.bytes], { type: 'application/pdf' }), name);
      setProgress(
        `Downloaded. Next number saved as ${result.nextNumber} for multi-file continuity.`
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
      title="Bates numbering"
      description="Stamp sequential identifiers (prefix + zero-padded number + suffix) on each page."
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
          Apply & download
        </Button>
      }
    >
      <p className="text-sm text-[var(--color-muted)]">
        Multi-file continuity: the next number after each export is stored in{' '}
        <code className="rounded bg-[var(--color-surface-2)] px-1 text-xs">
          {BATES_NEXT_STORAGE_KEY}
        </code>{' '}
        so the following PDF continues the sequence.
      </p>

      <p className="rounded-lg border border-[var(--color-border)] px-3 py-2 font-mono text-sm text-[var(--color-ink)]">
        Preview: {preview}
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

      {progress ? <p className="text-sm text-[var(--color-muted)]">{progress}</p> : null}
      {error ? (
        <p className="text-sm text-[var(--color-danger)]" role="alert">
          {error}
        </p>
      ) : null}
    </ToolWorkbench>
  );
}
