/// <reference lib="webworker" />

import {
  extractPdfPages,
  extractWorkerErrMessage,
  extractWorkerOkMessage,
  type ExtractRequest,
} from './extractPdf';

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
    const ok = extractWorkerOkMessage(id, result.bytes, result.pageCount);
    self.postMessage(ok, [ok.result.bytes]);
  } catch (err) {
    self.postMessage(extractWorkerErrMessage(id, err));
  }
};
