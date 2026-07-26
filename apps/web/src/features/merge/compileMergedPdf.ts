'use client';

import { mergePDFPages } from '@/lib/pdf/pdfHelpers';
import type { FileStore, PDFPageItem } from '@/lib/types';

export type MergeProgressHandler = (current: number, total: number) => void;

export async function compileMergedPdf(
  pages: PDFPageItem[],
  fileStore: FileStore,
  onProgress?: MergeProgressHandler
): Promise<{ bytes: Uint8Array; blob: Blob }> {
  // Prefer dedicated worker when available; fall back to main thread for
  // unsupported images (canvas) or environments without Worker support.
  const canUseWorker =
    typeof Worker !== 'undefined' &&
    pages.every(
      (p) =>
        p.isBlank ||
        !p.isImage ||
        /png|jpe?g/i.test(p.mimeType || '')
    );

  if (canUseWorker) {
    try {
      const bytes = await mergeViaWorker(pages, fileStore, onProgress);
      const blob = new Blob([bytes], { type: 'application/pdf' });
      return { bytes, blob };
    } catch (err) {
      console.warn('[merge] Worker failed, falling back to main thread:', err);
    }
  }

  const bytes = await mergePDFPages(pages, fileStore, onProgress);
  const blob = new Blob([bytes], { type: 'application/pdf' });
  return { bytes, blob };
}

function mergeViaWorker(
  pages: PDFPageItem[],
  fileStore: FileStore,
  onProgress?: MergeProgressHandler
): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const id = Math.random().toString(36).slice(2);
    const worker = new Worker(new URL('./merge.worker.ts', import.meta.url), {
      type: 'module',
    });

    const timer = setTimeout(() => {
      worker.terminate();
      reject(new Error('Merge worker timed out'));
    }, 120_000);

    worker.onmessage = (event: MessageEvent) => {
      const data = event.data;
      if (data?.id !== id) return;
      if (data.type === 'progress') {
        onProgress?.(data.current, data.total);
        return;
      }
      clearTimeout(timer);
      worker.terminate();
      if (data.ok) {
        resolve(new Uint8Array(data.bytes));
      } else {
        reject(new Error(data.error || 'Worker merge failed'));
      }
    };
    worker.onerror = (err) => {
      clearTimeout(timer);
      worker.terminate();
      reject(err);
    };

    const files: Record<string, ArrayBuffer> = {};
    for (const page of pages) {
      if (page.originalFileId && fileStore[page.originalFileId] && !files[page.originalFileId]) {
        files[page.originalFileId] = fileStore[page.originalFileId].slice(0);
      }
    }

    worker.postMessage({
      id,
      pages: pages.map((p) => ({
        originalFileId: p.originalFileId,
        originalPageNumber: p.originalPageNumber,
        rotation: p.rotation,
        isBlank: p.isBlank,
        isImage: p.isImage,
        mimeType: p.mimeType,
      })),
      files,
    });
  });
}

export const MERGE_OUTPUT_NAME = 'merged_document.pdf';
