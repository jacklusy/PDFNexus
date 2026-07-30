/**
 * PDF → simple reading-order HTML with heading heuristics and page images.
 * Not a pixel-perfect layout recreation.
 */

import { ensurePdfWorker } from '@/lib/pdf/pdfHelpers';

export interface PdfToHtmlOptions {
  bytes: ArrayBuffer;
  title?: string;
  /** Include a JPEG preview per page (default true). */
  includePageImages?: boolean;
  imageScale?: number;
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
  h: number;
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
  items: Array<{ str?: string; transform?: number[]; height?: number; width?: number }>
): Array<{ text: string; avgH: number }> {
  const parsed: LineItem[] = [];
  for (const item of items) {
    const str = (item.str || '').replace(/\s+/g, ' ');
    if (!str.trim() || !item.transform || item.transform.length < 6) continue;
    const h = Math.abs(item.transform[3] || item.height || 10);
    parsed.push({ str, x: item.transform[4], y: item.transform[5], h: h || 10 });
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

  return lines.map((line) => {
    const sorted = [...line].sort((a, b) => a.x - b.x);
    const text = sorted
      .map((c) => c.str)
      .join('')
      .replace(/\s+/g, ' ')
      .trim();
    const avgH =
      sorted.reduce((s, c) => s + c.h, 0) / Math.max(1, sorted.length);
    return { text, avgH };
  });
}

function headingTag(avgH: number, medianH: number): 'h2' | 'h3' | 'p' {
  if (medianH <= 0) return 'p';
  if (avgH >= medianH * 1.55) return 'h2';
  if (avgH >= medianH * 1.25) return 'h3';
  return 'p';
}

async function pageToJpegDataUrl(
  // pdf.js page proxy — keep loose to avoid RenderParameters/viewport coupling
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  page: any,
  scale: number
): Promise<string | null> {
  if (typeof document === 'undefined') return null;
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.floor(viewport.width));
  canvas.height = Math.max(1, Math.floor(viewport.height));
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: ctx, viewport, canvas }).promise;
  return canvas.toDataURL('image/jpeg', 0.72);
}

/**
 * Extract reading-order text (sorted by y then x) into a simple HTML article.
 * Uses font-size heuristics for headings and optional page JPEG embeds.
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
  const includeImages = options.includePageImages !== false;
  const imageScale = options.imageScale ?? 1.15;
  const sections: string[] = [];

  try {
    for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
      options.onProgress?.(pageNum - 1, doc.numPages);
      const page = await doc.getPage(pageNum);
      const content = await page.getTextContent();
      const lines = linesFromItems(
        content.items as Array<{
          str?: string;
          transform?: number[];
          height?: number;
        }>
      );
      const heights = lines.map((l) => l.avgH).filter((h) => h > 0).sort((a, b) => a - b);
      const medianH = heights.length
        ? heights[Math.floor(heights.length / 2)]
        : 12;

      const bodyParts: string[] = [];
      if (includeImages) {
        try {
          const dataUrl = await pageToJpegDataUrl(page, imageScale);
          if (dataUrl) {
            bodyParts.push(
              `<figure class="page-image"><img src="${dataUrl}" alt="Page ${pageNum} preview" /></figure>`
            );
          }
        } catch {
          // Image embed is best-effort
        }
      }

      for (const line of lines) {
        if (!line.text) continue;
        const tag = headingTag(line.avgH, medianH);
        bodyParts.push(`<${tag}>${escapeHtml(line.text)}</${tag}>`);
      }

      if (!bodyParts.length) {
        bodyParts.push('<p><em>(No extractable text on this page)</em></p>');
      }

      sections.push(
        `<section data-page="${pageNum}">\n<h2 class="page-label">Page ${pageNum}</h2>\n${bodyParts.join('\n')}\n</section>`
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
  h2 { font-size: 1.25rem; margin-top: 1.25rem; }
  h2.page-label { font-size: 1.05rem; margin-top: 2rem; color: #444; border-bottom: 1px solid #ddd; padding-bottom: 0.35rem; }
  h3 { font-size: 1.1rem; margin-top: 1rem; }
  p { margin: 0.4rem 0; }
  .page-image { margin: 0.75rem 0 1rem; }
  .page-image img { max-width: 100%; height: auto; border: 1px solid #ddd; }
  .warn { background: #fff8e6; border: 1px solid #e6d9a8; padding: 0.75rem 1rem; font-size: 0.9rem; border-radius: 6px; }
</style>
</head>
<body>
<article>
<h1>${title}</h1>
<p class="warn">Layout warning: this HTML is reading-order text (with heading heuristics and optional page images). Multi-column layouts, tables, and scanned pages may not match the original appearance.</p>
${sections.join('\n')}
</article>
</body>
</html>`;

  return { html, pageCount: sections.length };
}
