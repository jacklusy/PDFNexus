/** Shared cloud upload/download size cap (50MB). */
export const MAX_CLOUD_FILE_BYTES = 50 * 1024 * 1024;

/** @deprecated Prefer MAX_CLOUD_FILE_BYTES */
export const MAX_DRIVE_FILE_BYTES = MAX_CLOUD_FILE_BYTES;

export function isPdfUpload(file: {
  mimetype?: string;
  originalname?: string;
}): boolean {
  const mime = (file.mimetype || '').toLowerCase();
  const nameLower = (file.originalname || '').toLowerCase();
  return (
    mime === 'application/pdf' ||
    mime === 'application/octet-stream' ||
    nameLower.endsWith('.pdf')
  );
}
