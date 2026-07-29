/**
 * Parse page-range strings like `1, 3, 5-8, 12` into 1-based page numbers.
 */

export class PageRangeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PageRangeError';
  }
}

export interface ParsePageRangesOptions {
  /** Total pages in the source PDF (1-based max). */
  pageCount: number;
  /** Reject overlapping ranges (default true). */
  rejectOverlaps?: boolean;
}

export function parsePageRanges(
  input: string,
  options: ParsePageRangesOptions
): number[] {
  const { pageCount, rejectOverlaps = true } = options;
  if (!Number.isInteger(pageCount) || pageCount < 1) {
    throw new PageRangeError('Document has no pages.');
  }

  const trimmed = input.trim();
  if (!trimmed) throw new PageRangeError('Enter at least one page or range.');

  const parts = trimmed.split(',').map((p) => p.trim()).filter(Boolean);
  const pages: number[] = [];
  const seen = new Set<number>();

  for (const part of parts) {
    const rangeMatch = /^(\d+)\s*-\s*(\d+)$/.exec(part);
    if (rangeMatch) {
      const start = Number(rangeMatch[1]);
      const end = Number(rangeMatch[2]);
      if (start < 1 || end < 1 || start > pageCount || end > pageCount) {
        throw new PageRangeError(
          `Range ${start}-${end} is outside 1–${pageCount}.`
        );
      }
      if (start > end) {
        throw new PageRangeError(`Range ${start}-${end} is invalid (start > end).`);
      }
      for (let n = start; n <= end; n++) {
        if (rejectOverlaps && seen.has(n)) {
          throw new PageRangeError(`Page ${n} appears more than once.`);
        }
        if (!seen.has(n)) {
          seen.add(n);
          pages.push(n);
        }
      }
      continue;
    }

    if (!/^\d+$/.test(part)) {
      throw new PageRangeError(`Invalid token “${part}”. Use forms like 1, 3, 5-8.`);
    }
    const n = Number(part);
    if (n < 1 || n > pageCount) {
      throw new PageRangeError(`Page ${n} is outside 1–${pageCount}.`);
    }
    if (rejectOverlaps && seen.has(n)) {
      throw new PageRangeError(`Page ${n} appears more than once.`);
    }
    if (!seen.has(n)) {
      seen.add(n);
      pages.push(n);
    }
  }

  if (pages.length === 0) {
    throw new PageRangeError('No pages selected.');
  }
  return pages;
}

/** Split every N pages into contiguous groups (1-based inclusive ranges). */
export function chunkEveryN(
  pageCount: number,
  every: number
): Array<{ start: number; end: number }> {
  if (every < 1) throw new PageRangeError('Chunk size must be at least 1.');
  const ranges: Array<{ start: number; end: number }> = [];
  for (let start = 1; start <= pageCount; start += every) {
    ranges.push({ start, end: Math.min(pageCount, start + every - 1) });
  }
  return ranges;
}

/** Build individual single-page ranges. */
export function individualPageRanges(
  pageCount: number
): Array<{ start: number; end: number }> {
  return Array.from({ length: pageCount }, (_, i) => ({
    start: i + 1,
    end: i + 1,
  }));
}
