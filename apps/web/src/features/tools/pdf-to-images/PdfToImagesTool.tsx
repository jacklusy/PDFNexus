'use client';

import React, { useEffect, useState } from 'react';
import { PDFDocument } from 'pdf-lib';
import { Button } from '@/shared/ui/Button';
import { downloadBlobLocally } from '@/features/files/localDownload';
import { ToolWorkbench, type ToolFile } from '../ToolWorkbench';
import { parsePageRanges } from '../parsePageRanges';
import { pdfToImages, type ImageExportFormat } from './pdfToImages';

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
        const doc = await PDFDocument.load(buf.slice(0), { ignoreEncryption: true });
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
    setProgress('Rendering…');
    try {
      const pages = parsePageRanges(rangeText || `1-${pageCount}`, {
        pageCount,
        rejectOverlaps: true,
      });
      const bytes = await file.arrayBuffer();
      const baseName = file.name.replace(/\.pdf$/i, '') || 'page';
      const result = await pdfToImages({
        bytes,
        pages,
        format,
        scale,
        quality: quality / 100,
        background,
        namePattern,
        baseName,
        onProgress: (c, t) => setProgress(`Rendering ${c}/${t}…`),
      });
      if (result.zipBlob) {
        downloadBlobLocally(result.zipBlob, `${baseName}-images.zip`);
      } else if (result.files[0]) {
        downloadBlobLocally(result.files[0].blob, result.files[0].fileName);
      }
      setProgress(`Done — ${result.files.length} image(s)`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setProgress(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <ToolWorkbench
      title="PDF to images"
      description="Export pages as JPG, PNG, or WebP. Multi-page results download as a ZIP."
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
          Export & download
        </Button>
      }
    >
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
                min={0.5}
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
      {progress ? <p className="text-sm text-[var(--color-muted)]">{progress}</p> : null}
      {error ? (
        <p className="text-sm text-[var(--color-danger)]" role="alert">
          {error}
        </p>
      ) : null}
    </ToolWorkbench>
  );
}
