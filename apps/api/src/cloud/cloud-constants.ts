/** Shared cloud upload/download size cap (50MB). */
export const MAX_CLOUD_FILE_BYTES = 50 * 1024 * 1024;

/** @deprecated Prefer MAX_CLOUD_FILE_BYTES */
export const MAX_DRIVE_FILE_BYTES = MAX_CLOUD_FILE_BYTES;

/**
 * PDF-only gate for cloud export.
 * Accepts application/pdf, or a .pdf filename (even if mime is empty/octet-stream).
 * Never treats bare application/octet-stream without .pdf as PDF.
 */
export function isPdfUpload(file: {
  mimetype?: string;
  originalname?: string;
}): boolean {
  const mime = (file.mimetype || '').toLowerCase();
  const nameLower = (file.originalname || '').toLowerCase();
  if (nameLower.endsWith('.pdf')) return true;
  return mime === 'application/pdf';
}

/** True when cloud file metadata looks like a PDF. */
export function isCloudPdfMeta(meta: {
  name?: string;
  mimeType?: string;
}): boolean {
  const name = (meta.name || '').toLowerCase();
  const mime = (meta.mimeType || '').toLowerCase();
  return (
    name.endsWith('.pdf') ||
    mime === 'application/pdf' ||
    mime === 'application/x-pdf'
  );
}

export function isCloudTokenConnected(record: {
  refreshToken?: string;
  accessToken?: string;
  accessExpiresAt?: number;
} | null): boolean {
  if (!record) return false;
  if (record.refreshToken && record.refreshToken.length > 0) return true;
  if (
    record.accessToken &&
    record.accessExpiresAt != null &&
    record.accessExpiresAt > Date.now()
  ) {
    return true;
  }
  return false;
}
