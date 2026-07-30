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

describe('extract worker contract helpers', () => {
  it('toTransferablePdfBytes returns a matching ArrayBuffer', async () => {
    const { toTransferablePdfBytes } = await import('./extractPdf');
    const src = new Uint8Array([1, 2, 3, 4, 5]).subarray(1, 4);
    const ab = toTransferablePdfBytes(src);
    expect(ab.byteLength).toBe(3);
    expect([...new Uint8Array(ab)]).toEqual([2, 3, 4]);
  });

  it('builds ok and error worker messages', async () => {
    const {
      extractWorkerOkMessage,
      extractWorkerErrMessage,
    } = await import('./extractPdf');
    const ok = extractWorkerOkMessage('extract', new Uint8Array([37, 80]), 2);
    expect(ok).toMatchObject({ id: 'extract', ok: true, result: { pageCount: 2 } });
    expect(ok.result.bytes.byteLength).toBe(2);
    const err = extractWorkerErrMessage('extract', new Error('boom'));
    expect(err).toEqual({ id: 'extract', ok: false, error: 'boom' });
  });
});
