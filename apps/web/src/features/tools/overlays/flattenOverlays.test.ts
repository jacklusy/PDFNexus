import { describe, it, expect } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { flattenOverlays } from './flattenOverlays';
import { createId, type TextOverlay } from './types';

describe('flattenOverlays', () => {
  it('smokes text overlay flatten', async () => {
    const doc = await PDFDocument.create();
    doc.addPage([400, 400]);
    const raw = await doc.save();
    const overlay: TextOverlay = {
      id: createId(),
      kind: 'text',
      page: 1,
      x: 40,
      y: 200,
      width: 200,
      height: 20,
      rotation: 0,
      opacity: 1,
      text: 'Hello overlay',
      fontSize: 16,
      color: '#111827',
    };
    const out = await flattenOverlays(
      Uint8Array.from(raw).buffer as ArrayBuffer,
      [overlay]
    );
    expect(out.byteLength).toBeGreaterThan(100);
    const loaded = await PDFDocument.load(out);
    expect(loaded.getPageCount()).toBe(1);
  });
});
