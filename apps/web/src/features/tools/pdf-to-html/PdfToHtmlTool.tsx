'use client';

import React, { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/shared/ui/Button';
import { downloadBlobLocally } from '@/features/files/localDownload';
import { ToolWorkbench } from '../ToolWorkbench';
import { useToolHandoff } from '../useToolHandoff';
import { loadReadablePdf } from '../assertPdfReadable';
import { pdfToHtml } from './pdfToHtml';

export function PdfToHtmlTool() {
  const { files, setFiles } = useToolHandoff();
  const [html, setHtml] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);

  const file = files[0]?.file;

  useEffect(() => {
    setHtml(null);
    setError(null);
    setProgress(null);
  }, [file]);

  const convert = async () => {
    if (!file) return;
    setBusy(true);
    setError(null);
    setProgress('Extracting text…');
    try {
      const bytes = await file.arrayBuffer();
      await loadReadablePdf(bytes);
      const fresh = await file.arrayBuffer();
      const title = file.name.replace(/\.pdf$/i, '') || 'PDF export';
      const result = await pdfToHtml({
        bytes: fresh,
        title,
        onProgress: (c, t) => setProgress(`Page ${Math.min(c + 1, t)} / ${t}`),
      });
      setHtml(result.html);
      setProgress(`Ready — ${result.pageCount} page(s)`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setHtml(null);
      setProgress(null);
    } finally {
      setBusy(false);
    }
  };

  const download = () => {
    if (!html || !file) return;
    const name = file.name.replace(/\.pdf$/i, '') + '.html';
    downloadBlobLocally(new Blob([html], { type: 'text/html;charset=utf-8' }), name);
    setProgress('Downloaded .html');
  };

  return (
    <ToolWorkbench
      title="PDF to HTML"
      description="Export reading-order text as a simple HTML article. Preview before download."
      files={files}
      onFilesChange={(next) => {
        setFiles(next);
        setError(null);
        setProgress(null);
      }}
      busy={busy}
      footer={
        <>
          <Button
            variant="primary"
            disabled={!file || busy}
            loading={busy}
            onClick={() => void convert()}
          >
            Convert
          </Button>
          <Button
            variant="outline"
            disabled={!html || busy}
            onClick={download}
          >
            Download .html
          </Button>
        </>
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
        <div className="space-y-1 text-sm">
          <p className="font-semibold text-[var(--color-ink)]">Layout warning</p>
          <p className="text-[var(--color-muted)]">
            Output follows reading order (top→bottom, left→right). Multi-column
            layouts, tables, and scanned pages may not match the original appearance.
          </p>
        </div>
      </div>

      {html ? (
        <div className="space-y-2">
          <p className="text-sm font-semibold text-[var(--color-ink)]">Preview</p>
          <iframe
            title="HTML preview"
            srcDoc={html}
            className="h-[420px] w-full rounded-xl border border-[var(--color-border)] bg-white"
            sandbox=""
          />
        </div>
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
