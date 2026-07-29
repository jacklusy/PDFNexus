/**
 * Paper sizes, unit conversion, crop margins, and embed layout math (PDF points).
 */

export type LengthUnit = 'pt' | 'mm' | 'in';

export type EmbedLayoutMode = 'fit' | 'fill' | 'center' | 'stretch';

export interface SizePt {
  width: number;
  height: number;
}

export interface MarginsPt {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export interface CropRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface EmbedLayout {
  x: number;
  y: number;
  width: number;
  height: number;
  scaleX: number;
  scaleY: number;
}

/** ISO / US paper sizes in PDF points (1 pt = 1/72 in). */
export const PAPER_SIZES_PT = {
  A4: { width: 595.28, height: 841.89 },
  A3: { width: 841.89, height: 1190.55 },
  A5: { width: 419.53, height: 595.28 },
  Letter: { width: 612, height: 792 },
  Legal: { width: 612, height: 1008 },
  Tabloid: { width: 792, height: 1224 },
} as const;

export type PaperPreset = keyof typeof PAPER_SIZES_PT | 'custom';

export const PAPER_PRESET_ORDER: PaperPreset[] = [
  'A4',
  'A3',
  'A5',
  'Letter',
  'Legal',
  'Tabloid',
  'custom',
];

/** Uniform margin presets (all sides, PDF points). */
export const CROP_MARGIN_PRESETS = {
  narrow: 36,
  normal: 54,
  wide: 72,
} as const;

export type CropMarginPreset = keyof typeof CROP_MARGIN_PRESETS;

export function uniformMargins(pt: number): MarginsPt {
  return { left: pt, right: pt, top: pt, bottom: pt };
}

export function cropPresetMargins(preset: CropMarginPreset): MarginsPt {
  return uniformMargins(CROP_MARGIN_PRESETS[preset]);
}

const PT_PER_IN = 72;
const MM_PER_IN = 25.4;

export function convertLength(value: number, from: LengthUnit, to: LengthUnit): number {
  if (from === to) return value;
  const asPt =
    from === 'pt' ? value : from === 'in' ? value * PT_PER_IN : (value * PT_PER_IN) / MM_PER_IN;
  if (to === 'pt') return asPt;
  if (to === 'in') return asPt / PT_PER_IN;
  return (asPt * MM_PER_IN) / PT_PER_IN;
}

export function sizeToPt(width: number, height: number, unit: LengthUnit): SizePt {
  return {
    width: convertLength(width, unit, 'pt'),
    height: convertLength(height, unit, 'pt'),
  };
}

export function sizeFromPt(size: SizePt, unit: LengthUnit): SizePt {
  return {
    width: convertLength(size.width, 'pt', unit),
    height: convertLength(size.height, 'pt', unit),
  };
}

/**
 * Convert page margins (from each edge) into a CropBox rect.
 * Origin is bottom-left (PDF space).
 */
export function marginsToCropBox(
  mediaW: number,
  mediaH: number,
  margins: MarginsPt
): CropRect {
  const left = Math.max(0, margins.left);
  const right = Math.max(0, margins.right);
  const top = Math.max(0, margins.top);
  const bottom = Math.max(0, margins.bottom);
  const w = Math.max(1, mediaW - left - right);
  const h = Math.max(1, mediaH - top - bottom);
  return { x: left, y: bottom, w, h };
}

/** Margins implied by a crop rect inside a media box. */
export function cropBoxToMargins(
  mediaW: number,
  mediaH: number,
  crop: CropRect
): MarginsPt {
  return {
    left: Math.max(0, crop.x),
    bottom: Math.max(0, crop.y),
    right: Math.max(0, mediaW - crop.x - crop.w),
    top: Math.max(0, mediaH - crop.y - crop.h),
  };
}

/** Scale that fits source inside destination (letterbox). */
export function fitScale(srcW: number, srcH: number, destW: number, destH: number): number {
  if (srcW <= 0 || srcH <= 0 || destW <= 0 || destH <= 0) return 1;
  return Math.min(destW / srcW, destH / srcH);
}

/** Scale that fills destination (may crop / overflow). */
export function fillScale(srcW: number, srcH: number, destW: number, destH: number): number {
  if (srcW <= 0 || srcH <= 0 || destW <= 0 || destH <= 0) return 1;
  return Math.max(destW / srcW, destH / srcH);
}

/**
 * Compute drawPage placement for embedding a source page into a destination page.
 * `marginPt` insets the usable destination area on all sides.
 */
export function layoutEmbed(
  srcW: number,
  srcH: number,
  destW: number,
  destH: number,
  mode: EmbedLayoutMode,
  marginPt = 0
): EmbedLayout {
  const m = Math.max(0, marginPt);
  const availW = Math.max(1, destW - 2 * m);
  const availH = Math.max(1, destH - 2 * m);

  let scaleX: number;
  let scaleY: number;

  switch (mode) {
    case 'stretch':
      scaleX = availW / srcW;
      scaleY = availH / srcH;
      break;
    case 'fill': {
      const s = fillScale(srcW, srcH, availW, availH);
      scaleX = s;
      scaleY = s;
      break;
    }
    case 'center':
      scaleX = 1;
      scaleY = 1;
      break;
    case 'fit':
    default: {
      const s = fitScale(srcW, srcH, availW, availH);
      scaleX = s;
      scaleY = s;
      break;
    }
  }

  const width = srcW * scaleX;
  const height = srcH * scaleY;
  const x = m + (availW - width) / 2;
  const y = m + (availH - height) / 2;

  return { x, y, width, height, scaleX, scaleY };
}

export function resolvePaperSize(
  preset: PaperPreset,
  custom?: SizePt,
  unit: LengthUnit = 'pt'
): SizePt {
  if (preset === 'custom') {
    if (!custom) throw new Error('Custom paper size requires width and height.');
    return sizeToPt(custom.width, custom.height, unit);
  }
  return { ...PAPER_SIZES_PT[preset] };
}
