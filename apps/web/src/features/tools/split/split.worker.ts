/// <reference lib="webworker" />

import { splitPdf, type SplitRequest } from './splitPdf';

export type SplitWorkerRequest = {
  id: string;
  request: SplitRequest;
};

self.onmessage = async (event: MessageEvent<SplitWorkerRequest>) => {
  const { id, request } = event.data;
  try {
    const result = await splitPdf(request, (current, total) => {
      self.postMessage({ id, type: 'progress', current, total });
    });
    // Transfer ArrayBuffers
    const parts = result.parts.map((p) => ({
      ...p,
      bytes: p.bytes.buffer.slice(
        p.bytes.byteOffset,
        p.bytes.byteOffset + p.bytes.byteLength
      ),
    }));
    const transfer = parts.map((p) => p.bytes);
    self.postMessage({ id, ok: true, result: { parts } }, transfer);
  } catch (err) {
    self.postMessage({
      id,
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    });
  }
};
