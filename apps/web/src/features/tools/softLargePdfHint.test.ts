import { describe, expect, it } from 'vitest';
import { softLargePdfHint, SOFT_LARGE_PDF_BYTES } from './softLargePdfHint';

describe('softLargePdfHint', () => {
  it('returns guidance only at/above the soft threshold', () => {
    expect(softLargePdfHint(SOFT_LARGE_PDF_BYTES - 1)).toBeNull();
    expect(softLargePdfHint(SOFT_LARGE_PDF_BYTES)).toMatch(/~\d+MB/i);
    expect(softLargePdfHint(200 * 1024 * 1024)).toMatch(/very large/i);
  });
});
