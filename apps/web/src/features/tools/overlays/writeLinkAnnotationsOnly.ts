/**
 * Write URI Link annotations only (no burned-in visual chrome).
 */

import { loadReadablePdf } from '../assertPdfReadable';
import { addLinkAnnotation } from './addLinkAnnotation';
import { assertAllowedLinkUri } from './linkUri';
import { stripAllLinkAnnotations } from './extractLinkAnnotations';
import type { LinkOverlay } from './types';

export interface WriteLinkAnnotationsOnlyOptions {
  bytes: ArrayBuffer;
  links: Array<Pick<LinkOverlay, 'page' | 'x' | 'y' | 'width' | 'height' | 'uri'>>;
  onProgress?: (current: number, total: number) => void;
}

/**
 * Strip existing Link annots, then add the working list as annotations only.
 * Does not draw underlines or `(link: …)` text into page content.
 */
export async function writeLinkAnnotationsOnly(
  options: WriteLinkAnnotationsOnlyOptions
): Promise<Uint8Array> {
  const stripped = await stripAllLinkAnnotations(options.bytes);
  const strippedBuf = stripped.buffer.slice(
    stripped.byteOffset,
    stripped.byteOffset + stripped.byteLength
  ) as ArrayBuffer;

  const doc = await loadReadablePdf(strippedBuf);
  const pageCount = doc.getPageCount();
  const total = Math.max(1, options.links.length);
  let i = 0;

  for (const link of options.links) {
    i += 1;
    options.onProgress?.(i, total);
    if (link.page < 1 || link.page > pageCount) {
      throw new Error(`Link page ${link.page} is outside 1–${pageCount}.`);
    }
    const uri = assertAllowedLinkUri(link.uri);
    const page = doc.getPage(link.page - 1);
    addLinkAnnotation(page, doc, {
      x: link.x,
      y: link.y,
      width: link.width,
      height: link.height,
      uri,
    });
  }

  if (options.links.length === 0) {
    options.onProgress?.(1, 1);
  }

  return doc.save();
}
