/**
 * Export PDF pages as images (JPG / PNG / WebP) + optional ZIP.
 */

import { ensurePdfWorker } from '@/lib/pdf/pdfHelpers';
import { zipOutputs } from '../zipOutputs';

export type ImageExportFormat = 'image/jpeg' | 'image/png' | 'image/webp';

export interface PdfToImagesOptions {
  bytes: ArrayBuffer;
  pages: number[]; // 1-based
  format: ImageExportFormat;
  scale: number;
  quality: number; // 0–1 for jpeg/webp
  background: string;
  namePattern: string; // use {n} for page number
  baseName: string;
  onProgress?: (current: number, total: number) => void;
}

export interface PdfToImagesResult {
  files: Array<{ fileName: string; blob: Blob }>;
  zipBlob?: Blob;
}

function extFor(format: ImageExportFormat): string {
  if (format === 'image/png') return 'png';
  if (format === 'image/webp') return 'webp';
  return 'jpg';
}

export async function pdfToImages(
  options: PdfToImagesOptions
): Promise<PdfToImagesResult> {
  const pdfjs = await import('pdfjs-dist');
  ensurePdfWorker(pdfjs);
  const task = pdfjs.getDocument({
    data: options.bytes.slice(0),
    isEvalSupported: false,
  });
  const doc = await task.promise;
  const files: Array<{ fileName: string; blob: Blob }> = [];

  try {
    for (let i = 0; i < options.pages.length; i++) {
      const pageNum = options.pages[i];
      options.onProgress?.(i, options.pages.length);
      const page = await doc.getPage(pageNum);
      const viewport = page.getViewport({ scale: options.scale });
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.floor(viewport.width));
      canvas.height = Math.max(1, Math.floor(viewport.height));
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas unavailable');
      ctx.fillStyle = options.background;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: ctx, viewport, canvas }).promise;
      const blob: Blob = await new Promise((resolve, reject) => {
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error('Encode failed'))),
          options.format,
          options.quality
        );
      });
      // Release canvas backing store before next page
      canvas.width = 0;
      canvas.height = 0;
      const name = options.namePattern
        .replace(/\{n\}/g, String(pageNum))
        .replace(/\{name\}/g, options.baseName);
      const fileName = name.includes('.')
        ? name
        : `${name}.${extFor(options.format)}`;
      files.push({ fileName, blob });
    }
    options.onProgress?.(options.pages.length, options.pages.length);
  } finally {
    await doc.destroy();
  }

  let zipBlob: Blob | undefined;
  if (files.length > 1) {
    zipBlob = await zipOutputs(files);
  }
  return { files, zipBlob };
}
