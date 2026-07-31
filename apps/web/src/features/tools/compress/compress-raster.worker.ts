/// <reference lib="webworker" />

/**
 * JPEG raster compress off the main thread (OffscreenCanvas + pdf.js + pdf-lib).
 * Structural (non-raster) compress stays on compress.worker.ts.
 */

import { ensurePdfJsWorker } from '@/lib/pdf/ensurePdfJsWorker';
import {
  compressPdf,
  type CompressSettings,
} from './compressPdf';

export type CompressRasterWorkerRequest = {
  id: string;
  bytes: ArrayBuffer;
  settings: CompressSettings;
};

async function renderPageJpegOffscreen(
  doc: import('pdfjs-dist').PDFDocumentProxy,
  pageIndex: number,
  maxPx: number,
  quality: number
): Promise<{ jpeg: Uint8Array; width: number; height: number }> {
  const page = await doc.getPage(pageIndex + 1);
  try {
    const base = page.getViewport({ scale: 1 });
    const scale = Math.min(1, maxPx / Math.max(base.width, base.height));
    const viewport = page.getViewport({ scale: Math.max(scale, 0.2) });
    const width = Math.max(1, Math.floor(viewport.width));
    const height = Math.max(1, Math.floor(viewport.height));
    if (typeof OffscreenCanvas === 'undefined') {
      throw new Error('OffscreenCanvas unavailable in worker');
    }
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas unavailable');
    await page.render({
      canvasContext: ctx as unknown as CanvasRenderingContext2D,
      viewport,
      canvas: canvas as unknown as HTMLCanvasElement,
    }).promise;
    const blob = await canvas.convertToBlob({
      type: 'image/jpeg',
      quality,
    });
    canvas.width = 0;
    canvas.height = 0;
    const buf = new Uint8Array(await blob.arrayBuffer());
    return { jpeg: buf, width, height };
  } finally {
    page.cleanup();
  }
}

self.onmessage = async (event: MessageEvent<CompressRasterWorkerRequest>) => {
  const { id, bytes, settings } = event.data;
  try {
    const pdfjs = await import('pdfjs-dist');
    ensurePdfJsWorker(pdfjs);
    const task = pdfjs.getDocument({
      data: bytes.slice(0),
      isEvalSupported: false,
    });
    const pdfjsDoc = await task.promise;
    try {
      const result = await compressPdf({
        bytes,
        settings,
        rasterizePages: true,
        renderPage: (pageIndex, maxPx, quality) =>
          renderPageJpegOffscreen(pdfjsDoc, pageIndex, maxPx, quality),
        onProgress: (current, total, message) => {
          self.postMessage({ id, type: 'progress', current, total, message });
        },
      });
      const out = result.bytes.buffer.slice(
        result.bytes.byteOffset,
        result.bytes.byteOffset + result.bytes.byteLength
      );
      self.postMessage(
        {
          id,
          ok: true,
          result: {
            bytes: out,
            originalSize: result.originalSize,
            finalSize: result.finalSize,
            reductionPercent: result.reductionPercent,
            elapsedMs: result.elapsedMs,
            settings: result.settings,
            imagesReencoded: result.imagesReencoded,
          },
        },
        [out]
      );
    } finally {
      await pdfjsDoc.destroy();
    }
  } catch (err) {
    self.postMessage({
      id,
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    });
  }
};
