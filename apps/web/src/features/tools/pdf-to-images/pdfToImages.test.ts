import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clampCanvasEdge,
  clampPdfToImagesScale,
  pdfToImageBuffers,
  pdfToImagesWorkerErrMessage,
  pdfToImagesWorkerOkMessage,
  PDF_TO_IMAGES_MAX_EDGE_PX,
  PDF_TO_IMAGES_MAX_SCALE,
  PDF_TO_IMAGES_MIN_SCALE,
} from './pdfToImages';

const getPage = vi.fn();

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
      getPage: (n: number) => getPage(n),
      destroy: async () => undefined,
    }),
  }),
  GlobalWorkerOptions: { workerSrc: '' },
}));

class FakeOffscreenCanvas {
  width: number;
  height: number;
  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
  }
  getContext() {
    return {
      fillStyle: '',
      fillRect: () => undefined,
    };
  }
  convertToBlob() {
    return Promise.resolve(new Blob(['img']));
  }
}

describe('pdf-to-images worker contract', () => {
  it('builds ok / error messages', () => {
    const bytes = new ArrayBuffer(4);
    const ok = pdfToImagesWorkerOkMessage('img', [
      { fileName: 'p1.jpg', bytes, mimeType: 'image/jpeg' },
    ]);
    expect(ok.ok).toBe(true);
    expect(ok.result.files).toHaveLength(1);
    expect(ok.result.files[0].fileName).toBe('p1.jpg');

    const err = pdfToImagesWorkerErrMessage('img', new Error('render failed'));
    expect(err.ok).toBe(false);
    expect(err.error).toBe('render failed');
  });
});

describe('pdf-to-images clamps', () => {
  it('clamps scale to a safe range', () => {
    expect(clampPdfToImagesScale(0)).toBe(1);
    expect(clampPdfToImagesScale(99)).toBe(PDF_TO_IMAGES_MAX_SCALE);
    expect(clampPdfToImagesScale(PDF_TO_IMAGES_MIN_SCALE / 2)).toBe(
      PDF_TO_IMAGES_MIN_SCALE
    );
    expect(clampPdfToImagesScale(2)).toBe(2);
  });

  it('clamps canvas edge to max', () => {
    const big = clampCanvasEdge(PDF_TO_IMAGES_MAX_EDGE_PX * 2, 100);
    expect(big.width).toBeLessThanOrEqual(PDF_TO_IMAGES_MAX_EDGE_PX);
    expect(big.scaleFactor).toBeLessThan(1);
  });
});

describe('pdfToImageBuffers AbortSignal', () => {
  beforeEach(() => {
    getPage.mockReset();
    getPage.mockImplementation(async () => ({
      getViewport: () => ({ width: 8, height: 8 }),
      render: () => ({ promise: Promise.resolve() }),
      cleanup: () => undefined,
    }));
    // Prefer OffscreenCanvas path in createRenderCanvas
    vi.stubGlobal('OffscreenCanvas', FakeOffscreenCanvas);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('stops before further pages when aborted between pages', async () => {
    const ac = new AbortController();
    await expect(
      pdfToImageBuffers({
        bytes: new ArrayBuffer(8),
        pages: [1, 2, 3],
        format: 'image/jpeg',
        scale: 1,
        quality: 0.8,
        background: '#fff',
        namePattern: '{n}',
        baseName: 'doc',
        signal: ac.signal,
        onProgress: (current) => {
          if (current === 0) ac.abort();
        },
      })
    ).rejects.toMatchObject({ name: 'AbortError' });

    // First page started (progress 0), abort before page 2
    expect(getPage).toHaveBeenCalledTimes(1);
  });

  it('rejects immediately when already aborted', async () => {
    const ac = new AbortController();
    ac.abort();
    await expect(
      pdfToImageBuffers({
        bytes: new ArrayBuffer(8),
        pages: [1, 2],
        format: 'image/jpeg',
        scale: 1,
        quality: 0.8,
        background: '#fff',
        namePattern: '{n}',
        baseName: 'doc',
        signal: ac.signal,
      })
    ).rejects.toMatchObject({ name: 'AbortError' });
    expect(getPage).not.toHaveBeenCalled();
  });
});
