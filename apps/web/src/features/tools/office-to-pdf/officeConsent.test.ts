import { describe, expect, it } from 'vitest';
import {
  canUploadOfficeForConversion,
  OFFICE_MAX_BYTES,
} from './officeConsent';

describe('canUploadOfficeForConversion', () => {
  it('blocks upload without consent', () => {
    expect(
      canUploadOfficeForConversion({ consent: false, hasFile: true, fileSize: 100 })
    ).toBe(false);
  });

  it('blocks upload without a file', () => {
    expect(
      canUploadOfficeForConversion({ consent: true, hasFile: false })
    ).toBe(false);
  });

  it('blocks oversized files', () => {
    expect(
      canUploadOfficeForConversion({
        consent: true,
        hasFile: true,
        fileSize: OFFICE_MAX_BYTES + 1,
      })
    ).toBe(false);
  });

  it('allows consented in-limit files', () => {
    expect(
      canUploadOfficeForConversion({
        consent: true,
        hasFile: true,
        fileSize: 1024,
      })
    ).toBe(true);
  });
});
