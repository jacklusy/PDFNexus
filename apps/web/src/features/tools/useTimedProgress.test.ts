import { describe, expect, it } from 'vitest';
import { formatElapsed } from './useTimedProgress';

describe('formatElapsed', () => {
  it('formats mm:ss from milliseconds', () => {
    expect(formatElapsed(0)).toBe('00:00');
    expect(formatElapsed(1_000)).toBe('00:01');
    expect(formatElapsed(65_000)).toBe('01:05');
    expect(formatElapsed(3_661_000)).toBe('61:01');
  });

  it('clamps negative values', () => {
    expect(formatElapsed(-500)).toBe('00:00');
  });
});
