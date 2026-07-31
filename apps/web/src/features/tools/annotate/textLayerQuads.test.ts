import { describe, expect, it } from 'vitest';
import {
  quadsIntersectingRect,
  rectsIntersect,
  spansFromTextItems,
  unionQuadBounds,
} from './textLayerQuads';

describe('textLayerQuads', () => {
  it('maps pdf.js-like items to spans', () => {
    const spans = spansFromTextItems([
      { str: 'Hello', transform: [1, 0, 0, 12, 72, 700], width: 30, height: 12 },
      { str: '  ', transform: [1, 0, 0, 12, 100, 700] },
    ]);
    expect(spans).toHaveLength(1);
    expect(spans[0].str).toBe('Hello');
    expect(spans[0].x).toBe(72);
    expect(spans[0].y).toBe(700);
  });

  it('detects intersecting rects', () => {
    expect(
      rectsIntersect(
        { x: 0, y: 0, width: 10, height: 10 },
        { x: 5, y: 5, width: 10, height: 10 }
      )
    ).toBe(true);
    expect(
      rectsIntersect(
        { x: 0, y: 0, width: 10, height: 10 },
        { x: 20, y: 20, width: 5, height: 5 }
      )
    ).toBe(false);
  });

  it('selects quads intersecting a selection', () => {
    const spans = [
      { str: 'a', x: 10, y: 10, width: 20, height: 12 },
      { str: 'b', x: 100, y: 100, width: 20, height: 12 },
    ];
    const quads = quadsIntersectingRect(spans, {
      x: 0,
      y: 0,
      width: 40,
      height: 40,
    });
    expect(quads).toHaveLength(1);
    expect(quads[0].x).toBe(10);
  });

  it('unions quad bounds', () => {
    const u = unionQuadBounds([
      { x: 10, y: 20, width: 30, height: 10 },
      { x: 50, y: 15, width: 10, height: 20 },
    ]);
    expect(u).toEqual({ x: 10, y: 15, width: 50, height: 20 });
    expect(unionQuadBounds([])).toBeNull();
  });
});
