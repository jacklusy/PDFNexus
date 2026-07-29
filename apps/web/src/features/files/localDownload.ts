import { trackObjectUrl, revokeObjectUrl } from '@/lib/pdf/pdfHelpers';
import { triggerBrowserDownload } from './api';

/**
 * Immediate, ungated local download of a browser-produced Blob.
 * Does not call auth or upload APIs.
 */
export function downloadBlobLocally(blob: Blob, fileName: string): string {
  const url = trackObjectUrl(URL.createObjectURL(blob));
  triggerBrowserDownload(url, fileName);
  return url;
}

export function openBlobLocally(blob: Blob): string {
  const url = trackObjectUrl(URL.createObjectURL(blob));
  window.open(url, '_blank', 'noopener');
  return url;
}

export function revokeLocalUrl(url: string | null | undefined): void {
  if (url) revokeObjectUrl(url);
}

export interface LocalExportResult {
  blob: Blob;
  fileName: string;
  localBlobUrl: string;
  size: number;
  pageCount?: number;
  kind: 'pdf' | 'docx' | 'zip' | 'image';
}

export function createLocalExport(
  blob: Blob,
  fileName: string,
  kind: LocalExportResult['kind'],
  pageCount?: number
): LocalExportResult {
  const localBlobUrl = trackObjectUrl(URL.createObjectURL(blob));
  return {
    blob,
    fileName,
    localBlobUrl,
    size: blob.size,
    pageCount,
    kind,
  };
}
