/// <reference lib="webworker" />

import { extractPdfPages, type ExtractRequest } from './extractPdf';

export type ExtractWorkerRequest = {
  id: string;
  request: ExtractRequest;
};

self.onmessage = async (event: MessageEvent<ExtractWorkerRequest>) => {
  const { id, request } = event.data;
  try {
    const result = await extractPdfPages(request, (current, total) => {
      self.postMessage({ id, type: 'progress', current, total });
    });
    const buffer = result.bytes.buffer.slice(
      result.bytes.byteOffset,
      result.bytes.byteOffset + result.bytes.byteLength
    );
    self.postMessage(
      { id, ok: true, result: { bytes: buffer, pageCount: result.pageCount } },
      [buffer]
    );
  } catch (err) {
    self.postMessage({
      id,
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    });
  }
};
