/**
 * Configure pdf.js workerSrc without pulling pdf-lib / DOM thumbnail helpers.
 * Safe in window and module-worker contexts.
 */

type PdfjsGlobalWorkerHost = {
  GlobalWorkerOptions: { workerSrc: string };
};

let workerConfigured = false;

export function ensurePdfJsWorker(lib?: PdfjsGlobalWorkerHost | null): void {
  if (workerConfigured) return;
  try {
    if (!lib) return;
    lib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
    workerConfigured = true;
  } catch (e) {
    console.error('Failed to configure PDFJS worker:', e);
  }
}

/** Test helper — reset module state between tests. */
export function resetPdfJsWorkerConfiguredForTests(): void {
  workerConfigured = false;
}
