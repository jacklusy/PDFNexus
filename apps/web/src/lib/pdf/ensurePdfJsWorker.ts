/**
 * Configure pdf.js workerSrc without pulling pdf-lib / DOM thumbnail helpers.
 * Main thread: use dedicated pdf.worker.min.mjs.
 * Module workers: callers should pass disableWorker: true via {@link pdfJsGetDocumentInit}.
 */

type PdfjsGlobalWorkerHost = {
  GlobalWorkerOptions: { workerSrc: string };
};

let workerConfigured = false;
/** Test-only override for {@link isPdfJsModuleWorkerContext}. */
let workerContextOverride: boolean | null = null;

/** True when running inside a Worker (no `window`). */
export function isPdfJsModuleWorkerContext(): boolean {
  if (workerContextOverride !== null) return workerContextOverride;
  return typeof window === 'undefined' && typeof self !== 'undefined';
}

export function ensurePdfJsWorker(lib?: PdfjsGlobalWorkerHost | null): void {
  if (workerConfigured) return;
  try {
    if (!lib) return;
    // Still set workerSrc for main-thread tools; nested workers use disableWorker instead.
    lib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
    workerConfigured = true;
  } catch (e) {
    console.error('Failed to configure PDFJS worker:', e);
  }
}

/**
 * Shared getDocument init. Inside module workers, disable nested pdf.js workers.
 */
export function pdfJsGetDocumentInit(data: ArrayBuffer): {
  data: ArrayBuffer;
  isEvalSupported: false;
  disableWorker?: true;
} {
  const sliced = data.slice(0);
  if (isPdfJsModuleWorkerContext()) {
    return {
      data: sliced,
      isEvalSupported: false,
      disableWorker: true,
    };
  }
  return {
    data: sliced,
    isEvalSupported: false,
  };
}

/** Test helper — reset module state between tests. */
export function resetPdfJsWorkerConfiguredForTests(): void {
  workerConfigured = false;
  workerContextOverride = null;
}

/** Test helper — force worker vs main-thread detection. */
export function setPdfJsModuleWorkerContextForTests(
  value: boolean | null
): void {
  workerContextOverride = value;
}
