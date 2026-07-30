/** Shared cloud file size limit (bytes) — matches API MAX_DRIVE_FILE_BYTES. */
export const MAX_CLOUD_FILE_BYTES = 50 * 1024 * 1024;

export function isWithinCloudSizeLimit(byteLength: number): boolean {
  return Number.isFinite(byteLength) && byteLength <= MAX_CLOUD_FILE_BYTES;
}
