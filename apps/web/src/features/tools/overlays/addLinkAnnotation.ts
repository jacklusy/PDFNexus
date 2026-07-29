import {
  PDFDocument,
  PDFName,
  PDFString,
  type PDFPage,
} from 'pdf-lib';

export interface LinkAnnotationRect {
  x: number;
  y: number;
  width: number;
  height: number;
  uri: string;
}

/**
 * Create a PDF Link annotation with a URI action and attach it to the page.
 * Uses pdf-lib's low-level context / Annots API.
 */
export function addLinkAnnotation(
  page: PDFPage,
  doc: PDFDocument,
  opts: LinkAnnotationRect
): void {
  const { x, y, width, height, uri } = opts;
  if (!(width > 0) || !(height > 0)) {
    throw new Error('Link annotation requires positive width and height.');
  }
  const trimmed = uri.trim();
  if (!trimmed) {
    throw new Error('Link annotation requires a URI.');
  }

  const context = doc.context;
  const actionDict = context.obj({
    Type: 'Action',
    S: 'URI',
    URI: PDFString.of(trimmed),
  });
  const annotDict = context.obj({
    Type: 'Annot',
    Subtype: 'Link',
    Rect: [x, y, x + width, y + height],
    Border: [0, 0, 1],
    C: [0, 0, 1],
    A: actionDict,
  });
  // Ensure Subtype/Type are names (obj() usually handles string → PDFName)
  annotDict.set(PDFName.of('Type'), PDFName.of('Annot'));
  annotDict.set(PDFName.of('Subtype'), PDFName.of('Link'));

  const annotRef = context.register(annotDict);
  page.node.addAnnot(annotRef);
}
