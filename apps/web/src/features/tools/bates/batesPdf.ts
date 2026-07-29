/**
 * Bates numbering — prefix + zero-padded number + suffix, drawn like page numbers.
 */

import { StandardFonts, rgb } from 'pdf-lib';
import { loadReadablePdf } from '../assertPdfReadable';

export type BatesPosition = 'header' | 'footer';
export type BatesAlign = 'left' | 'center' | 'right';

export interface BatesOptions {
  bytes: ArrayBuffer;
  /** 1-based page numbers; empty / omitted = all. */
  pages?: number[];
  start: number;
  /** Zero-pad width (e.g. 6 → 000001). */
  width: number;
  prefix: string;
  suffix: string;
  position: BatesPosition;
  align?: BatesAlign;
  fontSize?: number;
  onProgress?: (current: number, total: number) => void;
}

export function formatBatesNumber(
  n: number,
  width: number,
  prefix: string,
  suffix: string
): string {
  const pad = Math.max(1, Math.floor(width));
  const body = String(Math.max(0, Math.floor(n))).padStart(pad, '0');
  return `${prefix}${body}${suffix}`;
}

export interface BatesResult {
  bytes: Uint8Array;
  /** Next number after the last stamped page (for continuity). */
  nextNumber: number;
}

export async function batesPdf(options: BatesOptions): Promise<BatesResult> {
  const doc = await loadReadablePdf(options.bytes);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const pages = doc.getPages();
  const total = pages.length;
  const fontSize = options.fontSize ?? 10;
  const align = options.align ?? 'right';

  const selected = new Set(
    options.pages && options.pages.length
      ? options.pages
      : Array.from({ length: total }, (_, i) => i + 1)
  );

  let current = options.start;
  let stamped = 0;

  for (let i = 0; i < pages.length; i++) {
    options.onProgress?.(i, total);
    const pageNum = i + 1;
    if (!selected.has(pageNum)) continue;

    const page = pages[i];
    const { width: pw, height: ph } = page.getSize();
    const text = formatBatesNumber(
      current,
      options.width,
      options.prefix,
      options.suffix
    );
    const textWidth = font.widthOfTextAtSize(text, fontSize);
    let x = 40;
    if (align === 'center') x = (pw - textWidth) / 2;
    if (align === 'right') x = pw - textWidth - 40;
    const y = options.position === 'header' ? ph - 36 : 24;

    page.drawText(text, {
      x,
      y,
      size: fontSize,
      font,
      color: rgb(0, 0, 0),
    });

    current += 1;
    stamped += 1;
  }

  options.onProgress?.(total, total);
  if (stamped === 0) {
    throw new Error('No pages selected for Bates numbering.');
  }

  return {
    bytes: await doc.save(),
    nextNumber: current,
  };
}

export const BATES_NEXT_STORAGE_KEY = 'pdfnexus.bates.next';
