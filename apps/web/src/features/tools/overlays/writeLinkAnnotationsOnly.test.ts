import { describe, expect, it } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { addLinkAnnotation } from './addLinkAnnotation';
import { extractLinkAnnotations } from './extractLinkAnnotations';
import { writeLinkAnnotationsOnly } from './writeLinkAnnotationsOnly';
import { uint8ToArrayBuffer } from '@/features/files/localDownload';

describe('writeLinkAnnotationsOnly', () => {
  it('writes annotations without burned-in (link: chrome', async () => {
    const doc = await PDFDocument.create();
    doc.addPage([400, 600]);
    const bytes = await doc.save();
    const out = await writeLinkAnnotationsOnly({
      bytes: uint8ToArrayBuffer(bytes),
      links: [
        {
          page: 1,
          x: 50,
          y: 500,
          width: 100,
          height: 20,
          uri: 'https://example.com/path',
        },
      ],
    });
    const text = new TextDecoder().decode(out);
    expect(text).not.toContain('(link:');
    const found = await extractLinkAnnotations(uint8ToArrayBuffer(out));
    expect(found).toHaveLength(1);
    expect(found[0].uri).toBe('https://example.com/path');
  });

  it('empty list strips all links', async () => {
    const doc = await PDFDocument.create();
    const page = doc.addPage([400, 600]);
    addLinkAnnotation(page, doc, {
      x: 10,
      y: 10,
      width: 40,
      height: 12,
      uri: 'https://example.com',
    });
    const bytes = await doc.save();
    const out = await writeLinkAnnotationsOnly({
      bytes: uint8ToArrayBuffer(bytes),
      links: [],
    });
    const found = await extractLinkAnnotations(uint8ToArrayBuffer(out));
    expect(found).toHaveLength(0);
  });
});
