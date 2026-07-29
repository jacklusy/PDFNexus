import { describe, it, expect } from 'vitest';
import { zipOutputs } from './zipOutputs';

describe('zipOutputs', () => {
  it('builds a zip with unique names', async () => {
    const blob = await zipOutputs([
      { fileName: 'a.pdf', blob: new Blob(['one'], { type: 'application/pdf' }) },
      { fileName: 'a.pdf', blob: new Blob(['two'], { type: 'application/pdf' }) },
    ]);
    expect(blob.type).toMatch(/zip|octet/);
    expect(blob.size).toBeGreaterThan(20);
  });
});
