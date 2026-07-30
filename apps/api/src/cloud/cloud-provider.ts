/** Supported optional cloud storage providers. */
export type CloudProviderId = 'drive' | 'dropbox' | 'onedrive';

export interface CloudFileListItem {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime?: string;
  size?: string;
  webViewLink?: string;
}

export interface CloudTokenRecord {
  refreshToken: string;
  accessToken?: string;
  accessExpiresAt?: number;
  connectedAt: number;
}

export interface CloudImportedFile {
  buffer: Buffer;
  name: string;
  mimeType: string;
}

export interface CloudExportedFile {
  id: string;
  name: string;
  webViewLink: string;
}

/**
 * Shared shape for optional cloud import/export backends.
 * Implementations keep OAuth tokens in Redis (encrypted in production).
 */
export interface CloudStorageProvider {
  readonly id: CloudProviderId;
  isConfigured(): boolean;
  assertConfigured(): void;
  assertEncryptionReady(): void;
  isConnected(sessionId: string): Promise<boolean>;
  disconnect(sessionId: string): Promise<void>;
  listPdfFiles(sessionId: string, query?: string): Promise<CloudFileListItem[]>;
  importFile(sessionId: string, fileId: string): Promise<CloudImportedFile>;
  exportFile(
    sessionId: string,
    file: Express.Multer.File,
  ): Promise<CloudExportedFile>;
}
