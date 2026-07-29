'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { PDFDocument } from 'pdf-lib';
import { Button } from '@/shared/ui/Button';
import { downloadBlobLocally } from '@/features/files/localDownload';
import { ToolWorkbench, type ToolFile } from '../ToolWorkbench';
import { parsePageRanges, PageRangeError } from '../parsePageRanges';
import { extractPdfPages } from '../split/extractPdf';

export function ExtractTool() {
  const [files, setFiles] = useState<ToolFile[]>([]);
  const [pageCount, setPageCount] = useState(0);
  const [selected, setSelected] = useState<number[]>([]);
  const [rangeText, setRangeText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);

  const file = files[0]?.file;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!file) {
        setPageCount(0);
        setSelected([]);
        return;
      }
      try {
        const buf = await file.arrayBuffer();
        const doc = await PDFDocument.load(buf.slice(0), { ignoreEncryption: true });
        if (!cancelled) {
          const n = doc.getPageCount();
          setPageCount(n);
          setSelected([]);
          setRangeText('');
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
    setBusy(true);
    setError(null);
    setProgress('Extracting…');
    try {
      const bytes = await file.arrayBuffer();
      const result = await extractPdfPages(
        { bytes, pages: selected },
        (c, t) => setProgress(`Extracting ${c}/${t}…`)
      );
      const outName = file.name.replace(/\.pdf$/i, '') + '-extract.pdf';
      downloadBlobLocally(
        new Blob([result.bytes], { type: 'application/pdf' }),
        outName
      );
      setProgress(`Done — ${result.pageCount} page${result.pageCount === 1 ? '' : 's'}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setProgress(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <ToolWorkbench
      title="Extract pages"
      description="Pick pages and export a new PDF. Order is preserved."
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

      {progress ? <p className="text-sm text-[var(--color-muted)]">{progress}</p> : null}
      {error ? (
        <p className="text-sm text-[var(--color-danger)]" role="alert">
          {error}
        </p>
      ) : null}
    </ToolWorkbench>
  );
}
