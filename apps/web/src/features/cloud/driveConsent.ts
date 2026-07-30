/** Shared consent gates for optional cloud export (unit-tested). */

export type CloudProviderName = 'Google Drive' | 'Dropbox' | 'OneDrive';

export function consentLabelFor(provider: CloudProviderName): string {
  return `I understand this file will be uploaded to my ${provider}`;
}

export function canUseCloudExport(consent: boolean): boolean {
  return consent === true;
}

/** @deprecated Prefer canUseCloudExport + consentLabelFor */
export const CONSENT_LABEL = consentLabelFor('Google Drive');

export function canUseDriveExport(consent: boolean): boolean {
  return canUseCloudExport(consent);
}
