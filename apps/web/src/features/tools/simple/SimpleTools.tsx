'use client';

import React, { useRef, useState } from 'react';
import { PDFDocument } from 'pdf-lib';
import { Button } from '@/shared/ui/Button';
import { downloadBlobLocally } from '@/features/files/localDownload';
import { loadReadablePdf } from '../assertPdfReadable';
import { ToolWorkbench, type ToolFile } from '../ToolWorkbench';
import { ToolError } from '../ToolError';
import { ToolProgress } from '../ToolProgress';
import { useTimedProgress } from '../useTimedProgress';

/** Dedicated merge UI wrapping pdf-lib (same engine as workspace). */
export function MergeTool() {
  const [files, setFiles] = useState<ToolFile[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorFileName, setErrorFileName] = useState<string | undefined>();
  const [progress, setProgress] = useState<string | null>(null);
  const [fileCurrent, setFileCurrent] = useState(0);
  const [fileTotal, setFileTotal] = useState(0);
  const cancelledRef = useRef(false);
  const { elapsedLabel } = useTimedProgress(busy);

  const run = async () => {
    if (files.length < 2) {
      setError('Add at least two PDFs to merge.');
      setErrorFileName(undefined);
      return;
    }
    cancelledRef.current = false;
    setBusy(true);
    setError(null);
    setErrorFileName(undefined);
    setProgress('Merging…');
    setFileCurrent(0);
    setFileTotal(files.length);
    let activeName: string | undefined;
    try {
      const out = await PDFDocument.create();
      for (let i = 0; i < files.length; i++) {
        if (cancelledRef.current) {
          setProgress(null);
          return;
        }
        activeName = files[i].name;
        setFileCurrent(i + 1);
        setProgress(`Merging ${i + 1}/${files.length}…`);
        const bytes = await files[i].file.arrayBuffer();
        if (cancelledRef.current) {
          setProgress(null);
          return;
        }
        const src = await loadReadablePdf(bytes);
        const copied = await out.copyPages(src, src.getPageIndices());
        copied.forEach((p) => out.addPage(p));
      }
      if (cancelledRef.current) {
        setProgress(null);
        return;
      }
      const saved = await out.save();
      if (cancelledRef.current) {
        setProgress(null);
        return;
      }
      downloadBlobLocally(
        new Blob([saved], { type: 'application/pdf' }),
        'merged.pdf'
      );
      setProgress('Downloaded merged.pdf');
      setFileCurrent(0);
      setFileTotal(0);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setErrorFileName(activeName);
      setProgress(null);
      setFileCurrent(0);
      setFileTotal(0);
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
      {busy && progress ? (
        <ToolProgress
          stage={progress}
          currentFile={fileCurrent || undefined}
          totalFiles={fileTotal || undefined}
          elapsedLabel={elapsedLabel}
          onCancel={() => {
            cancelledRef.current = true;
            setProgress('Cancelling after current file…');
          }}
        />
      ) : progress && !busy ? (
        <p className="text-sm text-[var(--color-muted)]">{progress}</p>
      ) : null}
      <p className="text-xs text-[var(--color-muted)]">
        Cancel finishes the current file, then stops (no mid-step abort).
      </p>
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
  const [progress, setProgress] = useState<string | null>(null);
  const cancelledRef = useRef(false);
  const { elapsedLabel } = useTimedProgress(busy);
  const file = files[0]?.file;

  const run = async () => {
    if (!file) return;
    cancelledRef.current = false;
    setBusy(true);
    setError(null);
    setProgress('Rotating…');
    try {
      const { degrees } = await import('pdf-lib');
      const bytes = await file.arrayBuffer();
      if (cancelledRef.current) {
        setProgress(null);
        return;
      }
      const doc = await loadReadablePdf(bytes);
      if (cancelledRef.current) {
        setProgress(null);
        return;
      }
      doc.getPages().forEach((p) => {
        const current = p.getRotation().angle;
        p.setRotation(degrees((current + angle) % 360));
      });
      if (cancelledRef.current) {
        setProgress(null);
        return;
      }
      const saved = await doc.save();
      if (cancelledRef.current) {
        setProgress(null);
        return;
      }
      downloadBlobLocally(
        new Blob([saved], { type: 'application/pdf' }),
        file.name.replace(/\.pdf$/i, '') + `-rotated-${angle}.pdf`
      );
      setProgress('Downloaded');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setProgress(null);
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
      <p className="text-xs text-[var(--color-muted)]">
        Cancel finishes the current step, then stops (no mid-step abort).
      </p>
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
  const [progress, setProgress] = useState<string | null>(null);
  const [fileCurrent, setFileCurrent] = useState(0);
  const [fileTotal, setFileTotal] = useState(0);
  const cancelledRef = useRef(false);
  const { elapsedLabel } = useTimedProgress(busy);

  const run = async () => {
    if (!files.length) return;
    cancelledRef.current = false;
    setBusy(true);
    setError(null);
    setErrorFileName(undefined);
    setProgress('Converting…');
    setFileCurrent(0);
    setFileTotal(files.length);
    let activeName: string | undefined;
    try {
      const out = await PDFDocument.create();
      for (let i = 0; i < files.length; i++) {
        if (cancelledRef.current) {
          setProgress(null);
          return;
        }
        const f = files[i];
        activeName = f.name;
        setFileCurrent(i + 1);
        setProgress(`Embedding ${i + 1}/${files.length}…`);
        const bytes = await f.file.arrayBuffer();
        if (cancelledRef.current) {
          setProgress(null);
          return;
        }
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
      if (cancelledRef.current) {
        setProgress(null);
        return;
      }
      const saved = await out.save();
      if (cancelledRef.current) {
        setProgress(null);
        return;
      }
      downloadBlobLocally(new Blob([saved], { type: 'application/pdf' }), 'images.pdf');
      setProgress('Downloaded images.pdf');
      setFileCurrent(0);
      setFileTotal(0);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setErrorFileName(activeName);
      setProgress(null);
      setFileCurrent(0);
      setFileTotal(0);
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
      {busy && progress ? (
        <ToolProgress
          stage={progress}
          currentFile={fileCurrent || undefined}
          totalFiles={fileTotal || undefined}
          elapsedLabel={elapsedLabel}
          onCancel={() => {
            cancelledRef.current = true;
            setProgress('Cancelling after current image…');
          }}
        />
      ) : progress && !busy ? (
        <p className="text-sm text-[var(--color-muted)]">{progress}</p>
      ) : null}
      <p className="text-xs text-[var(--color-muted)]">
        Cancel finishes the current image, then stops (no mid-step abort).
      </p>
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
