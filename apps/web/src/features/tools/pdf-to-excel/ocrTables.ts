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
}): Promise<DetectedTable[]> {
  const pdfjs = await import('pdfjs-dist');
  const { ensurePdfWorker } = await import('@/lib/pdf/pdfHelpers');
  ensurePdfWorker(pdfjs);
  const task = pdfjs.getDocument({
    data: options.bytes.slice(0),
    isEvalSupported: false,
  });
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
  });

  const tables: DetectedTable[] = [];
  for (let i = 0; i < images.files.length; i++) {
    const pageNum = pageList[i];
    options.onProgress?.(
      `OCR page ${pageNum} (${i + 1}/${images.files.length})…`
    );
    const imageBase64 = await blobToJpegBase64(images.files[i].blob);
    try {
      const res = await fetch(`${getApiBase()}/api/pdf-to-docx/analyze-ocr`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ imageBase64, pageNumber: pageNum }),
      });
      if (!res.ok) continue;
      const json = (await res.json()) as { success?: boolean; layout?: OcrLayout };
      if (json.success && json.layout) {
        tables.push(...tablesFromLayout(pageNum, json.layout));
      }
    } catch {
      // Skip failed pages; local tables remain.
    }
  }
  return tables;
}

/** Pure gate used by unit tests — convert only when consent + file present. */
export function canRunOcrTableDetect(consent: boolean, hasFile: boolean): boolean {
  return Boolean(consent && hasFile);
}
