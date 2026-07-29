import { describe, it, expect } from 'vitest';
import {
  marginsToCropBox,
  cropBoxToMargins,
  fitScale,
  fillScale,
  layoutEmbed,
  convertLength,
  cropPresetMargins,
  CROP_MARGIN_PRESETS,
  PAPER_SIZES_PT,
} from './pageGeometry';

describe('convertLength', () => {
  it('converts pt ↔ in ↔ mm', () => {
    expect(convertLength(72, 'pt', 'in')).toBeCloseTo(1, 6);
    expect(convertLength(1, 'in', 'pt')).toBeCloseTo(72, 6);
    expect(convertLength(25.4, 'mm', 'in')).toBeCloseTo(1, 5);
    expect(convertLength(1, 'in', 'mm')).toBeCloseTo(25.4, 5);
  });
});

describe('marginsToCropBox', () => {
  it('builds a crop rect from margins (bottom-left origin)', () => {
    const mediaW = 612;
    const mediaH = 792;
    const crop = marginsToCropBox(mediaW, mediaH, {
      left: 36,
      right: 72,
      top: 54,
      bottom: 18,
    });
    expect(crop).toEqual({ x: 36, y: 18, w: 612 - 36 - 72, h: 792 - 54 - 18 });
  });

  it('round-trips with cropBoxToMargins', () => {
    const mediaW = PAPER_SIZES_PT.A4.width;
    const mediaH = PAPER_SIZES_PT.A4.height;
    const margins = cropPresetMargins('normal');
    const crop = marginsToCropBox(mediaW, mediaH, margins);
    expect(cropBoxToMargins(mediaW, mediaH, crop)).toEqual(margins);
  });

  it('clamps to at least 1×1 when margins exceed media', () => {
    const crop = marginsToCropBox(100, 100, {
      left: 80,
      right: 80,
      top: 80,
      bottom: 80,
    });
    expect(crop.w).toBe(1);
    expect(crop.h).toBe(1);
  });
});

describe('fitScale / fillScale', () => {
  it('fit uses the smaller scale (letterbox)', () => {
    expect(fitScale(200, 100, 100, 100)).toBeCloseTo(0.5);
    expect(fitScale(100, 200, 100, 100)).toBeCloseTo(0.5);
  });

  it('fill uses the larger scale (cover)', () => {
    expect(fillScale(200, 100, 100, 100)).toBeCloseTo(1);
    expect(fillScale(100, 200, 100, 100)).toBeCloseTo(1);
  });
});

describe('layoutEmbed', () => {
  it('fit centers content inside margins', () => {
    const layout = layoutEmbed(200, 100, 400, 400, 'fit', 20);
    // avail 360×360 → scale 360/200 = 1.8
    expect(layout.scaleX).toBeCloseTo(1.8);
    expect(layout.width).toBeCloseTo(360);
    expect(layout.height).toBeCloseTo(180);
    expect(layout.x).toBeCloseTo(20);
    expect(layout.y).toBeCloseTo(20 + (360 - 180) / 2);
  });

  it('fill covers the available area', () => {
    const layout = layoutEmbed(200, 100, 200, 200, 'fill', 0);
    expect(layout.scaleX).toBeCloseTo(2);
    expect(layout.width).toBeCloseTo(400);
    expect(layout.height).toBeCloseTo(200);
    expect(layout.x).toBeCloseTo(-100);
    expect(layout.y).toBeCloseTo(0);
  });

  it('center preserves 1:1 size', () => {
    const layout = layoutEmbed(100, 50, 400, 400, 'center', 10);
    expect(layout.width).toBe(100);
    expect(layout.height).toBe(50);
    expect(layout.x).toBeCloseTo(10 + (380 - 100) / 2);
  });

  it('stretch independently scales axes', () => {
    const layout = layoutEmbed(100, 50, 300, 200, 'stretch', 0);
    expect(layout.width).toBeCloseTo(300);
    expect(layout.height).toBeCloseTo(200);
    expect(layout.scaleX).toBeCloseTo(3);
    expect(layout.scaleY).toBeCloseTo(4);
  });
});

describe('crop presets', () => {
  it('exposes narrow / normal / wide margins', () => {
    expect(CROP_MARGIN_PRESETS.narrow).toBe(36);
    expect(CROP_MARGIN_PRESETS.normal).toBe(54);
    expect(CROP_MARGIN_PRESETS.wide).toBe(72);
    expect(cropPresetMargins('wide')).toEqual({
      left: 72,
      right: 72,
      top: 72,
      bottom: 72,
    });
  });
});
