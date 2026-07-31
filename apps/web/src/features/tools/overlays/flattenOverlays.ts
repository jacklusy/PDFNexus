import {
  PDFDocument,
  rgb,
  StandardFonts,
  degrees,
  type PDFPage,
  type RGB,
} from 'pdf-lib';
import { loadReadablePdf } from '../assertPdfReadable';
import { addLinkAnnotation } from './addLinkAnnotation';
import {
  formatPageNumber,
  type OverlayItem,
  type PageNumberOverlay,
  type WatermarkOverlay,
} from './types';

function parseColor(hex: string, opacity = 1): RGB {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  const n = m ? parseInt(m[1], 16) : 0x111827;
  return rgb(
    ((n >> 16) & 255) / 255,
    ((n >> 8) & 255) / 255,
    (n & 255) / 255
  );
}

async function embedImage(doc: PDFDocument, dataUrl: string) {
  const res = await fetch(dataUrl);
  const buf = await res.arrayBuffer();
  if (dataUrl.includes('image/png') || dataUrl.startsWith('data:image/png')) {
    return doc.embedPng(buf);
  }
  return doc.embedJpg(buf);
}

function drawOnPage(
  page: PDFPage,
  item: OverlayItem,
  helpers: {
    font: Awaited<ReturnType<PDFDocument['embedFont']>>;
    doc: PDFDocument;
    pageIndex0: number;
    totalPages: number;
  }
): Promise<void> {
  return (async () => {
    const opacity = Math.min(1, Math.max(0, item.opacity ?? 1));
    if (item.kind === 'text') {
      page.drawText(item.text || '', {
        x: item.x,
        y: item.y,
        size: item.fontSize,
        font: helpers.font,
        color: parseColor(item.color),
        opacity,
        rotate: degrees(item.rotation || 0),
        maxWidth: item.width,
      });
      return;
    }
    if (item.kind === 'signature') {
      if (item.imageDataUrl) {
        const img = await embedImage(helpers.doc, item.imageDataUrl);
        page.drawImage(img, {
          x: item.x,
          y: item.y,
          width: item.width,
          height: item.height,
          opacity,
          rotate: degrees(item.rotation || 0),
        });
      } else if (item.text) {
        page.drawText(item.text, {
          x: item.x,
          y: item.y,
          size: Math.min(item.height, 48),
          font: helpers.font,
          color: rgb(0.1, 0.1, 0.35),
          opacity,
          rotate: degrees(item.rotation || 0),
        });
      }
      return;
    }
    if (item.kind === 'rect') {
      page.drawRectangle({
        x: item.x,
        y: item.y,
        width: item.width,
        height: item.height,
        borderColor: parseColor(item.stroke),
        borderWidth: item.strokeWidth,
        color: item.fill ? parseColor(item.fill) : undefined,
        opacity,
        rotate: degrees(item.rotation || 0),
      });
      return;
    }
    if (item.kind === 'ellipse') {
      page.drawEllipse({
        x: item.x + item.width / 2,
        y: item.y + item.height / 2,
        xScale: item.width / 2,
        yScale: item.height / 2,
        borderColor: parseColor(item.stroke),
        borderWidth: item.strokeWidth,
        color: item.fill ? parseColor(item.fill) : undefined,
        opacity,
      });
      return;
    }
    if (item.kind === 'line' || item.kind === 'arrow') {
      page.drawLine({
        start: { x: item.x, y: item.y },
        end: { x: item.x + item.width, y: item.y + item.height },
        thickness: item.strokeWidth,
        color: parseColor(item.stroke),
        opacity,
      });
      if (item.kind === 'arrow') {
        const angle = Math.atan2(item.height, item.width);
        const head = 10;
        const ex = item.x + item.width;
        const ey = item.y + item.height;
        page.drawLine({
          start: { x: ex, y: ey },
          end: {
            x: ex - head * Math.cos(angle - 0.4),
            y: ey - head * Math.sin(angle - 0.4),
          },
          thickness: item.strokeWidth,
          color: parseColor(item.stroke),
          opacity,
        });
        page.drawLine({
          start: { x: ex, y: ey },
          end: {
            x: ex - head * Math.cos(angle + 0.4),
            y: ey - head * Math.sin(angle + 0.4),
          },
          thickness: item.strokeWidth,
          color: parseColor(item.stroke),
          opacity,
        });
      }
      return;
    }
    if (item.kind === 'freehand' && item.points.length > 1) {
      for (let i = 1; i < item.points.length; i++) {
        page.drawLine({
          start: item.points[i - 1],
          end: item.points[i],
          thickness: item.strokeWidth,
          color: parseColor(item.stroke),
          opacity,
        });
      }
      return;
    }
    if (item.kind === 'highlight') {
      const fillOpacity = Math.min(0.55, Math.max(0.15, opacity * 0.4));
      const color = parseColor(item.color);
      const quads =
        item.quads && item.quads.length > 0
          ? item.quads
          : [{ x: item.x, y: item.y, width: item.width, height: item.height }];
      for (const q of quads) {
        page.drawRectangle({
          x: q.x,
          y: q.y,
          width: q.width,
          height: q.height,
          color,
          opacity: fillOpacity,
          borderWidth: 0,
        });
      }
      return;
    }
    if (item.kind === 'stickyNote') {
      const noteColor = parseColor(item.color || '#facc15');
      const noteW = Math.max(18, Math.min(item.width || 24, 36));
      const noteH = Math.max(18, Math.min(item.height || 24, 36));
      page.drawRectangle({
        x: item.x,
        y: item.y,
        width: noteW,
        height: noteH,
        color: noteColor,
        opacity: Math.min(1, Math.max(0.5, opacity)),
        borderColor: rgb(0.55, 0.45, 0.05),
        borderWidth: 0.75,
      });
      const label = item.author
        ? `${item.author}: ${item.text || ''}`
        : item.text || '';
      if (label) {
        page.drawText(label.slice(0, 200), {
          x: item.x + noteW + 4,
          y: item.y + 4,
          size: 9,
          font: helpers.font,
          color: rgb(0.2, 0.2, 0.2),
          opacity,
          maxWidth: Math.max(80, item.width || 160),
        });
      }
      return;
    }
    if (item.kind === 'pageComment') {
      const text = item.text || '';
      if (text) {
        page.drawText(text.slice(0, 400), {
          x: item.x,
          y: item.y,
          size: 10,
          font: helpers.font,
          color: rgb(0.15, 0.15, 0.2),
          opacity,
          maxWidth: Math.max(120, item.width || 240),
        });
      }
      return;
    }
    if (item.kind === 'link') {
      const uri = item.uri || '';
      // Visual underline indicator
      page.drawRectangle({
        x: item.x,
        y: item.y,
        width: item.width,
        height: Math.max(1.5, Math.min(3, item.height * 0.15)),
        color: rgb(0.15, 0.35, 0.85),
        opacity: Math.min(1, opacity),
        borderWidth: 0,
      });
      const label = uri ? `(link: ${uri})` : '(link)';
      page.drawText(label.slice(0, 120), {
        x: item.x,
        y: item.y + 4,
        size: 8,
        font: helpers.font,
        color: rgb(0.15, 0.35, 0.85),
        opacity,
        maxWidth: Math.max(60, item.width),
      });
      if (uri) {
        try {
          addLinkAnnotation(page, helpers.doc, {
            x: item.x,
            y: item.y,
            width: Math.max(12, item.width),
            height: Math.max(12, item.height),
            uri,
          });
        } catch {
          // Visual label already burned; annotation is best-effort
        }
      }
      return;
    }
    if (item.kind === 'callout') {
      const stroke = parseColor(item.stroke || '#b45309');
      const fill = item.fill ? parseColor(item.fill) : undefined;
      const textColor = parseColor(item.color || '#78350f');
      const sw = item.strokeWidth ?? 1.5;
      page.drawRectangle({
        x: item.x,
        y: item.y,
        width: item.width,
        height: item.height,
        borderColor: stroke,
        borderWidth: sw,
        color: fill,
        opacity,
      });
      if (
        item.leaderX != null &&
        item.leaderY != null &&
        Number.isFinite(item.leaderX) &&
        Number.isFinite(item.leaderY)
      ) {
        const fromX = item.x;
        const fromY = item.y + item.height / 2;
        page.drawLine({
          start: { x: fromX, y: fromY },
          end: { x: item.leaderX, y: item.leaderY },
          thickness: sw,
          color: stroke,
          opacity,
        });
      }
      const text = item.text || '';
      if (text) {
        page.drawText(text.slice(0, 400), {
          x: item.x + 8,
          y: item.y + item.height - (item.fontSize || 12) - 6,
          size: item.fontSize || 12,
          font: helpers.font,
          color: textColor,
          opacity,
          maxWidth: Math.max(40, item.width - 16),
        });
      }
      return;
    }
  })();
}

