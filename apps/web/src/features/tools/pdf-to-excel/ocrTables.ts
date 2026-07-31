/**
 * Optional OCR table detection via existing Gemini OCR API (consent required).
 */

import { getApiBase } from '@/lib/api';
import { pdfToImages } from '../pdf-to-images/pdfToImages';
import type { DetectedTable } from './detectTables';

type OcrLayout = {
  elements?: Array<{
    type?: string;
    tableRows?: Array<{ cells?: Array<{ text?: string }> }>;
  }>;
};

async function blobToJpegBase64(blob: Blob): Promise<string> {
  const buf = await blob.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  const dataUrl = `data:image/jpeg;base64,${btoa(binary)}`;
  // API expects raw base64 without data-url prefix in some paths; send both-safe strip.
  return dataUrl.replace(/^data:image\/jpeg;base64,/, '');
}

function tablesFromLayout(page: number, layout: OcrLayout | null): DetectedTable[] {
  if (!layout?.elements?.length) return [];
  const out: DetectedTable[] = [];
  for (const el of layout.elements) {
    if (el.type !== 'table' || !el.tableRows?.length) continue;
    const rows = el.tableRows.map((r) =>
      (r.cells ?? []).map((c) => (c.text ?? '').trim())
    );
    if (rows.length >= 1 && rows.some((r) => r.length >= 1)) {
      out.push({ page, rows });
    }
  }
  return out;
}

export async function detectTablesViaOcr(options: {
  bytes: ArrayBuffer;
  /** 1-based page numbers; defaults to first 5 pages. */
  pages?: number[];
  onProgress?: (msg: string) => void;
  signal?: AbortSignal;
}): Promise<DetectedTable[]> {
  const throwIfAborted = () => {
    if (options.signal?.aborted) {
      const err = new Error('Cancelled');
      err.name = 'AbortError';
      throw err;
    }
  };
  throwIfAborted();

  const pdfjs = await import('pdfjs-dist');
  const { ensurePdfJsWorker } = await import('@/lib/pdf/ensurePdfJsWorker');
  ensurePdfJsWorker(pdfjs);
  throwIfAborted();
  const task = pdfjs.getDocument(
    (await import('@/lib/pdf/ensurePdfJsWorker')).pdfJsGetDocumentInit(options.bytes)
  );
  const doc = await task.promise;
  let pageList = options.pages;
  try {
    if (!pageList?.length) {
      const max = Math.min(doc.numPages, 5);
      pageList = Array.from({ length: max }, (_, i) => i + 1);
    }
  } finally {
    await doc.destroy();
  }

  throwIfAborted();
  options.onProgress?.('Rendering pages for OCR…');
  const images = await pdfToImages({
    bytes: options.bytes,
    pages: pageList,
    format: 'image/jpeg',
    scale: 1.5,
    quality: 0.85,
    background: '#ffffff',
    namePattern: 'p{n}',
    baseName: 'ocr',
    signal: options.signal,
  });

  const tables: DetectedTable[] = [];
  let failures = 0;
  for (let i = 0; i < images.files.length; i++) {
    throwIfAborted();
    const pageNum = pageList[i];
    options.onProgress?.(
      `OCR page ${pageNum} (${i + 1}/${images.files.length})…`
    );
    const imageBase64 = await blobToJpegBase64(images.files[i].blob);
    throwIfAborted();
    try {
      const res = await fetch(`${getApiBase()}/api/pdf-to-docx/analyze-ocr`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        signal: options.signal,
        body: JSON.stringify({ imageBase64, pageNumber: pageNum }),
      });
      if (!res.ok) {
        failures += 1;
        continue;
      }
      const json = (await res.json()) as { success?: boolean; layout?: OcrLayout };
      if (json.success && json.layout) {
        tables.push(...tablesFromLayout(pageNum, json.layout));
      }
    } catch (e) {
      if (
        options.signal?.aborted ||
        (e instanceof Error && (e.name === 'AbortError' || e.message === 'Cancelled'))
      ) {
        throw e instanceof Error && e.name === 'AbortError'
          ? e
          : Object.assign(new Error('Cancelled'), { name: 'AbortError' });
      }
      failures += 1;
    }
  }
  throwIfAborted();
  if (failures === images.files.length && tables.length === 0) {
    throw new Error(
      'OCR failed for every page (network, rate limit, or API error). Try again or use local text-layer detection.'
    );
  }
  if (failures > 0 && tables.length === 0) {
    throw new Error(
      `OCR completed with ${failures} failed page(s) and no tables found.`
    );
  }
  return tables;
}

/** Pure gate used by unit tests — convert only when consent + file present. */
export function canRunOcrTableDetect(consent: boolean, hasFile: boolean): boolean {
  return Boolean(consent && hasFile);
}
