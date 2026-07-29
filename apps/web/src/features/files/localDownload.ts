import { trackObjectUrl, revokeObjectUrl } from '@/lib/pdf/pdfHelpers';
import { triggerBrowserDownload } from './api';

/**
 * Immediate, ungated local download of a browser-produced Blob.
 * Does not call auth or upload APIs.
 * Revokes the temporary object URL shortly after triggering download.
 */
export function downloadBlobLocally(blob: Blob, fileName: string): string {
  const url = trackObjectUrl(URL.createObjectURL(blob));
  triggerBrowserDownload(url, fileName);
  // Allow the browser to start the download, then release the URL.
  window.setTimeout(() => revokeObjectUrl(url), 60_000);
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

/** Download using an existing export URL without creating a second object URL. */
export function downloadLocalExport(exportResult: LocalExportResult): void {
  triggerBrowserDownload(exportResult.localBlobUrl, exportResult.fileName);
}
