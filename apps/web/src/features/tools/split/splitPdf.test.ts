import { describe, expect, it } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { planSplitRanges, splitPdf } from './splitPdf';
import { uint8ToArrayBuffer } from '@/features/files/localDownload';

describe('planSplitRanges', () => {
  it('plans individual pages', () => {
    const ranges = planSplitRanges(3, { mode: 'individual', baseName: 'doc.pdf' });
    expect(ranges).toHaveLength(3);
    expect(ranges[0]).toMatchObject({ start: 1, end: 1 });
    expect(ranges[2]).toMatchObject({ start: 3, end: 3 });
  });

  it('plans every N', () => {
    const ranges = planSplitRanges(5, { mode: 'every', everyN: 2, baseName: 'x' });
    expect(ranges.map((r) => [r.start, r.end])).toEqual([
      [1, 2],
      [3, 4],
      [5, 5],
    ]);
  });

  it('plans ranges text', () => {
    const ranges = planSplitRanges(10, {
      mode: 'ranges',
      rangeText: '1-2;3-5',
      baseName: 'x',
    });
    expect(ranges).toHaveLength(2);
    expect(ranges[0]).toMatchObject({ start: 1, end: 2 });
    expect(ranges[1]).toMatchObject({ start: 3, end: 5 });
  });
});

describe('splitPdf', () => {
  it('splits a 3-page PDF into individuals', async () => {
    const doc = await PDFDocument.create();
    doc.addPage([200, 200]);
    doc.addPage([200, 200]);
    doc.addPage([200, 200]);
    const bytes = await doc.save();
    const result = await splitPdf({
      bytes: uint8ToArrayBuffer(bytes),
      mode: 'individual',
      baseName: 't.pdf',
    });
    expect(result.parts).toHaveLength(3);
    expect(result.parts[0].pageCount).toBe(1);
  });
});
