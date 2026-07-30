'use client';

import React, { useState } from 'react';
import { PDFDocument } from 'pdf-lib';
import { Button } from '@/shared/ui/Button';
import { downloadBlobLocally } from '@/features/files/localDownload';
import { loadReadablePdf } from '../assertPdfReadable';
import { ToolWorkbench, type ToolFile } from '../ToolWorkbench';
import { ToolError } from '../ToolError';

/** Dedicated merge UI wrapping pdf-lib (same engine as workspace). */
export function MergeTool() {
  const [files, setFiles] = useState<ToolFile[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorFileName, setErrorFileName] = useState<string | undefined>();
  const [progress, setProgress] = useState<string | null>(null);

  const run = async () => {
    if (files.length < 2) {
      setError('Add at least two PDFs to merge.');
      setErrorFileName(undefined);
      return;
    }
    setBusy(true);
    setError(null);
    setErrorFileName(undefined);
    setProgress('Merging…');
    let activeName: string | undefined;
    try {
      const out = await PDFDocument.create();
      for (let i = 0; i < files.length; i++) {
        activeName = files[i].name;
        setProgress(`Merging ${i + 1}/${files.length}…`);
        const bytes = await files[i].file.arrayBuffer();
        const src = await loadReadablePdf(bytes);
        const copied = await out.copyPages(src, src.getPageIndices());
        copied.forEach((p) => out.addPage(p));
      }
      const saved = await out.save();
      downloadBlobLocally(
        new Blob([saved], { type: 'application/pdf' }),
        'merged.pdf'
      );
      setProgress('Downloaded merged.pdf');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setErrorFileName(activeName);
      setProgress(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <ToolWorkbench
      title="Merge PDF"
      description="Combine multiple PDFs into one file. Fully local."
      files={files}
      onFilesChange={setFiles}
      multiple
      maxFiles={40}
      busy={busy}
      footer={
        <Button
          variant="primary"
          disabled={files.length < 2 || busy}
          loading={busy}
          onClick={() => void run()}
        >
          Merge & download
        </Button>
      }
    >
      {progress ? <p className="text-sm text-[var(--color-muted)]">{progress}</p> : null}
      {error ? (
        <ToolError
          message={error}
          fileName={errorFileName}
          onRetry={() => {
            setError(null);
            setErrorFileName(undefined);
            void run();
          }}
        />
      ) : null}
    </ToolWorkbench>
  );
}

export function RotateTool() {
  const [files, setFiles] = useState<ToolFile[]>([]);
  const [angle, setAngle] = useState<90 | 180 | 270>(90);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const file = files[0]?.file;

  const run = async () => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const { degrees } = await import('pdf-lib');
      const bytes = await file.arrayBuffer();
      const doc = await loadReadablePdf(bytes);
      doc.getPages().forEach((p) => {
        const current = p.getRotation().angle;
        p.setRotation(degrees((current + angle) % 360));
      });
      const saved = await doc.save();
      downloadBlobLocally(
        new Blob([saved], { type: 'application/pdf' }),
        file.name.replace(/\.pdf$/i, '') + `-rotated-${angle}.pdf`
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ToolWorkbench
      title="Rotate PDF"
      description="Rotate all pages by 90°, 180°, or 270°."
      files={files}
      onFilesChange={setFiles}
      busy={busy}
      footer={
        <Button
          variant="primary"
          disabled={!files[0] || busy}
          loading={busy}
          onClick={() => void run()}
        >
          Rotate & download
        </Button>
      }
    >
      <div className="flex flex-wrap gap-2">
        {([90, 180, 270] as const).map((a) => (
          <label
            key={a}
            className="inline-flex items-center gap-2 rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-sm"
          >
            <input
              type="radio"
              name="rot"
              checked={angle === a}
              onChange={() => setAngle(a)}
              disabled={busy}
            />
            {a}°
          </label>
        ))}
      </div>
      {error ? (
        <ToolError
          message={error}
          fileName={file?.name}
          onRetry={() => {
            setError(null);
            void run();
          }}
        />
      ) : null}
    </ToolWorkbench>
  );
}

export function JpgToPdfTool() {
  const [files, setFiles] = useState<ToolFile[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorFileName, setErrorFileName] = useState<string | undefined>();

  const run = async () => {
    if (!files.length) return;
    setBusy(true);
    setError(null);
    setErrorFileName(undefined);
    let activeName: string | undefined;
    try {
      const out = await PDFDocument.create();
      for (const f of files) {
        activeName = f.name;
        const bytes = await f.file.arrayBuffer();
        const type = f.file.type.toLowerCase();
        let img;
        if (type.includes('png') || f.name.toLowerCase().endsWith('.png')) {
          img = await out.embedPng(bytes);
        } else {
          img = await out.embedJpg(bytes);
        }
        const page = out.addPage([img.width, img.height]);
        page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
      }
      const saved = await out.save();
      downloadBlobLocally(new Blob([saved], { type: 'application/pdf' }), 'images.pdf');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setErrorFileName(activeName);
    } finally {
      setBusy(false);
    }
  };

  return (
    <ToolWorkbench
      title="JPG to PDF"
      description="Convert one or more images into a PDF. PNG and JPEG supported."
      accept="image/jpeg,image/png,.jpg,.jpeg,.png"
      files={files}
      onFilesChange={setFiles}
      multiple
      maxFiles={60}
      busy={busy}
      footer={
        <Button
          variant="primary"
          disabled={!files.length || busy}
          loading={busy}
          onClick={() => void run()}
        >
          Convert & download
        </Button>
      }
    >
      {error ? (
        <ToolError
          message={error}
          fileName={errorFileName}
          onRetry={() => {
            setError(null);
            setErrorFileName(undefined);
            void run();
          }}
        />
      ) : null}
    </ToolWorkbench>
  );
}
