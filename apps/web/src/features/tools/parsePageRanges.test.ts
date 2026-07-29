import { describe, it, expect } from 'vitest';
import {
  parsePageRanges,
  PageRangeError,
  chunkEveryN,
  individualPageRanges,
} from './parsePageRanges';

describe('parsePageRanges', () => {
  it('parses singles and ranges', () => {
    expect(parsePageRanges('1, 3, 5-8', { pageCount: 12 })).toEqual([
      1, 3, 5, 6, 7, 8,
    ]);
  });

  it('rejects overlaps by default', () => {
    expect(() => parsePageRanges('1-3,2', { pageCount: 5 })).toThrow(PageRangeError);
  });

  it('rejects out of range', () => {
    expect(() => parsePageRanges('1-99', { pageCount: 10 })).toThrow(/outside/);
  });

  it('rejects empty', () => {
    expect(() => parsePageRanges('  ', { pageCount: 3 })).toThrow(/at least one/);
  });
});

describe('chunkEveryN / individual', () => {
  it('chunks every N', () => {
    expect(chunkEveryN(10, 3)).toEqual([
      { start: 1, end: 3 },
      { start: 4, end: 6 },
      { start: 7, end: 9 },
      { start: 10, end: 10 },
    ]);
  });

  it('individual pages', () => {
    expect(individualPageRanges(3)).toEqual([
      { start: 1, end: 1 },
      { start: 2, end: 2 },
      { start: 3, end: 3 },
    ]);
  });
});
