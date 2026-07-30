'use client';

import React, { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/shared/ui/Button';
import { downloadBlobLocally } from '@/features/files/localDownload';
import { ToolWorkbench } from '../ToolWorkbench';
import { useToolHandoff } from '../useToolHandoff';
import { loadReadablePdf } from '../assertPdfReadable';
import { detectTables, type DetectedTable } from './detectTables';
import { canRunOcrTableDetect, detectTablesViaOcr } from './ocrTables';
import { pdfToExcel } from './pdfToExcel';
import { ToolError } from '../ToolError';

export function PdfToExcelTool() {
  const { files, setFiles } = useToolHandoff();
  const [tables, setTables] = useState<DetectedTable[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [ocrConsent, setOcrConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [lastAction, setLastAction] = useState<'detect' | 'ocr' | 'export'>('detect');
  const [detectKey, setDetectKey] = useState(0);

  const file = files[0]?.file;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!file) {
        setTables([]);
        setSelected(new Set());
        return;
      }
      setBusy(true);
      setError(null);
      setLastAction('detect');
      setProgress('Detecting tables…');
      try {
        await loadReadablePdf(await file.arrayBuffer());
        const bytes = await file.arrayBuffer();
        const found = await detectTables(bytes);
        if (cancelled) return;
        setTables(found);
        setSelected(new Set(found.map((_, i) => i)));
        setProgress(
          found.length
            ? `Found ${found.length} table(s)`
            : 'No tables detected from text layer'
        );
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e));
          setProgress(null);
        }
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [file, detectKey]);

  const toggle = (index: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const runOcrDetect = async () => {
    if (!canRunOcrTableDetect(ocrConsent, Boolean(file)) || !file) return;
    setBusy(true);
    setError(null);
    setLastAction('ocr');
    try {
      const bytes = await file.arrayBuffer();
      const found = await detectTablesViaOcr({
        bytes,
        onProgress: setProgress,
      });
      setTables(found);
      setSelected(new Set(found.map((_, i) => i)));
      setProgress(
        found.length
          ? `OCR found ${found.length} table(s)`
          : 'OCR returned no tables'
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setProgress(null);
    } finally {
      setBusy(false);
    }
  };

  const exportXlsx = () => {
    if (!file || selected.size === 0) return;
    setBusy(true);
    setError(null);
    setLastAction('export');
    try {
      const indices = [...selected].sort((a, b) => a - b);
      const buf = pdfToExcel({ tables, selectedIndices: indices });
      const name = file.name.replace(/\.pdf$/i, '') + '.xlsx';
      downloadBlobLocally(
        new Blob([buf], {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        }),
        name
      );
      setProgress(`Downloaded ${indices.length} sheet(s)`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const retryLast = () => {
    setError(null);
    if (lastAction === 'ocr') void runOcrDetect();
    else if (lastAction === 'export') exportXlsx();
    else setDetectKey((k) => k + 1);
  };

  return (
    <ToolWorkbench
      title="PDF to Excel"
      description="Detect tables from the PDF text layer and export selected ones to .xlsx. Layout is heuristic — not pixel-perfect."
      files={files}
      onFilesChange={(next) => {
        setFiles(next);
        setOcrConsent(false);
        setError(null);
        setProgress(null);
      }}
      busy={busy}
      processingMode={ocrConsent ? 'cloud_assisted' : 'partial'}
      footer={
        <Button
          variant="primary"
          disabled={!file || busy || selected.size === 0}
          loading={busy}
          onClick={exportXlsx}
        >
          Export .xlsx
        </Button>
      }
    >
      <div
        className="flex gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-accent-soft)]/40 p-4"
        role="note"
      >
        <AlertTriangle
          className="mt-0.5 h-5 w-5 shrink-0 text-[var(--color-accent)]"
          aria-hidden
        />
        <div className="space-y-2 text-sm">
          <p className="font-semibold text-[var(--color-ink)]">Scanned PDFs</p>
          <p className="text-[var(--color-muted)]">
            Table detection uses the embedded text layer. Scanned or image-only
            PDFs need OCR. OCR uploads page images to the server — enable only
            if you consent.
          </p>
        </div>
      </div>

      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          className="mt-1"
          checked={ocrConsent}
          onChange={(e) => setOcrConsent(e.target.checked)}
          disabled={busy || !file}
        />
        <span>
          I consent to upload pages for OCR table detection
          {ocrConsent ? (
            <span className="mt-1 block text-xs text-[var(--color-muted)]">
              OCR uploads page images via{' '}
              <code className="rounded bg-[var(--color-surface-2)] px-1">
                /api/pdf-to-docx/analyze-ocr
              </code>{' '}
              (first 5 pages). Local text-layer detection does not upload.
            </span>
          ) : null}
        </span>
      </label>

      {ocrConsent ? (
        <Button
          variant="secondary"
          disabled={!file || busy || !ocrConsent}
          loading={busy}
          onClick={() => void runOcrDetect()}
        >
          Detect tables with OCR
        </Button>
      ) : null}

      {tables.length > 0 ? (
        <ul className="space-y-2" aria-label="Detected tables">
          {tables.map((t, i) => (
            <li
              key={`${t.page}-${i}`}
              className="rounded-lg border border-[var(--color-border)] px-3 py-2"
            >
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={selected.has(i)}
                  onChange={() => toggle(i)}
                  disabled={busy}
                />
                <span>
                  <span className="font-medium text-[var(--color-ink)]">
                    Page {t.page} — table {i + 1}
                  </span>
                  <span className="mt-0.5 block text-xs text-[var(--color-muted)]">
                    {t.rows.length} row(s) ×{' '}
                    {Math.max(...t.rows.map((r) => r.length), 0)} column(s)
                  </span>
                  <span className="mt-1 block truncate font-mono text-xs text-[var(--color-muted)]">
                    {t.rows[0]?.join(' | ')}
                  </span>
                </span>
              </label>
            </li>
          ))}
        </ul>
      ) : file && !busy ? (
        <p className="text-sm text-[var(--color-muted)]">
          No tables found. Try a PDF with a selectable text layer, or consent to
          OCR if the file is scanned.
        </p>
      ) : null}

      {progress ? <p className="text-sm text-[var(--color-muted)]">{progress}</p> : null}
      {error ? (
        <ToolError
          message={error}
          fileName={file?.name}
          cloudNote={
            ocrConsent
              ? 'If OCR ran, page images may have been sent after consent. Your original PDF is unchanged.'
              : undefined
          }
          onRetry={retryLast}
        />
      ) : null}
    </ToolWorkbench>
  );
}
