/**
 * PDFNexus workspace types.
 * FileStore is the sole owner of binary ArrayBuffers.
 */

export interface PDFFile {
  id: string;
  name: string;
  size: number;
  pageCount: number;
  /** @deprecated Prefer FileStore — kept optional for recovery manifests only */
  arrayBuffer?: ArrayBuffer;
  color?: string;
  fileType?: 'pdf' | 'image';
  mimeType?: string;
}

export interface PDFPageItem {
  id: string;
  originalFileId: string | null;
  originalFileName: string;
  originalPageNumber: number;
  rotation: number;
  isBlank: boolean;
  isImage?: boolean;
  mimeType?: string;
  thumbnailUrl?: string;
  color?: string;
}

export interface FileStore {
  [fileId: string]: ArrayBuffer;
}
