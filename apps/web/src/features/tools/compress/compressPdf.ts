/**
 * Client-side PDF compression: strip metadata + downsample/re-embed images.
 */

import { PDFDocument } from 'pdf-lib';

export type CompressPreset = 'low' | 'balanced' | 'high' | 'custom';

export interface CompressSettings {
  preset: CompressPreset;
  /** Max image dimension (longest side) in CSS pixels at target DPI. */
  maxImagePx: number;
  jpegQuality: number; // 0–1
  stripMetadata: boolean;
}

export const COMPRESS_PRESETS: Record<
  Exclude<CompressPreset, 'custom'>,
  Omit<CompressSettings, 'preset'>
> = {
  low: { maxImagePx: 2200, jpegQuality: 0.85, stripMetadata: true },
  balanced: { maxImagePx: 1600, jpegQuality: 0.72, stripMetadata: true },
  high: { maxImagePx: 1200, jpegQuality: 0.55, stripMetadata: true },
};

export function settingsForPreset(
  preset: CompressPreset,
  custom?: Partial<Omit<CompressSettings, 'preset'>>
): CompressSettings {
  if (preset === 'custom') {
    return {
      preset,
      maxImagePx: custom?.maxImagePx ?? 1600,
      jpegQuality: custom?.jpegQuality ?? 0.72,
      stripMetadata: custom?.stripMetadata ?? true,
    };
  }
  return { preset, ...COMPRESS_PRESETS[preset] };
}

export interface CompressResult {
  bytes: Uint8Array;
  originalSize: number;
  finalSize: number;
  reductionPercent: number;
  elapsedMs: number;
  settings: CompressSettings;
  imagesReencoded: number;
}

function stripInfo(doc: PDFDocument) {
  try {
    doc.setTitle('');
    doc.setAuthor('');
    doc.setSubject('');
    doc.setKeywords([]);
    doc.setProducer('');
    doc.setCreator('');
  } catch {
    // ignore
  }
}

/**
 * Main-thread compress using pdf.js render + jpeg re-embed of full pages
 * when images cannot be surgically extracted. For Phase 1 we re-rasterize
 * pages that contain large XObject images via a hybrid approach:
 * - Always strip metadata
 * - Attempt page-level recompress for high/balanced by optional raster mode
 *
 * Pure structural path: load + save with object streams via pdf-lib.
 * Image path (when `rasterizePages` true): render each page to canvas JPEG.
 */
export async function compressPdf(options: {
  bytes: ArrayBuffer;
  settings: CompressSettings;
  /** When true, rasterize every page (stronger size wins, quality loss). */
  rasterizePages?: boolean;
  renderPage?: (
    pageIndex: number,
    maxPx: number,
    quality: number
  ) => Promise<{ jpeg: Uint8Array; width: number; height: number }>;
  onProgress?: (current: number, total: number, message?: string) => void;
}): Promise<CompressResult> {
  const started = performance.now();
  const originalSize = options.bytes.byteLength;
  const { settings } = options;

  if (options.rasterizePages && options.renderPage) {
    const src = await PDFDocument.load(options.bytes.slice(0), {
      ignoreEncryption: true,
    });
    const pageCount = src.getPageCount();
    const out = await PDFDocument.create();
    if (settings.stripMetadata) stripInfo(out);

    let imagesReencoded = 0;
    for (let i = 0; i < pageCount; i++) {
      options.onProgress?.(i, pageCount, `Re-encoding page ${i + 1}`);
      const { jpeg, width, height } = await options.renderPage(
        i,
        settings.maxImagePx,
        settings.jpegQuality
      );
      const img = await out.embedJpg(jpeg);
      const page = out.addPage([width, height]);
      page.drawImage(img, { x: 0, y: 0, width, height });
      imagesReencoded += 1;
    }
    options.onProgress?.(pageCount, pageCount, 'Saving');
    const bytes = await out.save({ useObjectStreams: true });
    const finalSize = bytes.byteLength;
    return {
      bytes,
      originalSize,
      finalSize,
      reductionPercent:
        originalSize > 0
          ? Math.round(((originalSize - finalSize) / originalSize) * 1000) / 10
          : 0,
      elapsedMs: Math.round(performance.now() - started),
      settings,
      imagesReencoded,
    };
  }

  // Structural + metadata path (always available)
  options.onProgress?.(0, 2, 'Optimizing structure');
  const doc = await PDFDocument.load(options.bytes.slice(0), {
    ignoreEncryption: true,
  });
  if (settings.stripMetadata) stripInfo(doc);
  options.onProgress?.(1, 2, 'Saving');
  const bytes = await doc.save({ useObjectStreams: true });
  const finalSize = bytes.byteLength;
  options.onProgress?.(2, 2, 'Done');
  return {
    bytes,
    originalSize,
    finalSize,
    reductionPercent:
      originalSize > 0
        ? Math.round(((originalSize - finalSize) / originalSize) * 1000) / 10
        : 0,
    elapsedMs: Math.round(performance.now() - started),
    settings,
    imagesReencoded: 0,
  };
}
