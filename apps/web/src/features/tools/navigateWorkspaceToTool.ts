/**
 * Navigate from workspace to a dedicated tool with the compiled PDF preloaded.
 */

import { compileMergedPdf } from '@/features/merge';
import type { FileStore, PDFPageItem } from '@/lib/types';
import { saveToolHandoff } from './toolHandoff';

export async function navigateWorkspaceToTool(options: {
  path: string;
  pages: PDFPageItem[];
  fileStore: FileStore;
  selectedPageIds?: Set<string>;
  /** When true, pass selected page indices as ?pages= (Crop/Resize). */
  includePageRange?: boolean;
  fileName?: string;
}): Promise<void> {
  if (!options.pages.length) {
    throw new Error('Add pages in the workspace before opening this tool.');
  }

  const { blob } = await compileMergedPdf(options.pages, options.fileStore);
  const selected = options.selectedPageIds;
  let pagesParam: string | undefined;
  if (options.includePageRange && selected && selected.size > 0) {
    const indices = options.pages
      .map((p, i) => (selected.has(p.id) ? i + 1 : null))
      .filter((n): n is number => n != null);
    if (indices.length > 0 && indices.length < options.pages.length) {
      pagesParam = indices.join(',');
    }
  }

  const fileName = options.fileName || 'workspace.pdf';
  await saveToolHandoff({
    blob,
    fileName,
    pages: pagesParam,
    targetPath: options.path,
  });

  const q = pagesParam ? `?pages=${encodeURIComponent(pagesParam)}` : '';
  window.location.href = `${options.path}${q}`;
}
