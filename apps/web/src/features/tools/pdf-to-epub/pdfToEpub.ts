/**
 * Package reading-order HTML (from pdfToHtml) into a minimal EPUB 3 archive.
 * Layout is reflowable — not a pixel-perfect PDF clone.
 */

import JSZip from 'jszip';
import { pdfToHtml, type PdfToHtmlOptions } from '../pdf-to-html/pdfToHtml';

export const EPUB_LAYOUT_NOTICE =
  'EPUB is reflowable. Complex columns, absolute positioning, and print layouts will not match the PDF.';

export interface PdfToEpubOptions extends PdfToHtmlOptions {
  /** Author metadata (optional). */
  creator?: string;
  language?: string;
}

export interface PdfToEpubResult {
  epubBlob: Blob;
  pageCount: number;
  title: string;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Build an EPUB from PDF bytes via the existing HTML export path.
 */
export async function pdfToEpub(
  options: PdfToEpubOptions
): Promise<PdfToEpubResult> {
  const title = options.title || 'PDF export';
  const language = options.language || 'en';
  const creator = options.creator || 'PDFNexus';

  const htmlResult = await pdfToHtml({
    ...options,
    // Prefer text for EPUB; skip heavy page images by default for size
    includePageImages: options.includePageImages ?? false,
  });

  const article = htmlResult.articleHtml || `<article><p>${escapeXml(title)}</p></article>`;
  const chapterXhtml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="${escapeXml(language)}" lang="${escapeXml(language)}">
<head>
  <meta charset="UTF-8"/>
  <title>${escapeXml(title)}</title>
  <style type="text/css">
    body { font-family: serif; line-height: 1.5; margin: 1em; }
    h2, h3 { font-family: sans-serif; }
    img { max-width: 100%; height: auto; }
  </style>
</head>
<body>
${article}
<p><em>${escapeXml(EPUB_LAYOUT_NOTICE)}</em></p>
</body>
</html>`;

  const navXhtml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="${escapeXml(language)}">
<head><title>Navigation</title></head>
<body>
  <nav epub:type="toc" id="toc">
    <h1>Contents</h1>
    <ol>
      <li><a href="chapter.xhtml">${escapeXml(title)}</a></li>
    </ol>
  </nav>
</body>
</html>`;

  const opf = `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="uid">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="uid">pdfnexus-${Date.now().toString(36)}</dc:identifier>
    <dc:title>${escapeXml(title)}</dc:title>
    <dc:language>${escapeXml(language)}</dc:language>
    <dc:creator>${escapeXml(creator)}</dc:creator>
    <meta property="dcterms:modified">${new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')}</meta>
  </metadata>
  <manifest>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    <item id="chapter" href="chapter.xhtml" media-type="application/xhtml+xml"/>
  </manifest>
  <spine>
    <itemref idref="chapter"/>
  </spine>
</package>`;

  const container = `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="EPUB/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`;

  const zip = new JSZip();
  // mimetype must be first and stored uncompressed
  zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });
  zip.folder('META-INF')?.file('container.xml', container);
  const epub = zip.folder('EPUB');
  epub?.file('content.opf', opf);
  epub?.file('nav.xhtml', navXhtml);
  epub?.file('chapter.xhtml', chapterXhtml);

  const epubBlob = await zip.generateAsync({
    type: 'blob',
    mimeType: 'application/epub+zip',
    compression: 'DEFLATE',
  });

  return {
    epubBlob,
    pageCount: htmlResult.pageCount,
    title,
  };
}
