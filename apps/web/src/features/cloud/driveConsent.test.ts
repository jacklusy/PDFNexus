import { describe, expect, it } from 'vitest';
import {
  canUseCloudExport,
  canUseDriveExport,
  consentLabelFor,
  CONSENT_LABEL,
} from './driveConsent';

describe('cloud consent gates', () => {
  it('blocks export without consent', () => {
    expect(canUseCloudExport(false)).toBe(false);
    expect(canUseDriveExport(false)).toBe(false);
  });

  it('allows export with consent', () => {
    expect(canUseCloudExport(true)).toBe(true);
  });

  it('labels each provider clearly', () => {
    expect(consentLabelFor('Dropbox').toLowerCase()).toContain('dropbox');
    expect(consentLabelFor('OneDrive').toLowerCase()).toContain('onedrive');
    expect(CONSENT_LABEL.toLowerCase()).toContain('google drive');
  });
});
