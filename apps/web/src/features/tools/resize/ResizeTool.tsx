'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/shared/ui/Button';
import { downloadBlobLocally } from '@/features/files/localDownload';
import { loadReadablePdf } from '../assertPdfReadable';
import { ToolWorkbench } from '../ToolWorkbench';
import { ToolError } from '../ToolError';
import { ToolProgress } from '../ToolProgress';
import { useTimedProgress } from '../useTimedProgress';
import { softLargePdfHint } from '../softLargePdfHint';
import { useToolHandoff } from '../useToolHandoff';
import { parsePageRanges, PageRangeError } from '../parsePageRanges';
import { PagePreviewCanvas } from '../PagePreviewCanvas';
import {
  PAPER_PRESET_ORDER,
  PAPER_SIZES_PT,
  convertLength,
  layoutEmbed,
  resolvePaperSize,
  sizeFromPt,
  type EmbedLayoutMode,
  type LengthUnit,
  type PaperPreset,
} from '../pageGeometry';
import { resizePdf } from './resizePdf';

export function ResizeTool() {
  const urlPagesRef = useRef<string | null>(null);
  const { files, setFiles } = useToolHandoff({
    onPages: (pages) => {
      urlPagesRef.current = pages;
      setUseRange(true);
      setRangeText(pages);
    },
  });
  const [pageCount, setPageCount] = useState(0);
  const [pdfBytes, setPdfBytes] = useState<ArrayBuffer | null>(null);
  const [activePage, setActivePage] = useState(1);
  const [rangeText, setRangeText] = useState('');
  const [useRange, setUseRange] = useState(false);
  const [preset, setPreset] = useState<PaperPreset>('A4');
  const [unit, setUnit] = useState<LengthUnit>('mm');
  const [customW, setCustomW] = useState(210);
  const [customH, setCustomH] = useState(297);
  const [mode, setMode] = useState<EmbedLayoutMode>('fit');
  const [marginPt, setMarginPt] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const cancelledRef = useRef(false);
  const { elapsedLabel } = useTimedProgress(busy);

  const file = files[0]?.file;
  const sizeHint = file ? softLargePdfHint(file.size) : null;

  const targetPt = useMemo(() => {
    try {
      return resolvePaperSize(
        preset,
        preset === 'custom' ? { width: customW, height: customH } : undefined,
        unit
      );
    } catch {
      return PAPER_SIZES_PT.A4;
    }
  }, [preset, customW, customH, unit]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const pages = new URLSearchParams(window.location.search).get('pages');
    if (pages?.trim()) {
      urlPagesRef.current = pages.trim();
      setUseRange(true);
      setRangeText(pages.trim());
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!file) {
        setPageCount(0);
        setPdfBytes(null);
        return;
      }
      try {
        const buf = await file.arrayBuffer();
        const doc = await loadReadablePdf(buf);
        if (cancelled) return;
        setPageCount(doc.getPageCount());
        setActivePage(1);
        const fromUrl = urlPagesRef.current;
        if (fromUrl) {
          setUseRange(true);
          setRangeText(fromUrl);
        }
        setError(null);
        setProgress(null);
        setPdfBytes(buf.slice(0));
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Could not read PDF');
          setPdfBytes(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [file]);

  // When unit changes, convert custom fields
  const changeUnit = (next: LengthUnit) => {
    if (next === unit) return;
    setCustomW(convertLength(customW, unit, next));
    setCustomH(convertLength(customH, unit, next));
    setUnit(next);
  };

  const selectPreset = (p: PaperPreset) => {
    setPreset(p);
    if (p !== 'custom') {
      const sized = sizeFromPt(PAPER_SIZES_PT[p], unit);
      setCustomW(Math.round(sized.width * 100) / 100);
      setCustomH(Math.round(sized.height * 100) / 100);
    }
  };

  const layoutHint = useMemo(() => {
    // Approximate using Letter for preview caption when no page metrics
    return layoutEmbed(612, 792, targetPt.width, targetPt.height, mode, marginPt);
  }, [targetPt, mode, marginPt]);

  const run = async () => {
    if (!file || !pdfBytes) return;
    cancelledRef.current = false;
    setBusy(true);
    setError(null);
    setProgress('Resizing…');
    try {
      let pages: number[] | undefined;
      if (useRange && rangeText.trim()) {
        pages = parsePageRanges(rangeText, { pageCount, rejectOverlaps: false });
      }
      if (cancelledRef.current) {
        setProgress(null);
        return;
      }
      const bytes = await resizePdf({
        bytes: pdfBytes,
        pages,
        target: targetPt,
        mode,
        marginPt,
      });
      if (cancelledRef.current) {
        setProgress(null);
        return;
      }
      const name = file.name.replace(/\.pdf$/i, '') + '-resized.pdf';
      downloadBlobLocally(new Blob([bytes], { type: 'application/pdf' }), name);
      setProgress('Downloaded');
    } catch (e) {
      setError(
        e instanceof PageRangeError || e instanceof Error ? e.message : String(e)
      );
      setProgress(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <ToolWorkbench
      title="Resize PDF"
      description="Change page dimensions with fit, fill, center, or stretch. Units shown clearly."
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
          Resize & download
        </Button>
      }
    >
      {pageCount > 0 ? (
        <>
          <fieldset className="space-y-2">
            <legend className="text-sm font-semibold text-[var(--color-ink)]">
              Paper size
            </legend>
            <div className="flex flex-wrap gap-2">
              {PAPER_PRESET_ORDER.map((p) => (
                <label
                  key={p}
                  className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-sm"
                >
                  <input
                    type="radio"
                    name="resize-paper"
                    checked={preset === p}
                    onChange={() => selectPreset(p)}
                    disabled={busy}
                  />
                  {p === 'custom' ? 'Custom' : p}
                </label>
              ))}
            </div>
          </fieldset>

          <div className="flex flex-wrap items-end gap-3">
            <fieldset className="space-y-1">
              <legend className="text-sm font-medium text-[var(--color-ink)]">Unit</legend>
              <div className="flex gap-2">
                {(['pt', 'mm', 'in'] as LengthUnit[]).map((u) => (
                  <label
                    key={u}
                    className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-[var(--color-border)] px-2.5 py-1 text-sm"
                  >
                    <input
                      type="radio"
                      name="resize-unit"
                      checked={unit === u}
                      onChange={() => changeUnit(u)}
                      disabled={busy}
                    />
                    {u}
                  </label>
                ))}
              </div>
            </fieldset>
            <label className="text-sm">
              <span className="font-medium">Width ({unit})</span>
              <input
                type="number"
                min={1}
                step={unit === 'pt' ? 1 : 0.1}
                className="mt-1 w-28 rounded-lg border border-[var(--color-border)] px-3 py-2"
                value={Math.round(customW * 100) / 100}
                onChange={(e) => {
                  setPreset('custom');
                  setCustomW(Number(e.target.value) || 0);
                }}
                disabled={busy}
              />
            </label>
            <label className="text-sm">
              <span className="font-medium">Height ({unit})</span>
              <input
                type="number"
                min={1}
                step={unit === 'pt' ? 1 : 0.1}
                className="mt-1 w-28 rounded-lg border border-[var(--color-border)] px-3 py-2"
                value={Math.round(customH * 100) / 100}
                onChange={(e) => {
                  setPreset('custom');
                  setCustomH(Number(e.target.value) || 0);
                }}
                disabled={busy}
              />
            </label>
            <p className="text-xs text-[var(--color-muted)]">
              = {Math.round(targetPt.width)} × {Math.round(targetPt.height)} pt
            </p>
          </div>

          <fieldset className="space-y-2">
            <legend className="text-sm font-semibold text-[var(--color-ink)]">
              Scale mode
            </legend>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ['fit', 'Fit content'],
                  ['fill', 'Fill page'],
                  ['center', 'Center (1:1)'],
                  ['stretch', 'Stretch'],
                ] as const
              ).map(([value, label]) => (
                <label
                  key={value}
                  className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-sm"
                >
                  <input
                    type="radio"
                    name="resize-mode"
                    checked={mode === value}
                    onChange={() => setMode(value)}
                    disabled={busy}
                  />
                  {label}
                </label>
              ))}
            </div>
            {mode === 'stretch' ? (
              <p className="text-xs text-[var(--color-muted)]">
                Stretch may distort content. Prefer Fit or Fill when possible.
              </p>
            ) : null}
          </fieldset>

          <label className="block text-sm max-w-xs">
            <span className="font-medium">Margin (pt)</span>
            <input
              type="number"
              min={0}
              className="mt-1 w-full rounded-lg border border-[var(--color-border)] px-3 py-2"
              value={marginPt}
              onChange={(e) => setMarginPt(Math.max(0, Number(e.target.value) || 0))}
              disabled={busy}
            />
          </label>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={useRange}
              onChange={(e) => setUseRange(e.target.checked)}
              disabled={busy}
            />
            Only resize selected pages
          </label>
          {useRange ? (
            <label className="block text-sm">
              <span className="font-medium">Range</span>
              <input
                className="mt-1 w-full rounded-lg border border-[var(--color-border)] px-3 py-2"
                value={rangeText}
                onChange={(e) => setRangeText(e.target.value)}
                placeholder="1, 3, 5-8"
                disabled={busy}
              />
            </label>
          ) : null}

          <div className="flex flex-wrap items-center gap-3">
            <label className="text-sm">
              <span className="font-medium">Preview page</span>
              <input
                type="number"
                min={1}
                max={pageCount}
                className="ml-2 w-20 rounded-lg border border-[var(--color-border)] px-2 py-1.5"
                value={activePage}
                onChange={(e) =>
                  setActivePage(
                    Math.min(pageCount, Math.max(1, Number(e.target.value) || 1))
                  )
                }
                disabled={busy}
              />
              <span className="ml-1 text-[var(--color-muted)]">/ {pageCount}</span>
            </label>
            <p className="text-xs text-[var(--color-muted)]">
              Placement ≈ {Math.round(layoutHint.width)}×{Math.round(layoutHint.height)} pt
              at ({Math.round(layoutHint.x)}, {Math.round(layoutHint.y)})
            </p>
          </div>

          {pdfBytes ? (
            <PagePreviewCanvas
              pdfBytes={pdfBytes}
              pageNumber={activePage}
              interactive={false}
            />
          ) : null}
        </>
      ) : null}

      {sizeHint ? (
        <p className="text-sm text-[var(--color-muted)]" role="note">
          {sizeHint}
        </p>
      ) : null}
      {busy && progress ? (
        <ToolProgress
          stage={progress}
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
        <ToolError message={error} fileName={file?.name} onRetry={() => { setError(null); void run(); }} />
      ) : null}
    </ToolWorkbench>
  );
}
