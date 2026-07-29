import { PDFDocument } from 'pdf-lib';
import { loadReadablePdf } from '../assertPdfReadable';
import { layoutEmbed, type EmbedLayoutMode } from '../pageGeometry';

export interface ResizePdfOptions {
  bytes: ArrayBuffer;
  /** 1-based page numbers; empty / omitted = all pages. */
  pages?: number[];
  target: { width: number; height: number };
  mode: EmbedLayoutMode;
  marginPt?: number;
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

/**
 * Resize / scale selected pages onto a new paper size via embedPage + drawPage.
 */
export async function resizePdf(options: ResizePdfOptions): Promise<Uint8Array> {
  const { target, mode, marginPt = 0 } = options;
  if (!(target.width > 0) || !(target.height > 0)) {
    throw new Error('Target width and height must be positive.');
  }

  const src = await loadReadablePdf(options.bytes);
  const pageCount = src.getPageCount();
  const selected = new Set(resolvePages(pageCount, options.pages));
  const out = await PDFDocument.create();

  for (let i = 0; i < pageCount; i++) {
    const pageNum = i + 1;
    const srcPage = src.getPage(i);

    if (!selected.has(pageNum)) {
      const [copied] = await out.copyPages(src, [i]);
      out.addPage(copied);
      continue;
    }

    const media = srcPage.getSize();
    const embedded = await out.embedPage(srcPage);
    const layout = layoutEmbed(
      media.width,
      media.height,
      target.width,
      target.height,
      mode,
      marginPt
    );
    const newPage = out.addPage([target.width, target.height]);
    newPage.drawPage(embedded, {
      x: layout.x,
      y: layout.y,
      width: layout.width,
      height: layout.height,
    });
  }

  return out.save();
}
