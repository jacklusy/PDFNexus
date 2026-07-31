/**
 * Text-layer glyph spans → highlight quads (PDF user space, origin bottom-left).
 */

import { ensurePdfJsWorker, pdfJsGetDocumentInit } from '@/lib/pdf/ensurePdfJsWorker';
import type { HighlightQuad } from '../overlays/types';

export interface TextSpan {
  str: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export type PdfTextItemLike = {
  str?: string;
  transform?: number[];
  width?: number;
  height?: number;
};

export function spansFromTextItems(items: PdfTextItemLike[]): TextSpan[] {
  const out: TextSpan[] = [];
  for (const item of items) {
    const str = (item.str || '').replace(/\s+/g, ' ').trim();
    if (!str || !item.transform || item.transform.length < 6) continue;
    const x = item.transform[4];
    const y = item.transform[5];
    const height = Math.abs(item.transform[3] || item.height || 10) || 10;
    const width = item.width ?? str.length * (height * 0.5);
    out.push({ str, x, y, width, height });
  }
  return out;
}

export function rectsIntersect(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number }
): boolean {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

/** Spans whose boxes intersect the selection rectangle. */
export function quadsIntersectingRect(
  spans: TextSpan[],
  selection: { x: number; y: number; width: number; height: number }
): HighlightQuad[] {
  const quads: HighlightQuad[] = [];
  for (const s of spans) {
    const box = { x: s.x, y: s.y, width: s.width, height: s.height };
    if (rectsIntersect(box, selection)) {
      quads.push(box);
    }
  }
  return quads;
}

export function unionQuadBounds(quads: HighlightQuad[]): HighlightQuad | null {
  if (!quads.length) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const q of quads) {
    minX = Math.min(minX, q.x);
    minY = Math.min(minY, q.y);
    maxX = Math.max(maxX, q.x + q.width);
    maxY = Math.max(maxY, q.y + q.height);
  }
  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

/** Load one page's text spans via pdf.js. */
export async function loadPageTextSpans(
  bytes: ArrayBuffer,
  pageNumber1Based: number
): Promise<TextSpan[]> {
  const pdfjs = await import('pdfjs-dist');
  ensurePdfJsWorker(pdfjs);
  const task = pdfjs.getDocument(pdfJsGetDocumentInit(bytes));
  const doc = await task.promise;
  try {
    if (pageNumber1Based < 1 || pageNumber1Based > doc.numPages) {
      throw new Error(`Page ${pageNumber1Based} out of range (1–${doc.numPages}).`);
    }
    const page = await doc.getPage(pageNumber1Based);
    const content = await page.getTextContent();
    return spansFromTextItems(content.items as PdfTextItemLike[]);
  } finally {
    await doc.destroy();
  }
}
