'use client';

import React, { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/shared/ui/Button';
import { downloadBlobLocally } from '@/features/files/localDownload';
import { ToolWorkbench } from '../ToolWorkbench';
import { ToolError } from '../ToolError';
import { useToolHandoff } from '../useToolHandoff';
import { loadReadablePdf } from '../assertPdfReadable';
import { EPUB_LAYOUT_NOTICE, pdfToEpub } from './pdfToEpub';

export function PdfToEpubTool() {
  const { files, setFiles } = useToolHandoff();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);

  const file = files[0]?.file;

  useEffect(() => {
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
      const result = await pdfToEpub({
        bytes: fresh,
        title,
        onProgress: (c, t) => setProgress(`Page ${Math.min(c + 1, t)} / ${t}`),
      });
      downloadBlobLocally(result.epubBlob, `${title}.epub`);
      setProgress(`Downloaded EPUB (${result.pageCount} page(s) of source text).`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setProgress(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <ToolWorkbench
      title="PDF to EPUB"
      description="Package reading-order text into a reflowable EPUB. Not a print-perfect layout clone."
      files={files}
      onFilesChange={setFiles}
      busy={busy}
      processingMode="local"
      footer={
        <Button
          variant="primary"
          disabled={!file || busy}
          loading={busy}
          onClick={() => void convert()}
        >
          Convert & download EPUB
        </Button>
      }
    >
      <div
        className="flex gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm"
        role="note"
      >
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" aria-hidden />
        <p>{EPUB_LAYOUT_NOTICE}</p>
      </div>
      {progress ? <p className="text-sm text-[var(--color-muted)]">{progress}</p> : null}
      {error ? (
        <ToolError message={error} fileName={file?.name} onRetry={() => { setError(null); void convert(); }} />
      ) : null}
    </ToolWorkbench>
  );
}
