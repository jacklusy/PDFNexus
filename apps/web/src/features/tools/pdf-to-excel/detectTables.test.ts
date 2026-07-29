import { describe, it, expect } from 'vitest';
import { detectTablesFromTextItems } from './detectTables';

/** Helper: pdf.js-like text item at (x, y). */
function item(str: string, x: number, y: number, w = 40) {
  return {
    str,
    transform: [1, 0, 0, 10, x, y],
    width: w,
    height: 10,
  };
}

describe('detectTablesFromTextItems', () => {
  it('detects a simple 2×2 grid from fake text items', () => {
    const items = [
      item('A1', 10, 100),
      item('B1', 80, 100),
      item('A2', 10, 80),
      item('B2', 80, 80),
    ];
    const tables = detectTablesFromTextItems(1, items);
    expect(tables.length).toBeGreaterThanOrEqual(1);
    expect(tables[0].page).toBe(1);
    expect(tables[0].rows.length).toBeGreaterThanOrEqual(2);
    expect(tables[0].rows[0].length).toBeGreaterThanOrEqual(2);
  });

  it('returns empty for sparse items', () => {
    expect(detectTablesFromTextItems(1, [item('only', 0, 0)])).toEqual([]);
  });
});
