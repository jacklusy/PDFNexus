import { describe, expect, it } from 'vitest';
import { OcrService } from '../src/ocr/ocr.service';

describe('OcrService.validateBody', () => {
  const service = new OcrService({
    get: () => undefined,
  } as never);

  it('rejects empty body', () => {
    const result = service.validateBody(null, 1000);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('INVALID_BODY');
  });

  it('accepts jpeg data url', () => {
    const b64 = Buffer.from('hello').toString('base64');
    const result = service.validateBody(
      {
        imageBase64: `data:image/jpeg;base64,${b64}`,
        pageNumber: 2,
      },
      5_500_000,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.mimeType).toBe('image/jpeg');
      expect(result.pageNumber).toBe(2);
      expect(result.cleanBase64).toBe(b64);
    }
  });

  it('rejects oversized payload', () => {
    const result = service.validateBody(
      { imageBase64: 'a'.repeat(100), pageNumber: 1 },
      10,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(413);
  });
});
