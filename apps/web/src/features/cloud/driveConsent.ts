/** Consent gate for Google Drive export (unit-tested). */

export const CONSENT_LABEL =
  'I understand this file will be uploaded to my Google Drive';

export function canUseDriveExport(consent: boolean): boolean {
  return consent === true;
}
