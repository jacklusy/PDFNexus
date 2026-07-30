import { describe, expect, it } from 'vitest';
import {
  isWithinCloudSizeLimit,
  MAX_CLOUD_FILE_BYTES,
} from './cloudLimits';

describe('cloudLimits', () => {
  it('caps at 50MB', () => {
    expect(MAX_CLOUD_FILE_BYTES).toBe(50 * 1024 * 1024);
    expect(isWithinCloudSizeLimit(MAX_CLOUD_FILE_BYTES)).toBe(true);
    expect(isWithinCloudSizeLimit(MAX_CLOUD_FILE_BYTES + 1)).toBe(false);
  });
});
