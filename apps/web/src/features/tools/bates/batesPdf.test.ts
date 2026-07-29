import { describe, it, expect } from 'vitest';
import { formatBatesNumber } from './batesPdf';

describe('formatBatesNumber', () => {
  it('zero-pads to width with prefix and suffix', () => {
    expect(formatBatesNumber(1, 6, 'CASE-', '')).toBe('CASE-000001');
    expect(formatBatesNumber(42, 4, '', '-A')).toBe('0042-A');
  });

  it('uses at least width 1 and floors non-integers', () => {
    expect(formatBatesNumber(7.9, 0.5, 'P', '')).toBe('P7');
    expect(formatBatesNumber(-3, 3, '', '')).toBe('000');
  });
});
