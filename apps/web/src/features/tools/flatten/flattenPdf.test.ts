import { describe, it, expect } from 'vitest';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import {
  flattenPdf,
  FLATTEN_WARNING,
  shouldRefuseFlattenDownload,
} from './flattenPdf';
import { cropPdf } from '../crop/cropPdf';
import { resizePdf } from '../resize/resizePdf';
import { PAPER_SIZES_PT } from '../pageGeometry';

async function samplePdf(): Promise<ArrayBuffer> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([400, 400]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  page.drawText('Hello', { x: 50, y: 200, size: 18, font, color: rgb(0, 0, 0) });
  const bytes = await doc.save();
  return Uint8Array.from(bytes).buffer as ArrayBuffer;
}

describe('shouldRefuseFlattenDownload', () => {
  it('refuses when annotations failed and partial not allowed', () => {
    expect(
      shouldRefuseFlattenDownload(
        { annotationError: 'qpdf failed', annotationsFlattened: false },
        false
      )
    ).toBe(true);
  });

  it('allows forms-only when user opts in', () => {
    expect(
      shouldRefuseFlattenDownload(
        { annotationError: 'qpdf failed', annotationsFlattened: false },
        true
      )
    ).toBe(false);
  });

  it('allows when annotations flattened', () => {
    expect(
      shouldRefuseFlattenDownload(
        { annotationError: undefined, annotationsFlattened: true },
        false
      )
    ).toBe(false);
  });
});

describe('flattenPdf', () => {
  it('returns bytes and warning for a plain PDF', async () => {
    const result = await flattenPdf(await samplePdf());
    expect(result.bytes.byteLength).toBeGreaterThan(100);
    expect(result.warning).toBe(FLATTEN_WARNING);
  });
});

describe('cropPdf / resizePdf smoke', () => {
  it('crops with margins', async () => {
    const out = await cropPdf({
      bytes: await samplePdf(),
      margins: { left: 20, right: 20, top: 20, bottom: 20 },
    });
    expect(out.byteLength).toBeGreaterThan(50);
  });

  it('resizes to Letter fit', async () => {
    const letter = PAPER_SIZES_PT.Letter;
    const out = await resizePdf({
      bytes: await samplePdf(),
      target: { width: letter.width, height: letter.height },
      mode: 'fit',
      marginPt: 0,
    });
    expect(out.byteLength).toBeGreaterThan(50);
  });
});
