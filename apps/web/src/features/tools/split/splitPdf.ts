import { PDFDocument } from 'pdf-lib';
import { parsePageRanges, chunkEveryN, individualPageRanges } from '../parsePageRanges';

export type SplitMode = 'ranges' | 'every' | 'individual' | 'at';

export interface SplitRangeSpec {
  /** Inclusive 1-based range */
  start: number;
  end: number;
  fileName?: string;
}

export interface SplitRequest {
  bytes: ArrayBuffer;
  mode: SplitMode;
  /** For mode=ranges: freeform "1-3,4-6" or explicit ranges */
  rangeText?: string;
  ranges?: SplitRangeSpec[];
  /** For mode=every */
  everyN?: number;
  /** For mode=at: split before these 1-based page numbers (excluding 1) */
  splitBefore?: number[];
  baseName?: string;
}

export interface SplitPart {
  bytes: Uint8Array;
  fileName: string;
  start: number;
  end: number;
  pageCount: number;
}

export interface SplitResult {
  parts: SplitPart[];
}

function stemName(baseName?: string): string {
  const raw = (baseName || 'split').replace(/\.pdf$/i, '');
  return raw || 'split';
}

function defaultName(base: string, start: number, end: number, index: number): string {
  if (start === end) return `${base}-p${start}.pdf`;
  return `${base}-${start}-${end}.pdf`;
}

export function planSplitRanges(
  pageCount: number,
  request: Omit<SplitRequest, 'bytes'>
): SplitRangeSpec[] {
  const base = stemName(request.baseName);

  if (request.mode === 'individual') {
    return individualPageRanges(pageCount).map((r, i) => ({
      ...r,
      fileName: defaultName(base, r.start, r.end, i),
    }));
  }

  if (request.mode === 'every') {
    const n = request.everyN ?? 1;
    return chunkEveryN(pageCount, n).map((r, i) => ({
      ...r,
      fileName: defaultName(base, r.start, r.end, i),
    }));
  }

  if (request.mode === 'at') {
    const cuts = [...new Set(request.splitBefore ?? [])]
      .filter((p) => p > 1 && p <= pageCount)
      .sort((a, b) => a - b);
    const bounds = [1, ...cuts, pageCount + 1];
    const ranges: SplitRangeSpec[] = [];
    for (let i = 0; i < bounds.length - 1; i++) {
      const start = bounds[i];
      const end = bounds[i + 1] - 1;
      if (end >= start) {
        ranges.push({
          start,
          end,
          fileName: defaultName(base, start, end, i),
        });
      }
    }
    return ranges;
  }

  if (request.ranges?.length) {
    return request.ranges.map((r, i) => ({
      ...r,
      fileName: r.fileName || defaultName(base, r.start, r.end, i),
    }));
  }

  const text = request.rangeText?.trim() || '';
  if (!text) throw new Error('Enter at least one page range.');
  // Allow multi-range groups separated by `;` for separate files
  const groups = text.includes(';')
    ? text.split(';').map((g) => g.trim()).filter(Boolean)
    : [text];

  return groups.map((group, i) => {
    const pages = parsePageRanges(group, { pageCount, rejectOverlaps: true });
    const start = Math.min(...pages);
    const end = Math.max(...pages);
    // Contiguous required for a single output part from a group
    for (let p = start; p <= end; p++) {
      if (!pages.includes(p)) {
        throw new Error(
          `Range “${group}” must be contiguous for split. Use Extract for non-contiguous pages.`
        );
      }
    }
    return { start, end, fileName: defaultName(base, start, end, i) };
  });
}

export async function splitPdf(
  request: SplitRequest,
  onProgress?: (current: number, total: number) => void
): Promise<SplitResult> {
  const src = await PDFDocument.load(request.bytes.slice(0), {
    ignoreEncryption: true,
  });
  const pageCount = src.getPageCount();
  const ranges = planSplitRanges(pageCount, request);
  if (ranges.length === 0) throw new Error('No output files to create.');

  const parts: SplitPart[] = [];
  for (let i = 0; i < ranges.length; i++) {
    const range = ranges[i];
    onProgress?.(i, ranges.length);
    const out = await PDFDocument.create();
    const indices = Array.from(
      { length: range.end - range.start + 1 },
      (_, k) => range.start - 1 + k
    );
    const copied = await out.copyPages(src, indices);
    copied.forEach((p) => out.addPage(p));
    const bytes = await out.save();
    parts.push({
      bytes,
      fileName: range.fileName || defaultName(stemName(request.baseName), range.start, range.end, i),
      start: range.start,
      end: range.end,
      pageCount: indices.length,
    });
  }
  onProgress?.(ranges.length, ranges.length);
  return { parts };
}
