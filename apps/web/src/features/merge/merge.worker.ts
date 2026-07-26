/**
 * Merge worker — runs pdf-lib merge off the main thread when Workers are available.
 * Falls back to main-thread mergePDFPages via compileMergedPdf.
 */

/// <reference lib="webworker" />

import { PDFDocument, degrees } from 'pdf-lib';

export type MergeWorkerRequest = {
  id: string;
  pages: Array<{
    originalFileId: string | null;
    originalPageNumber: number;
    rotation: number;
    isBlank: boolean;
    isImage?: boolean;
    mimeType?: string;
  }>;
  /** Transferable file buffers keyed by fileId (base64 for structured clone safety) */
  files: Record<string, ArrayBuffer>;
};

export type MergeWorkerResponse =
  | { id: string; type: 'progress'; current: number; total: number }
  | { id: string; ok: true; bytes: ArrayBuffer }
  | { id: string; ok: false; error: string };

async function mergeInWorker(
  pages: MergeWorkerRequest['pages'],
  fileStore: Record<string, ArrayBuffer>,
  onProgress?: (current: number, total: number) => void
): Promise<Uint8Array> {
  const mergedPdf = await PDFDocument.create();
  const loadedDocs: Record<string, PDFDocument> = {};

  for (let i = 0; i < pages.length; i++) {
    const pageItem = pages[i];
    onProgress?.(i, pages.length);
    if (pageItem.isBlank) {
      mergedPdf.addPage([595.28, 841.89]);
      continue;
    }
    if (!pageItem.originalFileId) continue;

    if (pageItem.isImage) {
      const rawBuffer = fileStore[pageItem.originalFileId];
      if (!rawBuffer) throw new Error('Missing image buffer');
      const type = (pageItem.mimeType || '').toLowerCase();
      let embeddedImage;
      if (type.includes('png')) {
        embeddedImage = await mergedPdf.embedPng(rawBuffer.slice(0));
      } else if (type.includes('jpg') || type.includes('jpeg')) {
        embeddedImage = await mergedPdf.embedJpg(rawBuffer.slice(0));
      } else {
        // Worker cannot use canvas fallback — require PNG/JPEG for worker path
        throw new Error('UNSUPPORTED_IMAGE_IN_WORKER');
      }
      const imagePage = mergedPdf.addPage([embeddedImage.width, embeddedImage.height]);
      imagePage.drawImage(embeddedImage, {
        x: 0,
        y: 0,
        width: embeddedImage.width,
        height: embeddedImage.height,
      });
      if (pageItem.rotation !== 0) {
        imagePage.setRotation(degrees((pageItem.rotation + 360) % 360));
      }
      continue;
    }

    if (!loadedDocs[pageItem.originalFileId]) {
      const rawBuffer = fileStore[pageItem.originalFileId];
      if (!rawBuffer) throw new Error('Missing PDF buffer');
      loadedDocs[pageItem.originalFileId] = await PDFDocument.load(rawBuffer.slice(0));
    }
    const srcDoc = loadedDocs[pageItem.originalFileId];
    const [copiedPage] = await mergedPdf.copyPages(srcDoc, [
      pageItem.originalPageNumber - 1,
    ]);
    const currentRot = copiedPage.getRotation().angle || 0;
    copiedPage.setRotation(degrees((currentRot + pageItem.rotation) % 360));
    mergedPdf.addPage(copiedPage);
  }

  onProgress?.(pages.length, pages.length);
  if (mergedPdf.getPageCount() !== pages.length) {
    throw new Error('Page count mismatch');
  }
  return mergedPdf.save();
}

self.onmessage = async (event: MessageEvent<MergeWorkerRequest>) => {
  const { id, pages, files } = event.data;
  try {
    const bytes = await mergeInWorker(pages, files, (current, total) => {
      const progress: MergeWorkerResponse = {
        id,
        type: 'progress',
        current,
        total,
      };
      (self as DedicatedWorkerGlobalScope).postMessage(progress);
    });
    const copy = new Uint8Array(bytes.byteLength);
    copy.set(bytes);
    const buffer = copy.buffer;
    const response: MergeWorkerResponse = { id, ok: true, bytes: buffer };
    (self as DedicatedWorkerGlobalScope).postMessage(response, [buffer]);
  } catch (err) {
    const response: MergeWorkerResponse = {
      id,
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
    (self as DedicatedWorkerGlobalScope).postMessage(response);
  }
};
