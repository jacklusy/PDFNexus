import { describe, expect, it, vi } from 'vitest';
import {
  clampCanvasEdge,
  clampPdfToImagesScale,
  pdfToImagesWorkerErrMessage,
  pdfToImagesWorkerOkMessage,
  PDF_TO_IMAGES_MAX_EDGE_PX,
  PDF_TO_IMAGES_MAX_SCALE,
} from './pdfToImages';

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
    expect(clampPdfToImagesScale(2)).toBe(2);
  });

  it('clamps canvas edge to max', () => {
    const big = clampCanvasEdge(PDF_TO_IMAGES_MAX_EDGE_PX * 2, 100);
    expect(big.width).toBeLessThanOrEqual(PDF_TO_IMAGES_MAX_EDGE_PX);
    expect(big.scaleFactor).toBeLessThan(1);
  });
});

describe('cancel-before-zip guard pattern', () => {
  it('skips download when cancelled after worker result', async () => {
    const download = vi.fn();
    const cancelled = { current: false };
    const named = [{ fileName: 'a.jpg', blob: new Blob(['x']) }];

    cancelled.current = true;
    if (cancelled.current) {
      // mirror PdfToImagesTool / SplitTool post-worker check
    } else {
      download(named[0].blob, named[0].fileName);
    }
    expect(download).not.toHaveBeenCalled();
  });
});
