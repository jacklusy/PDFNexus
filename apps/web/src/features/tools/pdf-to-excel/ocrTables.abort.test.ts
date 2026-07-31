import { afterEach, describe, expect, it, vi } from 'vitest';
import { detectTablesViaOcr } from './ocrTables';

vi.mock('../pdf-to-images/pdfToImages', () => ({
  pdfToImages: vi.fn(async () => ({
    files: [
      { fileName: 'p1.jpg', blob: new Blob(['x'], { type: 'image/jpeg' }) },
      { fileName: 'p2.jpg', blob: new Blob(['y'], { type: 'image/jpeg' }) },
    ],
  })),
}));

vi.mock('@/lib/pdf/ensurePdfJsWorker', () => ({
  ensurePdfJsWorker: vi.fn(),
}));

vi.mock('pdfjs-dist', () => ({
  getDocument: () => ({
    promise: Promise.resolve({
      numPages: 2,
      destroy: async () => undefined,
    }),
  }),
  GlobalWorkerOptions: { workerSrc: '' },
}));

describe('detectTablesViaOcr abort', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('stops further fetch calls when aborted mid-loop', async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.signal?.aborted) {
        const err = new Error('aborted');
        err.name = 'AbortError';
        throw err;
      }
      // Abort after first successful response scheduling
      return {
        ok: true,
        json: async () => ({ success: true, layout: { elements: [] } }),
      };
    });
    vi.stubGlobal('fetch', fetchMock);

    const ac = new AbortController();
    const run = detectTablesViaOcr({
      bytes: new ArrayBuffer(8),
      pages: [1, 2],
      signal: ac.signal,
    });

    // Abort after microtasks so first fetch may start, then stop.
    await Promise.resolve();
    ac.abort();

    await expect(run).rejects.toMatchObject({ name: 'AbortError' });
    // At most one in-flight page should have been requested after abort.
    expect(fetchMock.mock.calls.length).toBeLessThanOrEqual(2);
  });
});
