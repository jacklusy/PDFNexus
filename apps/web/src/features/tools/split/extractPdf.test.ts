import { describe, it, expect } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { extractPdfPages, resolveExtractPages } from './extractPdf';

async function makePdf(pages: number): Promise<ArrayBuffer> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pages; i++) doc.addPage([100 + i, 100]);
  const raw = await doc.save();
  return Uint8Array.from(raw).buffer as ArrayBuffer;
}

describe('resolveExtractPages', () => {
  it('uses explicit pages in order', () => {
    expect(resolveExtractPages(5, { pages: [3, 1, 2] })).toEqual([3, 1, 2]);
  });

  it('rejects out-of-range pages', () => {
    expect(() => resolveExtractPages(3, { pages: [4] })).toThrow(/outside/i);
  });

  it('parses range text when pages omitted', () => {
    expect(resolveExtractPages(10, { rangeText: '2-3,5' })).toEqual([2, 3, 5]);
  });
});

describe('extractPdfPages', () => {
  it('exports selected pages in selection order', async () => {
    const bytes = await makePdf(4);
    const result = await extractPdfPages({ bytes, pages: [4, 1] });
    expect(result.pageCount).toBe(2);
    const out = await PDFDocument.load(result.bytes);
    expect(out.getPageCount()).toBe(2);
  });

  it('reports progress', async () => {
    const bytes = await makePdf(3);
    const ticks: Array<[number, number]> = [];
    await extractPdfPages({ bytes, pages: [1, 2, 3] }, (c, t) =>
      ticks.push([c, t]),
    );
    expect(ticks.at(-1)).toEqual([3, 3]);
  });

  it('throws when no pages selected', async () => {
    const bytes = await makePdf(2);
    await expect(extractPdfPages({ bytes, pages: [] })).rejects.toThrow(
      /at least one/i,
    );
  });
});
