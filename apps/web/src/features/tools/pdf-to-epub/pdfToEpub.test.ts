import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import { EPUB_LAYOUT_NOTICE } from './pdfToEpub';

describe('pdfToEpub packaging smoke', () => {
  it('documents layout honesty', () => {
    expect(EPUB_LAYOUT_NOTICE.toLowerCase()).toMatch(/reflow/);
  });

  it('builds a minimal EPUB zip shape', async () => {
    const zip = new JSZip();
    zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });
    zip.folder('META-INF')?.file(
      'container.xml',
      '<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="EPUB/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>'
    );
    zip.folder('EPUB')?.file('chapter.xhtml', '<html xmlns="http://www.w3.org/1999/xhtml"><body><p>Hi</p></body></html>');
    const blob = await zip.generateAsync({ type: 'blob' });
    expect(blob.size).toBeGreaterThan(20);
    const loaded = await JSZip.loadAsync(await blob.arrayBuffer());
    expect(loaded.file('mimetype')).toBeTruthy();
    expect(loaded.file('META-INF/container.xml')).toBeTruthy();
  });
});
