/**
 * PDF → simple reading-order HTML (not a pixel-perfect layout recreation).
 */

import { ensurePdfWorker } from '@/lib/pdf/pdfHelpers';

export interface PdfToHtmlOptions {
  bytes: ArrayBuffer;
  title?: string;
  onProgress?: (current: number, total: number) => void;
}

export interface PdfToHtmlResult {
  html: string;
  pageCount: number;
}

interface LineItem {
  str: string;
  x: number;
  y: number;
}

const LINE_Y_TOL = 3;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function linesFromItems(
  items: Array<{ str?: string; transform?: number[] }>
): string[] {
  const parsed: LineItem[] = [];
  for (const item of items) {
    const str = (item.str || '').replace(/\s+/g, ' ');
    if (!str.trim() || !item.transform || item.transform.length < 6) continue;
    parsed.push({ str, x: item.transform[4], y: item.transform[5] });
  }
  parsed.sort((a, b) => b.y - a.y || a.x - b.x);

  const lines: LineItem[][] = [];
  for (const item of parsed) {
    const last = lines[lines.length - 1];
    if (last && Math.abs(last[0].y - item.y) <= LINE_Y_TOL) {
      last.push(item);
    } else {
      lines.push([item]);
    }
  }

  return lines.map((line) =>
    line
      .sort((a, b) => a.x - b.x)
      .map((c) => c.str)
      .join('')
      .replace(/\s+/g, ' ')
      .trim()
  );
}

/**
 * Extract reading-order text (sorted by y then x) into a simple HTML article.
 * Complex multi-column / scanned layouts will not be preserved faithfully.
 */
export async function pdfToHtml(
  options: PdfToHtmlOptions
): Promise<PdfToHtmlResult> {
  const pdfjs = await import('pdfjs-dist');
  ensurePdfWorker(pdfjs);
  const task = pdfjs.getDocument({
    data: options.bytes.slice(0),
    isEvalSupported: false,
  });
  const doc = await task.promise;
  const title = escapeHtml(options.title || 'PDF export');
  const sections: string[] = [];

  try {
    for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
      options.onProgress?.(pageNum - 1, doc.numPages);
      const page = await doc.getPage(pageNum);
      const content = await page.getTextContent();
      const lines = linesFromItems(
        content.items as Array<{ str?: string; transform?: number[] }>
      );
      const paras = lines
        .filter(Boolean)
        .map((line) => `<p>${escapeHtml(line)}</p>`)
        .join('\n');
      sections.push(
        `<section data-page="${pageNum}">\n<h2>Page ${pageNum}</h2>\n${paras || '<p><em>(No extractable text on this page)</em></p>'}\n</section>`
      );
    }
    options.onProgress?.(doc.numPages, doc.numPages);
  } finally {
    await doc.destroy();
  }

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${title}</title>
<style>
  body { font-family: Georgia, "Times New Roman", serif; line-height: 1.55; max-width: 42rem; margin: 2rem auto; padding: 0 1rem; color: #1a1a1a; }
  h1 { font-size: 1.75rem; }
  h2 { font-size: 1.1rem; margin-top: 2rem; color: #444; }
  p { margin: 0.4rem 0; }
  .warn { background: #fff8e6; border: 1px solid #e6d9a8; padding: 0.75rem 1rem; font-size: 0.9rem; border-radius: 6px; }
</style>
</head>
<body>
<article>
<h1>${title}</h1>
<p class="warn">Layout warning: this HTML is reading-order text extracted from the PDF. Multi-column layouts, tables, and scanned pages may not match the original appearance.</p>
${sections.join('\n')}
</article>
</body>
</html>`;

  return { html, pageCount: sections.length };
}
