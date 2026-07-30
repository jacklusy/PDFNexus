import { describe, expect, it, vi } from 'vitest';
import JSZip from 'jszip';
import { EPUB_LAYOUT_NOTICE, pdfToEpub } from './pdfToEpub';

vi.mock('../pdf-to-html/pdfToHtml', () => ({
  pdfToHtml: vi.fn(async () => ({
    html: '<html><body><article><p>Hello</p></article></body></html>',
    articleHtml: '<article><h1>Hello</h1><p>World</p></article>',
    pageCount: 1,
  })),
}));

describe('pdfToEpub packaging smoke', () => {
  it('documents layout honesty', () => {
    expect(EPUB_LAYOUT_NOTICE.toLowerCase()).toMatch(/reflow/);
  });

  it('calls pdfToEpub and returns a valid EPUB zip', async () => {
    const result = await pdfToEpub({
      bytes: new ArrayBuffer(8),
      title: 'Smoke Test',
    });
    expect(result.pageCount).toBe(1);
    expect(result.title).toBe('Smoke Test');
    expect(result.epubBlob.size).toBeGreaterThan(40);

    const loaded = await JSZip.loadAsync(await result.epubBlob.arrayBuffer());
    expect(loaded.file('mimetype')).toBeTruthy();
    expect(loaded.file('META-INF/container.xml')).toBeTruthy();
    expect(loaded.file('EPUB/content.opf')).toBeTruthy();
    expect(loaded.file('EPUB/chapter.xhtml')).toBeTruthy();
    const mime = await loaded.file('mimetype')!.async('string');
    expect(mime).toBe('application/epub+zip');
  });
});
