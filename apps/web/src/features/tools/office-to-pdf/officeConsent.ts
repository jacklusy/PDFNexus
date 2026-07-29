/** Consent gate for Office → PDF server upload (unit-tested). */

export const OFFICE_UPLOAD_CONSENT_LABEL =
  'I understand this file will be uploaded to the conversion server';

export const OFFICE_MAX_BYTES = 25 * 1024 * 1024;

export function canUploadOfficeForConversion(options: {
  consent: boolean;
  hasFile: boolean;
  fileSize?: number;
}): boolean {
  if (!options.consent || !options.hasFile) return false;
  if (typeof options.fileSize === 'number' && options.fileSize > OFFICE_MAX_BYTES) {
    return false;
  }
  return true;
}
