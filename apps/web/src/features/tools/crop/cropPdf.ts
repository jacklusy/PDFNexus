import { PDFDocument } from 'pdf-lib';
import { loadReadablePdf } from '../assertPdfReadable';
import {
  marginsToCropBox,
  type CropRect,
  type MarginsPt,
  uniformMargins,
} from '../pageGeometry';

export interface CropPdfOptions {
  bytes: ArrayBuffer;
  /** 1-based page numbers; empty / omitted = all pages. */
  pages?: number[];
  /** Default margins applied to selected pages (unless overridden by perPage). */
  margins?: MarginsPt;
  /** Per-page margins keyed by 1-based page number. */
  perPage?: Record<number, MarginsPt>;
  /**
   * When true, restore full-page geometry (zero margins) for selected pages.
   * Equivalent to hard-cropping with full MediaBox.
   */
  restore?: boolean;
}

function resolvePages(pageCount: number, pages?: number[]): number[] {
  if (!pages || pages.length === 0) {
    return Array.from({ length: pageCount }, (_, i) => i + 1);
  }
  for (const p of pages) {
    if (!Number.isInteger(p) || p < 1 || p > pageCount) {
      throw new Error(`Page ${p} is outside 1–${pageCount}.`);
    }
  }
  return pages;
}

function marginsForPage(
  pageNum: number,
  options: CropPdfOptions
): MarginsPt {
  if (options.restore) return uniformMargins(0);
  if (options.perPage?.[pageNum]) return options.perPage[pageNum];
  return options.margins ?? uniformMargins(0);
}

/**
 * Hard-crop pages by embedding each page into a new page sized to the crop box,
 * so content outside the crop is removed (not just hidden via CropBox).
 */
export async function cropPdf(options: CropPdfOptions): Promise<Uint8Array> {
  const src = await loadReadablePdf(options.bytes);
  const pageCount = src.getPageCount();
  const selected = new Set(resolvePages(pageCount, options.pages));
  const out = await PDFDocument.create();

  for (let i = 0; i < pageCount; i++) {
    const pageNum = i + 1;
    const srcPage = src.getPage(i);
    const media = srcPage.getMediaBox();
    const mediaW = media.width;
    const mediaH = media.height;

    if (!selected.has(pageNum)) {
      const [copied] = await out.copyPages(src, [i]);
      out.addPage(copied);
      continue;
    }

    const margins = marginsForPage(pageNum, options);
    // Crop rect relative to media box; convert to absolute page coords
    const relative = marginsToCropBox(mediaW, mediaH, margins);
    const crop: CropRect = {
      x: media.x + relative.x,
      y: media.y + relative.y,
      w: relative.w,
      h: relative.h,
    };

    // Hard crop: embed only the crop region into a page sized to the crop box
    const embedded = await out.embedPage(srcPage, {
      left: crop.x,
      bottom: crop.y,
      right: crop.x + crop.w,
      top: crop.y + crop.h,
    });

    const newPage = out.addPage([crop.w, crop.h]);
    newPage.setCropBox(0, 0, crop.w, crop.h);
    newPage.drawPage(embedded, {
      x: 0,
      y: 0,
      width: crop.w,
      height: crop.h,
    });
  }

  return out.save();
}
