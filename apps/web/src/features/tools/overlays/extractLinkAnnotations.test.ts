import { describe, expect, it } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { addLinkAnnotation } from './addLinkAnnotation';
import {
  extractLinkAnnotations,
  stripAllLinkAnnotations,
} from './extractLinkAnnotations';
import { uint8ToArrayBuffer } from '@/features/files/localDownload';

describe('extractLinkAnnotations', () => {
  it('extracts URI links written with addLinkAnnotation', async () => {
    const doc = await PDFDocument.create();
    const page = doc.addPage([400, 600]);
    addLinkAnnotation(page, doc, {
      x: 50,
      y: 500,
      width: 100,
      height: 20,
      uri: 'https://example.com/path',
    });
    const bytes = await doc.save();
    const found = await extractLinkAnnotations(uint8ToArrayBuffer(bytes));
    expect(found).toHaveLength(1);
    expect(found[0].uri).toBe('https://example.com/path');
    expect(found[0].source).toBe('existing');
    expect(found[0].page).toBe(1);
  });

  it('stripAllLinkAnnotations removes links', async () => {
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
    const stripped = await stripAllLinkAnnotations(uint8ToArrayBuffer(bytes));
    const found = await extractLinkAnnotations(uint8ToArrayBuffer(stripped));
    expect(found).toHaveLength(0);
  });
});
