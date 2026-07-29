import { describe, expect, it } from 'vitest';
import { canRunOcrTableDetect } from './ocrTables';

describe('canRunOcrTableDetect', () => {
  it('requires consent and a file', () => {
    expect(canRunOcrTableDetect(false, true)).toBe(false);
    expect(canRunOcrTableDetect(true, false)).toBe(false);
    expect(canRunOcrTableDetect(true, true)).toBe(true);
  });
});
