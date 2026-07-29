import { describe, it, expect } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { compressPdf, settingsForPreset } from './compressPdf';

describe('compressPdf', () => {
  it('reports measured sizes after structural save', async () => {
    const doc = await PDFDocument.create();
    doc.addPage([200, 200]);
    doc.setTitle('Secret');
    const raw = await doc.save();
    const result = await compressPdf({
      bytes: Uint8Array.from(raw).buffer as ArrayBuffer,
      settings: settingsForPreset('balanced'),
      rasterizePages: false,
    });
    expect(result.originalSize).toBe(raw.byteLength);
    expect(result.finalSize).toBe(result.bytes.byteLength);
    expect(typeof result.reductionPercent).toBe('number');
    expect(result.elapsedMs).toBeGreaterThanOrEqual(0);
    expect(result.settings.preset).toBe('balanced');
  });
});
