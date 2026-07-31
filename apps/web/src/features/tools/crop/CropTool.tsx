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
  cropBoxToMargins,
  cropPresetMargins,
  marginsToCropBox,
  type CropMarginPreset,
  type CropRect,
  type MarginsPt,
  uniformMargins,
} from '../pageGeometry';
import { cropPdf } from './cropPdf';

type PageMode = 'all' | 'selected';

export function CropTool() {
  /** Workspace bulk handoff (`?pages=1-3`) — must survive file-load reset. */
  const urlPagesRef = useRef<string | null>(null);
  const { files, setFiles } = useToolHandoff({
    onPages: (pages) => {
      urlPagesRef.current = pages;
      setPageMode('selected');
      setRangeText(pages);
    },
  });
  const [pageCount, setPageCount] = useState(0);
  const [pdfBytes, setPdfBytes] = useState<ArrayBuffer | null>(null);
  const [pageMode, setPageMode] = useState<PageMode>('all');
  const [rangeText, setRangeText] = useState('');
  const [activePage, setActivePage] = useState(1);
  const [margins, setMargins] = useState<MarginsPt>(uniformMargins(0));
  const [mediaSize, setMediaSize] = useState({ width: 612, height: 792 });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const cancelledRef = useRef(false);
  const { elapsedLabel } = useTimedProgress(busy);

  const file = files[0]?.file;
  const sizeHint = file ? softLargePdfHint(file.size) : null;

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const pages = new URLSearchParams(window.location.search).get('pages');
    if (pages?.trim()) {
      urlPagesRef.current = pages.trim();
      setPageMode('selected');
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
        const n = doc.getPageCount();
        setPageCount(n);
        setActivePage(1);
        setMargins(uniformMargins(0));
        const fromUrl = urlPagesRef.current;
        if (fromUrl) {
          setPageMode('selected');
          setRangeText(fromUrl);
        } else {
          setRangeText('');
          setPageMode('all');
        }
        setError(null);
        setProgress(null);
        const page = doc.getPage(0);
        const size = page.getSize();
        setMediaSize({ width: size.width, height: size.height });
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

  useEffect(() => {
    if (!pdfBytes || activePage < 1) return;
    let cancelled = false;
    (async () => {
      try {
        const doc = await loadReadablePdf(pdfBytes);
        if (cancelled) return;
        const page = doc.getPage(activePage - 1);
        const size = page.getSize();
        setMediaSize({ width: size.width, height: size.height });
      } catch {
        // keep previous media size
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pdfBytes, activePage]);

  const cropRect: CropRect = useMemo(
    () => marginsToCropBox(mediaSize.width, mediaSize.height, margins),
    [mediaSize, margins]
  );

  const setMarginField = (key: keyof MarginsPt, value: number) => {
    setMargins((prev) => ({ ...prev, [key]: Math.max(0, value) }));
  };

  const applyPreset = (preset: CropMarginPreset) => {
    setMargins(cropPresetMargins(preset));
  };

  const restore = () => {
    setMargins(uniformMargins(0));
  };

  const onCropChange = (rect: CropRect) => {
    setMargins(cropBoxToMargins(mediaSize.width, mediaSize.height, rect));
  };

  const resolveTargetPages = (): number[] | undefined => {
    if (pageMode === 'all') return undefined;
    return parsePageRanges(rangeText, { pageCount, rejectOverlaps: false });
  };

  const run = async () => {
    if (!file || !pdfBytes) return;
    cancelledRef.current = false;
    setBusy(true);
    setError(null);
    setProgress('Cropping…');
    try {
      const pages = resolveTargetPages();
      if (cancelledRef.current) {
        setProgress(null);
        return;
      }
      const bytes = await cropPdf({
        bytes: pdfBytes,
        pages,
        margins,
      });
      if (cancelledRef.current) {
        setProgress(null);
        return;
      }
      const name = file.name.replace(/\.pdf$/i, '') + '-cropped.pdf';
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
      title="Crop PDF"
      description="Trim page margins with a live preview. Content outside the crop is removed."
      files={files}
      onFilesChange={setFiles}
      busy={busy}
      footer={
        <>
          <Button
            variant="secondary"
            disabled={!file || busy}
            onClick={restore}
          >
            Restore (zero margins)
          </Button>
          <Button
            variant="primary"
            disabled={!file || busy}
            loading={busy}
            onClick={() => void run()}
          >
            Crop & download
          </Button>
        </>
      }
    >
      {pageCount > 0 ? (
        <>
          <fieldset className="space-y-2">
            <legend className="text-sm font-semibold text-[var(--color-ink)]">
              Pages
            </legend>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ['all', 'All pages'],
                  ['selected', 'Selected pages'],
                ] as const
              ).map(([value, label]) => (
                <label
                  key={value}
                  className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-sm"
                >
                  <input
                    type="radio"
                    name="crop-page-mode"
                    checked={pageMode === value}
                    onChange={() => setPageMode(value)}
                    disabled={busy}
                  />
                  {label}
                </label>
              ))}
            </div>
            {pageMode === 'selected' ? (
              <label className="block text-sm">
                <span className="font-medium text-[var(--color-ink)]">Range</span>
                <input
                  className="mt-1 w-full rounded-lg border border-[var(--color-border)] px-3 py-2"
                  value={rangeText}
                  onChange={(e) => setRangeText(e.target.value)}
                  placeholder="1, 3, 5-8"
                  disabled={busy}
                />
              </label>
            ) : null}
          </fieldset>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-[var(--color-ink)]">Presets</span>
            {(
              [
                ['narrow', 'Narrow'],
                ['normal', 'Normal'],
                ['wide', 'Wide'],
              ] as const
            ).map(([key, label]) => (
              <Button
                key={key}
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => applyPreset(key)}
              >
                {label}
              </Button>
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-4">
            {(['left', 'right', 'top', 'bottom'] as const).map((key) => (
              <label key={key} className="text-sm">
                <span className="font-medium capitalize">{key} (pt)</span>
                <input
                  type="number"
                  min={0}
                  step={1}
                  className="mt-1 w-full rounded-lg border border-[var(--color-border)] px-3 py-2"
                  value={Math.round(margins[key] * 10) / 10}
                  onChange={(e) => setMarginField(key, Number(e.target.value) || 0)}
                  disabled={busy}
                />
              </label>
            ))}
          </div>

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
          </div>

          {pdfBytes ? (
            <PagePreviewCanvas
              pdfBytes={pdfBytes}
              pageNumber={activePage}
              cropRect={cropRect}
              onCropChange={onCropChange}
              interactive
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
