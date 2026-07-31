import { describe, it, expect } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { flattenOverlays } from './flattenOverlays';
import { createId, type CalloutOverlay, type TextOverlay } from './types';
import { uint8ToArrayBuffer } from '@/features/files/localDownload';

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
    const out = await flattenOverlays(uint8ToArrayBuffer(raw), [overlay]);
    expect(out.byteLength).toBeGreaterThan(100);
    const loaded = await PDFDocument.load(out);
    expect(loaded.getPageCount()).toBe(1);
  });

  it('smokes callout overlay flatten', async () => {
    const doc = await PDFDocument.create();
    doc.addPage([400, 400]);
    const raw = await doc.save();
    const callout: CalloutOverlay = {
      id: createId(),
      kind: 'callout',
      page: 1,
      x: 80,
      y: 200,
      width: 160,
      height: 60,
      rotation: 0,
      opacity: 1,
      text: 'Note',
      fontSize: 12,
      color: '#78350f',
      stroke: '#b45309',
      fill: '#fffbeb',
      strokeWidth: 1.5,
      leaderX: 40,
      leaderY: 230,
    };
    const out = await flattenOverlays(uint8ToArrayBuffer(raw), [callout]);
    expect(out.byteLength).toBeGreaterThan(100);
  });
});
