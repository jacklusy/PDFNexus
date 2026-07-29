/**
 * Detect table-like grids from pdf.js text content via y/x proximity clustering.
 */

import { ensurePdfWorker } from '@/lib/pdf/pdfHelpers';

export interface DetectedTable {
  page: number;
  rows: string[][];
  /** Rough bounds in PDF user space (origin bottom-left). */
  bounds?: { x: number; y: number; w: number; h: number };
}

interface TextItem {
  str: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

const ROW_Y_TOLERANCE = 3;
const COL_X_TOLERANCE = 12;
const MIN_ROWS = 2;
const MIN_COLS = 2;

export type PdfTextItemLike = {
  str?: string;
  transform?: number[];
  width?: number;
  height?: number;
};

function itemsFromContent(items: PdfTextItemLike[]): TextItem[] {
  const out: TextItem[] = [];
  for (const item of items) {
    const str = (item.str || '').replace(/\s+/g, ' ').trim();
    if (!str || !item.transform || item.transform.length < 6) continue;
    const x = item.transform[4];
    const y = item.transform[5];
    const h = Math.abs(item.transform[3] || item.height || 10);
    const w = item.width ?? str.length * (h * 0.5);
    out.push({ str, x, y, w, h: h || 10 });
  }
  return out;
}

/**
 * Detect tables from already-extracted text items (pdf.js-like).
 * Useful for unit tests without loading a PDF.
 */
export function detectTablesFromTextItems(
  page: number,
  rawItems: PdfTextItemLike[]
): DetectedTable[] {
  const items = itemsFromContent(rawItems);
  if (items.length < MIN_ROWS * MIN_COLS) return [];

  const clustered = clusterRows(items);
  const grid = rowsToGrid(clustered);
  const blocks = splitTableBlocks(grid, clustered);
  const tables: DetectedTable[] = [];

  if (blocks.length === 0 && grid.length >= MIN_ROWS) {
    const colCount = Math.max(...grid.map((r) => r.length), 0);
    if (colCount >= MIN_COLS) {
      tables.push({ page, rows: grid, bounds: boundsFor(clustered) });
    }
  } else {
    for (const rows of blocks) {
      tables.push({ page, rows, bounds: boundsFor(clustered) });
    }
  }
  return tables;
}

/** Cluster items into rows (similar y), each row sorted by x. */
function clusterRows(items: TextItem[]): TextItem[][] {
  if (!items.length) return [];
  const sorted = [...items].sort((a, b) => b.y - a.y || a.x - b.x);
  const rows: TextItem[][] = [];
  for (const item of sorted) {
    const last = rows[rows.length - 1];
    if (last && Math.abs(last[0].y - item.y) <= ROW_Y_TOLERANCE) {
      last.push(item);
    } else {
      rows.push([item]);
    }
  }
  for (const row of rows) {
    row.sort((a, b) => a.x - b.x);
  }
  return rows;
}

/** Infer shared column x-anchors from row starts, then assign cells. */
function rowsToGrid(rows: TextItem[][]): string[][] {
  if (!rows.length) return [];

  const anchors: number[] = [];
  for (const row of rows) {
    for (const cell of row) {
      const hit = anchors.find((a) => Math.abs(a - cell.x) <= COL_X_TOLERANCE);
      if (hit == null) anchors.push(cell.x);
    }
  }
  anchors.sort((a, b) => a - b);

  if (anchors.length < MIN_COLS) {
    // Fall back to per-row concatenation when columns are unclear.
    return rows.map((row) => [row.map((c) => c.str).join(' ')]);
  }

  return rows.map((row) => {
    const cells = anchors.map(() => '');
    for (const item of row) {
      let best = 0;
      let bestDist = Infinity;
      for (let i = 0; i < anchors.length; i++) {
        const d = Math.abs(anchors[i] - item.x);
        if (d < bestDist) {
          bestDist = d;
          best = i;
        }
      }
      cells[best] = cells[best] ? `${cells[best]} ${item.str}` : item.str;
    }
    return cells;
  });
}

function splitTableBlocks(grid: string[][], sourceRows: TextItem[][]): DetectedTable['rows'][] {
  // Split on large vertical gaps between consecutive source rows.
  if (sourceRows.length < MIN_ROWS) return [];

  const blocks: { start: number; end: number }[] = [];
  let start = 0;
  for (let i = 1; i < sourceRows.length; i++) {
    const gap = Math.abs(sourceRows[i - 1][0].y - sourceRows[i][0].y);
    const avgH =
      (sourceRows[i - 1].reduce((s, c) => s + c.h, 0) / sourceRows[i - 1].length +
        sourceRows[i].reduce((s, c) => s + c.h, 0) / sourceRows[i].length) /
      2;
    if (gap > avgH * 3.5) {
      blocks.push({ start, end: i - 1 });
      start = i;
    }
  }
  blocks.push({ start, end: sourceRows.length - 1 });

  const tables: string[][][] = [];
  for (const b of blocks) {
    const slice = grid.slice(b.start, b.end + 1);
    const colCount = Math.max(...slice.map((r) => r.length), 0);
    const multiColRows = slice.filter((r) => r.filter((c) => c.trim()).length >= MIN_COLS).length;
    if (slice.length >= MIN_ROWS && colCount >= MIN_COLS && multiColRows >= MIN_ROWS) {
      tables.push(slice);
    }
  }
  return tables;
}

function boundsFor(rows: TextItem[][]): DetectedTable['bounds'] {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const row of rows) {
    for (const c of row) {
      minX = Math.min(minX, c.x);
      minY = Math.min(minY, c.y);
      maxX = Math.max(maxX, c.x + c.w);
      maxY = Math.max(maxY, c.y + c.h);
    }
  }
  if (!Number.isFinite(minX)) return undefined;
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

/**
 * Scan every page and return detected tables as `{ page, rows }[]`.
 * Heuristic only — scanned PDFs without a text layer need OCR.
 */
export async function detectTables(bytes: ArrayBuffer): Promise<DetectedTable[]> {
  const pdfjs = await import('pdfjs-dist');
  ensurePdfWorker(pdfjs);
  const task = pdfjs.getDocument({
    data: bytes.slice(0),
    isEvalSupported: false,
  });
  const doc = await task.promise;
  const tables: DetectedTable[] = [];

  try {
    for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
      const page = await doc.getPage(pageNum);
      const content = await page.getTextContent();
      tables.push(
        ...detectTablesFromTextItems(
          pageNum,
          content.items as PdfTextItemLike[]
        )
      );
    }
  } finally {
    await doc.destroy();
  }

  return tables;
}
