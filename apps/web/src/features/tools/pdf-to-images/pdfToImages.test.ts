import { describe, expect, it } from 'vitest';
import {
  pdfToImagesWorkerErrMessage,
  pdfToImagesWorkerOkMessage,
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
