import { describe, expect, it } from 'vitest';
import {
  isPdfJsModuleWorkerContext,
  pdfJsGetDocumentInit,
  resetPdfJsWorkerConfiguredForTests,
} from '@/lib/pdf/ensurePdfJsWorker';

describe('pdfJsGetDocumentInit', () => {
  it('disables nested worker when in worker-like context', () => {
    resetPdfJsWorkerConfiguredForTests();
    // In vitest/node there is typically no window → treat as worker context.
    const init = pdfJsGetDocumentInit(new ArrayBuffer(4));
    if (isPdfJsModuleWorkerContext()) {
      expect(init.disableWorker).toBe(true);
    } else {
      expect(init.disableWorker).toBeUndefined();
    }
    expect(init.isEvalSupported).toBe(false);
  });
});
