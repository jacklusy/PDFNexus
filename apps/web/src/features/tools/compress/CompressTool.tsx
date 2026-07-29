'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/shared/ui/Button';
import { downloadBlobLocally } from '@/features/files/localDownload';
import { formatTransferBytes } from '@/features/transfer/transferFormat';
import { ensurePdfWorker } from '@/lib/pdf/pdfHelpers';
import { loadReadablePdf } from '../assertPdfReadable';
import { ToolWorkbench, type ToolFile } from '../ToolWorkbench';
import {
  compressPdf,
  settingsForPreset,
  type CompressPreset,
  type CompressResult,
} from './compressPdf';
import type { PDFDocumentProxy } from 'pdfjs-dist';

async function openPdfjsDoc(pdfBytes: ArrayBuffer): Promise<PDFDocumentProxy> {
  const pdfjs = await import('pdfjs-dist');
  ensurePdfWorker(pdfjs);
  const task = pdfjs.getDocument({
    data: pdfBytes.slice(0),
    isEvalSupported: false,
  });
  return task.promise;
}

async function renderPageJpegFromDoc(
  doc: PDFDocumentProxy,
  pageIndex: number,
  maxPx: number,
  quality: number
): Promise<{ jpeg: Uint8Array; width: number; height: number }> {
  const page = await doc.getPage(pageIndex + 1);
  const base = page.getViewport({ scale: 1 });
  const scale = Math.min(1, maxPx / Math.max(base.width, base.height));
  const viewport = page.getViewport({ scale: Math.max(scale, 0.2) });
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.floor(viewport.width));
  canvas.height = Math.max(1, Math.floor(viewport.height));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable');
  await page.render({ canvasContext: ctx, viewport, canvas }).promise;
  const blob: Blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('JPEG encode failed'))),
      'image/jpeg',
      quality
    );
  });
  const buf = new Uint8Array(await blob.arrayBuffer());
  return { jpeg: buf, width: canvas.width, height: canvas.height };
}

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
  const [stats, setStats] = useState<CompressResult | null>(null);
  const pdfjsRef = useRef<PDFDocumentProxy | null>(null);

  const file = files[0]?.file;
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
        setStats(null);
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
    setBusy(true);
    setError(null);
    setStats(null);
    setProgress('Starting…');
    let pdfjsDoc: PDFDocumentProxy | null = null;
    try {
      const bytes = await file.arrayBuffer();
      if (rasterize) {
        pdfjsDoc = await openPdfjsDoc(bytes);
        pdfjsRef.current = pdfjsDoc;
      }
      const result = await compressPdf({
        bytes,
        settings,
        rasterizePages: rasterize,
        renderPage: async (pageIndex, maxPx, quality) => {
          if (!pdfjsDoc) throw new Error('PDF.js document missing');
          return renderPageJpegFromDoc(pdfjsDoc, pageIndex, maxPx, quality);
        },
        onProgress: (c, t, msg) => setProgress(msg || `${c}/${t}`),
      });
      setStats(result);
      const name = file.name.replace(/\.pdf$/i, '') + '-compressed.pdf';
      downloadBlobLocally(
        new Blob([result.bytes], { type: 'application/pdf' }),
        name
      );
      setProgress('Downloaded');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setProgress(null);
    } finally {
      if (pdfjsDoc) {
        await pdfjsDoc.destroy().catch(() => undefined);
        pdfjsRef.current = null;
      }
      setBusy(false);
    }
  };

  return (
    <ToolWorkbench
      title="Compress PDF"
      description="Reduce file size locally. Sizes shown are measured after processing — not estimates."
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
      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold text-[var(--color-ink)]">Preset</legend>
        <div className="flex flex-wrap gap-2">
          {(
            [
              ['low', 'Low · higher quality'],
              ['balanced', 'Balanced'],
              ['high', 'High · smaller'],
              ['custom', 'Custom'],
            ] as const
          ).map(([value, label]) => (
            <label
              key={value}
              className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-sm"
            >
              <input
                type="radio"
                name="compress-preset"
                checked={preset === value}
                onChange={() => setPreset(value)}
                disabled={busy}
              />
              {label}
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
              className="mt-1 w-full rounded-lg border border-[var(--color-border)] px-3 py-2"
              value={maxImagePx}
              onChange={(e) => setMaxImagePx(Number(e.target.value) || 1600)}
              disabled={busy}
            />
          </label>
          <label className="text-sm">
            <span className="font-medium">JPEG quality (%)</span>
            <input
              type="number"
              min={30}
              max={95}
              className="mt-1 w-full rounded-lg border border-[var(--color-border)] px-3 py-2"
              value={jpegQuality}
              onChange={(e) => setJpegQuality(Number(e.target.value) || 72)}
              disabled={busy}
            />
          </label>
        </div>
      ) : null}

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={rasterize}
          onChange={(e) => setRasterize(e.target.checked)}
          disabled={busy}
        />
        Re-encode pages as images (stronger compression; text becomes image)
      </label>

      {file && pageCount > 0 ? (
        <p className="text-sm text-[var(--color-muted)]">
          Source: {formatTransferBytes(file.size)} · {pageCount} pages · settings:{' '}
          {settings.maxImagePx}px / {Math.round(settings.jpegQuality * 100)}% JPEG
        </p>
      ) : null}

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

      {progress ? <p className="text-sm text-[var(--color-muted)]">{progress}</p> : null}
      {error ? (
        <p className="text-sm text-[var(--color-danger)]" role="alert">
          {error}
        </p>
      ) : null}
    </ToolWorkbench>
  );
}
