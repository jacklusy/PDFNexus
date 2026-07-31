/// <reference lib="webworker" />

/**
 * PDF→images render off the main thread (OffscreenCanvas + pdf.js).
 * ZIP/download stays on the main thread after transferable buffers return.
 */

import {
  pdfToImageBuffers,
  pdfToImagesWorkerErrMessage,
  pdfToImagesWorkerOkMessage,
  type ImageExportFormat,
} from './pdfToImages';

export type PdfToImagesWorkerRequest = {
  id: string;
  bytes: ArrayBuffer;
  pages: number[];
  format: ImageExportFormat;
  scale: number;
  quality: number;
  background: string;
  namePattern: string;
  baseName: string;
};

self.onmessage = async (event: MessageEvent<PdfToImagesWorkerRequest>) => {
  const { id, bytes, pages, format, scale, quality, background, namePattern, baseName } =
    event.data;
  try {
    const result = await pdfToImageBuffers({
      bytes,
      pages,
      format,
      scale,
      quality,
      background,
      namePattern,
      baseName,
      onProgress: (current, total) => {
        self.postMessage({ id, type: 'progress', current, total });
      },
    });
    const ok = pdfToImagesWorkerOkMessage(id, result.files);
    const transfer = result.files.map((f) => f.bytes);
    self.postMessage(ok, transfer);
  } catch (err) {
    self.postMessage(pdfToImagesWorkerErrMessage(id, err));
  }
};