async function drawWatermark(
  page: PDFPage,
  item: WatermarkOverlay,
  doc: PDFDocument,
  font: Awaited<ReturnType<PDFDocument['embedFont']>>
) {
  const opacity = Math.min(1, Math.max(0.05, item.opacity ?? 0.25));
  const drawOnce = async (x: number, y: number) => {
    if (item.imageDataUrl) {
      const img = await embedImage(doc, item.imageDataUrl);
      page.drawImage(img, {
        x,
        y,
        width: item.width,
        height: item.height,
        opacity,
        rotate: degrees(item.rotation || -30),
      });
    } else if (item.text) {
      page.drawText(item.text, {
        x,
        y,
        size: item.fontSize,
        font,
        color: parseColor(item.color),
        opacity,
        rotate: degrees(item.rotation || -30),
      });
    }
  };

  const { width, height } = page.getSize();
  if (item.tile) {
    for (let y = 40; y < height; y += item.height + 80) {
      for (let x = 40; x < width; x += item.width + 120) {
        await drawOnce(x, y);
      }
    }
  } else {
    await drawOnce(item.x || width / 2 - item.width / 2, item.y || height / 2);
  }
}

function drawPageNumber(
  page: PDFPage,
  item: PageNumberOverlay,
  font: Awaited<ReturnType<PDFDocument['embedFont']>>,
  pageIndex0: number,
  totalPages: number
) {
  const text = formatPageNumber(item, pageIndex0, totalPages);
  const { width, height } = page.getSize();
  const textWidth = font.widthOfTextAtSize(text, item.fontSize);
  let x = 40;
  if (item.align === 'center') x = (width - textWidth) / 2;
  if (item.align === 'right') x = width - textWidth - 40;
  const y = item.position === 'header' ? height - 36 : 24;
  page.drawText(text, {
    x,
    y,
    size: item.fontSize,
    font,
    color: parseColor(item.color),
    opacity: item.opacity ?? 1,
  });
}

export async function flattenOverlays(
  pdfBytes: ArrayBuffer,
  overlays: OverlayItem[],
  onProgress?: (current: number, total: number) => void
): Promise<Uint8Array> {
  const doc = await loadReadablePdf(pdfBytes);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const pages = doc.getPages();
  const total = pages.length;

  for (let i = 0; i < pages.length; i++) {
    onProgress?.(i, total);
    const page = pages[i];
    const pageNum = i + 1;

    for (const item of overlays) {
      if (item.kind === 'watermark') {
        const from = item.pageFrom || 1;
        const to = item.pageTo || total;
        if (pageNum < from || pageNum > to) continue;
        await drawWatermark(page, item, doc, font);
        continue;
      }
      if (item.kind === 'pageNumber') {
        drawPageNumber(page, item, font, i, total);
        continue;
      }
      if (item.page !== 0 && item.page !== pageNum) continue;
      await drawOnPage(page, item, {
        font,
        doc,
        pageIndex0: i,
        totalPages: total,
      });
    }
  }
  onProgress?.(total, total);
  return doc.save();
}
