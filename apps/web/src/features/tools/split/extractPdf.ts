import { PDFDocument } from 'pdf-lib';
import { loadReadablePdf } from '../assertPdfReadable';
import { parsePageRanges } from '../parsePageRanges';

export interface ExtractRequest {
  bytes: ArrayBuffer;
  /** 1-based page numbers in desired output order */
  pages?: number[];
  rangeText?: string;
}

export interface ExtractResult {
  bytes: Uint8Array;
  pageCount: number;
}

export function resolveExtractPages(
  pageCount: number,
  request: Omit<ExtractRequest, 'bytes'>
): number[] {
  if (request.pages?.length) {
    for (const p of request.pages) {
      if (!Number.isInteger(p) || p < 1 || p > pageCount) {
        throw new Error(`Page ${p} is outside 1–${pageCount}.`);
      }
    }
    return request.pages;
  }
  return parsePageRanges(request.rangeText || '', {
    pageCount,
    rejectOverlaps: false,
  });
}

export async function extractPdfPages(
  request: ExtractRequest,
  onProgress?: (current: number, total: number) => void
): Promise<ExtractResult> {
  const src = await loadReadablePdf(request.bytes);
  const pageCount = src.getPageCount();
  const pages = resolveExtractPages(pageCount, request);
  if (pages.length === 0) throw new Error('Select at least one page.');

  const out = await PDFDocument.create();
  for (let i = 0; i < pages.length; i++) {
    onProgress?.(i, pages.length);
    const [copied] = await out.copyPages(src, [pages[i] - 1]);
    out.addPage(copied);
  }
  onProgress?.(pages.length, pages.length);
  const bytes = await out.save();
  return { bytes, pageCount: pages.length };
}
