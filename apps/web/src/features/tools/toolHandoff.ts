/**
 * Cross-route handoff: workspace → dedicated tool pages.
 * Stores one PDF blob + optional page range in IndexedDB, consumed once on tool mount.
 */

import {
  clearProject,
  loadFileBlob,
  loadSetting,
  saveFileBlob,
  saveSetting,
} from '@/features/workspace/projectStore';

const HANDOFF_PROJECT = 'tool-handoff';
const HANDOFF_BLOB_ID = 'tool-handoff:pdf';
const HANDOFF_META_KEY = 'tool-handoff:meta';

export interface ToolHandoffMeta {
  fileName: string;
  pages?: string;
  createdAt: number;
  targetPath?: string;
}

export async function saveToolHandoff(options: {
  blob: Blob;
  fileName: string;
  pages?: string;
  targetPath?: string;
}): Promise<void> {
  // Clear previous handoff blobs under this project id
  try {
    await clearProject(HANDOFF_PROJECT);
  } catch {
    // ignore
  }
  await saveFileBlob(HANDOFF_BLOB_ID, options.blob, HANDOFF_PROJECT);
  const meta: ToolHandoffMeta = {
    fileName: options.fileName || 'workspace.pdf',
    pages: options.pages,
    createdAt: Date.now(),
    targetPath: options.targetPath,
  };
  await saveSetting(HANDOFF_META_KEY, meta);
}

/**
 * Load and clear a pending handoff. Returns null if none / expired (>1h).
 */
export async function consumeToolHandoff(): Promise<{
  file: File;
  pages?: string;
} | null> {
  const meta = await loadSetting<ToolHandoffMeta>(HANDOFF_META_KEY);
  if (!meta?.fileName) return null;
  const age = Date.now() - (meta.createdAt || 0);
  if (age > 60 * 60 * 1000) {
    await clearToolHandoff();
    return null;
  }
  const blob = await loadFileBlob(HANDOFF_BLOB_ID);
  if (!blob) {
    await clearToolHandoff();
    return null;
  }
  const file = new File([blob], meta.fileName, {
    type: blob.type || 'application/pdf',
    lastModified: Date.now(),
  });
  const pages = meta.pages;
  await clearToolHandoff();
  return { file, pages };
}

export async function clearToolHandoff(): Promise<void> {
  try {
    await saveSetting(HANDOFF_META_KEY, null);
  } catch {
    // ignore
  }
  try {
    await clearProject(HANDOFF_PROJECT);
  } catch {
    // ignore
  }
}
