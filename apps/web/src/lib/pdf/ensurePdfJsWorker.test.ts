import { afterEach, describe, expect, it } from 'vitest';
import {
  pdfJsGetDocumentInit,
  resetPdfJsWorkerConfiguredForTests,
  setPdfJsModuleWorkerContextForTests,
} from '@/lib/pdf/ensurePdfJsWorker';

describe('pdfJsGetDocumentInit', () => {
  afterEach(() => {
    resetPdfJsWorkerConfiguredForTests();
  });

  it('sets disableWorker true in forced worker context', () => {
    setPdfJsModuleWorkerContextForTests(true);
    const init = pdfJsGetDocumentInit(new ArrayBuffer(4));
    expect(init.disableWorker).toBe(true);
    expect(init.isEvalSupported).toBe(false);
  });

  it('omits disableWorker in forced main-thread context', () => {
    setPdfJsModuleWorkerContextForTests(false);
    const init = pdfJsGetDocumentInit(new ArrayBuffer(4));
    expect(init.disableWorker).toBeUndefined();
    expect(init.isEvalSupported).toBe(false);
  });
});
