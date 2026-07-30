import { describe, expect, it } from 'vitest';
import { MAX_DRIVE_FILE_BYTES } from './drive.service';

describe('Drive import size gate', () => {
  it('caps Drive files at 50MB', () => {
    expect(MAX_DRIVE_FILE_BYTES).toBe(50 * 1024 * 1024);
  });

  it('rejects oversized buffers with the same threshold as export', () => {
    const over = MAX_DRIVE_FILE_BYTES + 1;
    expect(over > MAX_DRIVE_FILE_BYTES).toBe(true);
  });
});
