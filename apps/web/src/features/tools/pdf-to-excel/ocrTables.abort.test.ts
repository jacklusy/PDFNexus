import { afterEach, describe, expect, it, vi } from 'vitest';
import { detectTablesViaOcr } from './ocrTables';

const pdfToImagesMock = vi.fn(async (opts: { signal?: AbortSignal }) => {
  if (opts.signal?.aborted) {
    const err = new Error('Cancelled');
    err.name = 'AbortError';
    throw err;
  }
  return {
    files: [
      { fileName: 'p1.jpg', blob: new Blob(['x'], { type: 'image/jpeg' }) },
      { fileName: 'p2.jpg', blob: new Blob(['y'], { type: 'image/jpeg' }) },
    ],
  };
});

vi.mock('../pdf-to-images/pdfToImages', () => ({
  pdfToImages: (opts: { signal?: AbortSignal }) => pdfToImagesMock(opts),
}));

vi.mock('@/lib/pdf/ensurePdfJsWorker', () => ({
  ensurePdfJsWorker: vi.fn(),
  pdfJsGetDocumentInit: (data: ArrayBuffer) => ({
    data,
    isEvalSupported: false as const,
  }),
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
    vi.clearAllMocks();
  });

  it('does not fetch when aborted before OCR loop', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const ac = new AbortController();
    ac.abort();

    await expect(
      detectTablesViaOcr({
        bytes: new ArrayBuffer(8),
        pages: [1, 2],
        signal: ac.signal,
      })
    ).rejects.toMatchObject({ name: 'AbortError' });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('stops after first fetch when aborted mid-loop', async () => {
    let call = 0;
    const ac = new AbortController();
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      call += 1;
      if (call === 1) {
        queueMicrotask(() => ac.abort());
      }
      if (init?.signal?.aborted) {
        const err = new Error('aborted');
        err.name = 'AbortError';
        throw err;
      }
      return {
        ok: true,
        json: async () => ({ success: true, layout: { elements: [] } }),
      };
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      detectTablesViaOcr({
        bytes: new ArrayBuffer(8),
        pages: [1, 2],
        signal: ac.signal,
      })
    ).rejects.toMatchObject({ name: 'AbortError' });

    expect(fetchMock.mock.calls.length).toBe(1);
  });
});
