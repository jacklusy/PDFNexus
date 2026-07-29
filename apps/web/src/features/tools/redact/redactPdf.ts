/**
 * Permanent redaction: rasterize pages, blank regions, rebuild PDF, verify text gone.
 */

import { PDFDocument } from 'pdf-lib';
import { ensurePdfWorker } from '@/lib/pdf/pdfHelpers';
import { assertPdfReadable } from '../assertPdfReadable';

export interface RedactRegion {
  page: number; // 1-based
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface RedactOptions {
  bytes: ArrayBuffer;
  regions: RedactRegion[];
  scale?: number;
  jpegQuality?: number;
  onProgress?: (current: number, total: number) => void;
}

export interface VerifyMatch {
  page: number;
  phrase: string;
  snippet: string;
}

export const REDACT_WARNING =
  'Redaction permanently destroys content in the marked regions by rebuilding each page as an image. This cannot be undone. Black overlays that leave selectable text are not redaction — this tool removes the underlying text for covered areas.';

function canvasToJpeg(
  canvas: HTMLCanvasElement,
  quality: number
): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      async (blob) => {
        if (!blob) {
          reject(new Error('Failed to encode page image'));
          return;
        }
        resolve(new Uint8Array(await blob.arrayBuffer()));
      },
      'image/jpeg',
      quality
    );
  });
}

/**
 * Rebuild the PDF: render each page, fill black rects for regions, embed JPEG pages.
 * Strips document metadata on the output.
 */
export async function redactPdf(options: RedactOptions): Promise<Uint8Array> {
  await assertPdfReadable(options.bytes);
  if (!options.regions.length) {
    throw new Error('Add at least one redaction region.');
  }

  const scale = options.scale ?? 2;
  const quality = options.jpegQuality ?? 0.92;
  const pdfjs = await import('pdfjs-dist');
  ensurePdfWorker(pdfjs);

  const task = pdfjs.getDocument({
    data: options.bytes.slice(0),
    isEvalSupported: false,
  });
  const src = await task.promise;
  const out = await PDFDocument.create();

  // Intentionally blank metadata
  out.setTitle('');
  out.setAuthor('');
  out.setSubject('');
  out.setKeywords([]);
  out.setCreator('');
  out.setProducer('');

  const byPage = new Map<number, RedactRegion[]>();
  for (const r of options.regions) {
    if (!(r.w > 0) || !(r.h > 0)) continue;
    const list = byPage.get(r.page) || [];
    list.push(r);
    byPage.set(r.page, list);
  }

  try {
    for (let pageNum = 1; pageNum <= src.numPages; pageNum++) {
      options.onProgress?.(pageNum - 1, src.numPages);
      const page = await src.getPage(pageNum);
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.floor(viewport.width));
      canvas.height = Math.max(1, Math.floor(viewport.height));
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas unavailable');

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: ctx, viewport, canvas }).promise;

      const regions = byPage.get(pageNum) || [];
      ctx.fillStyle = '#000000';
      for (const r of regions) {
        const rect = viewport.convertToViewportRectangle([
          r.x,
          r.y,
          r.x + r.w,
          r.y + r.h,
        ]);
        const left = Math.min(rect[0], rect[2]);
        const top = Math.min(rect[1], rect[3]);
        const width = Math.abs(rect[2] - rect[0]);
        const height = Math.abs(rect[3] - rect[1]);
        ctx.fillRect(left, top, width, height);
      }

      const jpeg = await canvasToJpeg(canvas, quality);
      const embedded = await out.embedJpg(jpeg);
      const pdfPage = out.addPage([embedded.width, embedded.height]);
      pdfPage.drawImage(embedded, {
        x: 0,
        y: 0,
        width: embedded.width,
        height: embedded.height,
      });
    }
    options.onProgress?.(src.numPages, src.numPages);
  } finally {
    await src.destroy();
  }

  return out.save({ updateFieldAppearances: false });
}

/**
 * Pure phrase scan used by verifyRedaction (unit-tested without pdf.js DOM).
 * Verification fails (returns matches) if redacted strings remain in text.
 */
export function findPhraseMatchesInText(
  page: number,
  text: string,
  phrases: string[]
): VerifyMatch[] {
  const cleaned = phrases.map((p) => p.trim()).filter(Boolean);
  if (!cleaned.length || !text) return [];
  const matches: VerifyMatch[] = [];
  const lower = text.toLowerCase();
  for (const phrase of cleaned) {
    const idx = lower.indexOf(phrase.toLowerCase());
    if (idx >= 0) {
      const start = Math.max(0, idx - 20);
      const end = Math.min(text.length, idx + phrase.length + 20);
      matches.push({
        page,
        phrase,
        snippet: text.slice(start, end).trim(),
      });
    }
  }
  return matches;
}

/**
 * Search redacted PDF text layer for remaining phrase matches (should be empty
 * after a successful raster rebuild).
 */
export async function verifyRedaction(
  bytes: ArrayBuffer | Uint8Array,
  phrases: string[]
): Promise<VerifyMatch[]> {
  const cleaned = phrases.map((p) => p.trim()).filter(Boolean);
  if (!cleaned.length) return [];

  const pdfjs = await import('pdfjs-dist');
  ensurePdfWorker(pdfjs);
  const data =
    bytes instanceof Uint8Array
      ? bytes.slice(0)
      : new Uint8Array(bytes.slice(0));
  const task = pdfjs.getDocument({ data, isEvalSupported: false });
  const doc = await task.promise;
  const matches: VerifyMatch[] = [];

  try {
    for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
      const page = await doc.getPage(pageNum);
      const content = await page.getTextContent();
      const text = content.items
        .map((it) => ('str' in it ? String(it.str) : ''))
        .join(' ');
      matches.push(...findPhraseMatchesInText(pageNum, text, cleaned));
    }
  } finally {
    await doc.destroy();
  }

  return matches;
}
