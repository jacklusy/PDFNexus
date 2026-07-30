import { describe, expect, it } from 'vitest';
import { canUseDriveExport, CONSENT_LABEL } from './driveConsent';

describe('canUseDriveExport', () => {
  it('blocks export without consent', () => {
    expect(canUseDriveExport(false)).toBe(false);
  });

  it('allows export with consent', () => {
    expect(canUseDriveExport(true)).toBe(true);
  });

  it('exposes a clear consent label', () => {
    expect(CONSENT_LABEL.toLowerCase()).toContain('google drive');
  });
});
