/** Shared cloud upload/download size cap (50MB). */
export const MAX_CLOUD_FILE_BYTES = 50 * 1024 * 1024;

/** @deprecated Prefer MAX_CLOUD_FILE_BYTES */
export const MAX_DRIVE_FILE_BYTES = MAX_CLOUD_FILE_BYTES;

export type CloudProviderId = 'google_drive' | 'dropbox' | 'onedrive';

export interface CloudFileMeta {
  id: string;
  name: string;
  mimeType?: string;
  size?: string;
  webViewLink?: string;
}

export interface CloudExportResult {
  id: string;
  name: string;
  webViewLink: string;
}
