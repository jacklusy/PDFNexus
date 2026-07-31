import { describe, expect, it } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { addLinkAnnotation } from './addLinkAnnotation';
import {
  extractLinkAnnotations,
  stripAllLinkAnnotations,
} from './extractLinkAnnotations';

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
    const found = await extractLinkAnnotations(bytes.buffer as ArrayBuffer);
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
    const stripped = await stripAllLinkAnnotations(bytes.buffer as ArrayBuffer);
    const found = await extractLinkAnnotations(
      stripped.buffer.slice(
        stripped.byteOffset,
        stripped.byteOffset + stripped.byteLength
      ) as ArrayBuffer
    );
    expect(found).toHaveLength(0);
  });
});
