/**
 * Export PDF pages as images (JPG / PNG / WebP).
 * Canvas rendering works on the main thread (HTMLCanvasElement) or in a
 * module worker (OffscreenCanvas). ZIP stays on the main thread.
 */

import { ensurePdfJsWorker } from '@/lib/pdf/ensurePdfJsWorker';
import { zipOutputs } from '../zipOutputs';

export type ImageExportFormat = 'image/jpeg' | 'image/png' | 'image/webp';

/** Hard cap for render scale (UI suggests 0.5–4). */
export const PDF_TO_IMAGES_MAX_SCALE = 4;
/** Max canvas edge in CSS pixels to reduce OOM risk. */
export const PDF_TO_IMAGES_MAX_EDGE_PX = 4096;

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

export interface PdfToImagesPageBuffer {
  fileName: string;
  bytes: ArrayBuffer;
  mimeType: ImageExportFormat;
}

export interface PdfToImagesBuffersResult {
  files: PdfToImagesPageBuffer[];
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

export function clampPdfToImagesScale(scale: number): number {
  if (!Number.isFinite(scale) || scale <= 0) return 1;
  return Math.min(PDF_TO_IMAGES_MAX_SCALE, Math.max(0.25, scale));
}

export function clampCanvasEdge(
  width: number,
  height: number,
  maxEdge = PDF_TO_IMAGES_MAX_EDGE_PX
): { width: number; height: number; scaleFactor: number } {
  const w = Math.max(1, Math.floor(width));
  const h = Math.max(1, Math.floor(height));
  const longest = Math.max(w, h);
  if (longest <= maxEdge) {
    return { width: w, height: h, scaleFactor: 1 };
  }
  const scaleFactor = maxEdge / longest;
  return {
    width: Math.max(1, Math.floor(w * scaleFactor)),
    height: Math.max(1, Math.floor(h * scaleFactor)),
    scaleFactor,
  };
}

function pageFileName(
  namePattern: string,
  baseName: string,
  pageNum: number,
  format: ImageExportFormat
): string {
  const name = namePattern
    .replace(/\{n\}/g, String(pageNum))
    .replace(/\{name\}/g, baseName);
  return name.includes('.') ? name : `${name}.${extFor(format)}`;
}

async function canvasToArrayBuffer(
  canvas: HTMLCanvasElement | OffscreenCanvas,
  format: ImageExportFormat,
  quality: number
): Promise<ArrayBuffer> {
  if (typeof OffscreenCanvas !== 'undefined' && canvas instanceof OffscreenCanvas) {
    const blob = await canvas.convertToBlob({
      type: format,
      quality,
    });
    return blob.arrayBuffer();
  }
  const htmlCanvas = canvas as HTMLCanvasElement;
  const blob: Blob = await new Promise((resolve, reject) => {
    htmlCanvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Encode failed'))),
      format,
      quality
    );
  });
  return blob.arrayBuffer();
}

function createRenderCanvas(
  width: number,
  height: number
): HTMLCanvasElement | OffscreenCanvas {
  if (typeof OffscreenCanvas !== 'undefined' && typeof document === 'undefined') {
    return new OffscreenCanvas(width, height);
  }
  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    return canvas;
  }
  if (typeof OffscreenCanvas !== 'undefined') {
    return new OffscreenCanvas(width, height);
  }
  throw new Error('Canvas unavailable');
}

/**
 * Render selected pages to image ArrayBuffers (no ZIP). Safe for workers.
 */
export async function pdfToImageBuffers(
  options: PdfToImagesOptions
): Promise<PdfToImagesBuffersResult> {
  const pdfjs = await import('pdfjs-dist');
  ensurePdfJsWorker(pdfjs);
  const scale = clampPdfToImagesScale(options.scale);
  const task = pdfjs.getDocument({
    data: options.bytes.slice(0),
    isEvalSupported: false,
  });
  const doc = await task.promise;
  const files: PdfToImagesPageBuffer[] = [];

  try {
    for (let i = 0; i < options.pages.length; i++) {
      const pageNum = options.pages[i];
      options.onProgress?.(i, options.pages.length);
      const page = await doc.getPage(pageNum);
      try {
        const baseViewport = page.getViewport({ scale });
        const clamped = clampCanvasEdge(baseViewport.width, baseViewport.height);
        const viewport =
          clamped.scaleFactor === 1
            ? baseViewport
            : page.getViewport({ scale: scale * clamped.scaleFactor });
        const width = clamped.width;
        const height = clamped.height;
        const canvas = createRenderCanvas(width, height);
        const ctx = canvas.getContext('2d') as
          | CanvasRenderingContext2D
          | OffscreenCanvasRenderingContext2D
          | null;
        if (!ctx) throw new Error('Canvas unavailable');
        ctx.fillStyle = options.background;
        ctx.fillRect(0, 0, width, height);
        await page.render({
          canvasContext: ctx as CanvasRenderingContext2D,
          viewport,
          canvas: canvas as HTMLCanvasElement,
        }).promise;
        const bytes = await canvasToArrayBuffer(
          canvas,
          options.format,
          options.quality
        );
        if ('width' in canvas) {
          (canvas as HTMLCanvasElement | OffscreenCanvas).width = 0;
          (canvas as HTMLCanvasElement | OffscreenCanvas).height = 0;
        }
        files.push({
          fileName: pageFileName(
            options.namePattern,
            options.baseName,
            pageNum,
            options.format
          ),
          bytes,
          mimeType: options.format,
        });
      } finally {
        page.cleanup();
      }
    }
    options.onProgress?.(options.pages.length, options.pages.length);
  } finally {
    await doc.destroy();
  }

  return { files };
}

export async function pdfToImages(
  options: PdfToImagesOptions
): Promise<PdfToImagesResult> {
  const buffers = await pdfToImageBuffers(options);
  const files = buffers.files.map((f) => ({
    fileName: f.fileName,
    blob: new Blob([f.bytes], { type: f.mimeType }),
  }));
  let zipBlob: Blob | undefined;
  if (files.length > 1) {
    zipBlob = await zipOutputs(files);
  }
  return { files, zipBlob };
}

export function pdfToImagesWorkerOkMessage(
  id: string,
  files: PdfToImagesPageBuffer[]
) {
  return {
    id,
    ok: true as const,
    result: { files },
  };
}

export function pdfToImagesWorkerErrMessage(id: string, err: unknown) {
  return {
    id,
    ok: false as const,
    error: err instanceof Error ? err.message : String(err),
  };
}
