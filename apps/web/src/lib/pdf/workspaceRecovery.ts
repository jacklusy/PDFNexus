/**
 * Lightweight recoverable workspace manifest.
 * Stores page order / rotation / source metadata only — never file binaries.
 */

import type { PDFFile, PDFPageItem } from '@/lib/types';

const STORAGE_KEY = 'pdfnexus:workspace-manifest:v1';

export interface WorkspaceManifestPage {
  id: string;
  originalFileId: string | null;
  originalFileName: string;
  originalPageNumber: number;
  rotation: number;
  isBlank: boolean;
  isImage?: boolean;
  mimeType?: string;
  color?: string;
}

export interface WorkspaceManifestFile {
  id: string;
  name: string;
  size: number;
  pageCount: number;
  color?: string;
  fileType?: 'pdf' | 'image';
  mimeType?: string;
}

export interface WorkspaceManifest {
  version: 1;
  savedAt: string;
  files: WorkspaceManifestFile[];
  pages: WorkspaceManifestPage[];
  note: string;
}

export function buildWorkspaceManifest(
  files: PDFFile[],
  pages: PDFPageItem[]
): WorkspaceManifest {
  return {
    version: 1,
    savedAt: new Date().toISOString(),
    files: files.map((f) => ({
      id: f.id,
      name: f.name,
      size: f.size,
      pageCount: f.pageCount,
      color: f.color,
      fileType: f.fileType,
      mimeType: f.mimeType,
    })),
    pages: pages.map((p) => ({
      id: p.id,
      originalFileId: p.originalFileId,
      originalFileName: p.originalFileName,
      originalPageNumber: p.originalPageNumber,
      rotation: p.rotation,
      isBlank: p.isBlank,
      isImage: p.isImage,
      mimeType: p.mimeType,
      color: p.color,
    })),
    note:
      'Binaries are not persisted. Re-upload the listed source files to restore this arrangement.',
  };
}

export function persistWorkspaceManifest(
  files: PDFFile[],
  pages: PDFPageItem[]
): void {
  try {
    if (pages.length === 0) {
      clearWorkspaceManifest();
      return;
    }
    const manifest = buildWorkspaceManifest(files, pages);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(manifest));
  } catch {
    // Quota or private mode — ignore
  }
}

export function loadWorkspaceManifest(): WorkspaceManifest | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as WorkspaceManifest;
    if (parsed?.version !== 1 || !Array.isArray(parsed.pages)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearWorkspaceManifest(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function downloadManifestJson(manifest: WorkspaceManifest): void {
  const blob = new Blob([JSON.stringify(manifest, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `pdfnexus-workspace-${manifest.savedAt.slice(0, 10)}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
