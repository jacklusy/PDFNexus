/// <reference lib="webworker" />

/**
 * Structural PDF compress (metadata strip + object streams) off the main thread.
 * JPEG raster re-encode uses compress-raster.worker.ts.
 */

import { compressPdf, type CompressSettings } from './compressPdf';

export type CompressWorkerRequest = {
  id: string;
  bytes: ArrayBuffer;
  settings: CompressSettings;
};

self.onmessage = async (event: MessageEvent<CompressWorkerRequest>) => {
  const { id, bytes, settings } = event.data;
  try {
    const result = await compressPdf({
      bytes,
      settings,
      rasterizePages: false,
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
  } catch (err) {
    self.postMessage({
      id,
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    });
  }
};
