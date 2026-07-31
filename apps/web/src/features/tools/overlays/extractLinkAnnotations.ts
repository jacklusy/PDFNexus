/**
 * Extract existing URI Link annotations from a PDF (pdf-lib).
 */

import {
  PDFArray,
  PDFDict,
  PDFName,
  PDFNumber,
  PDFString,
  PDFHexString,
  type PDFRef,
} from 'pdf-lib';
import { loadReadablePdf } from '../assertPdfReadable';
import { isAllowedLinkUri } from './linkUri';
import { createId, type LinkOverlay } from './types';

function readUriFromAction(action: PDFDict): string | null {
  const s = action.get(PDFName.of('S'));
  if (!s || String(s) !== '/URI') return null;
  const uriObj = action.get(PDFName.of('URI'));
  if (uriObj instanceof PDFString || uriObj instanceof PDFHexString) {
    return uriObj.decodeText();
  }
  return null;
}

function rectFromAnnot(annot: PDFDict): {
  x: number;
  y: number;
  width: number;
  height: number;
} | null {
  const rect = annot.get(PDFName.of('Rect'));
  if (!(rect instanceof PDFArray) || rect.size() < 4) return null;
  const nums: number[] = [];
  for (let i = 0; i < 4; i++) {
    const v = rect.get(i);
    if (v instanceof PDFNumber) nums.push(v.asNumber());
    else return null;
  }
  const [x1, y1, x2, y2] = nums;
  const x = Math.min(x1, x2);
  const y = Math.min(y1, y2);
  const width = Math.abs(x2 - x1);
  const height = Math.abs(y2 - y1);
  if (!(width > 0) || !(height > 0)) return null;
  return { x, y, width, height };
}

export interface ExtractedLinkOverlay extends LinkOverlay {
  source: 'existing';
}

/**
 * Walk page Annots; return allowed URI Link annotations as overlays.
 */
export async function extractLinkAnnotations(
  bytes: ArrayBuffer
): Promise<ExtractedLinkOverlay[]> {
  const doc = await loadReadablePdf(bytes);
  const out: ExtractedLinkOverlay[] = [];
  const pages = doc.getPages();

  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    let annots = page.node.Annots();
    if (!annots) continue;
    if (!(annots instanceof PDFArray)) {
      const looked = doc.context.lookup(annots);
      if (!(looked instanceof PDFArray)) continue;
      annots = looked;
    }

    for (let j = 0; j < annots.size(); j++) {
      const ref = annots.get(j);
      const annot = doc.context.lookup(ref);
      if (!(annot instanceof PDFDict)) continue;
      const subtype = annot.get(PDFName.of('Subtype'));
      if (!subtype || String(subtype) !== '/Link') continue;

      const actionRef = annot.get(PDFName.of('A'));
      if (!actionRef) continue;
      const action = doc.context.lookup(actionRef);
      if (!(action instanceof PDFDict)) continue;
      const uri = readUriFromAction(action);
      if (!uri || !isAllowedLinkUri(uri)) continue;

      const rect = rectFromAnnot(annot);
      if (!rect) continue;

      out.push({
        id: createId(),
        kind: 'link',
        page: i + 1,
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        rotation: 0,
        opacity: 1,
        uri,
        source: 'existing',
      });
    }
  }

  return out;
}

/**
 * Remove all Link annotations from every page.
 * Used before re-writing the working link list on export.
 */
export async function stripAllLinkAnnotations(
  bytes: ArrayBuffer
): Promise<Uint8Array> {
  const doc = await loadReadablePdf(bytes);
  for (const page of doc.getPages()) {
    let annots = page.node.Annots();
    if (!annots) continue;
    if (!(annots instanceof PDFArray)) {
      const looked = doc.context.lookup(annots);
      if (!(looked instanceof PDFArray)) continue;
      annots = looked;
    }

    const kept: PDFRef[] = [];
    for (let j = 0; j < annots.size(); j++) {
      const ref = annots.get(j);
      const annot = doc.context.lookup(ref);
      if (!(annot instanceof PDFDict)) continue;
      const subtype = annot.get(PDFName.of('Subtype'));
      if (subtype && String(subtype) === '/Link') continue;
      kept.push(ref as PDFRef);
    }

    if (kept.length === 0) {
      page.node.delete(PDFName.of('Annots'));
    } else {
      const next = doc.context.obj([]) as PDFArray;
      for (const r of kept) next.push(r);
      page.node.set(PDFName.of('Annots'), next);
    }
  }
  return doc.save();
}
