import { describe, expect, it } from 'vitest';
import { findPhraseMatchesInText } from './redactPdf';

describe('findPhraseMatchesInText (redaction verification)', () => {
  it('fails verification when redacted phrase remains', () => {
    const matches = findPhraseMatchesInText(
      1,
      'Before SECRET-TOKEN-42 after',
      ['SECRET-TOKEN-42']
    );
    expect(matches.length).toBe(1);
    expect(matches[0].phrase).toBe('SECRET-TOKEN-42');
    expect(matches[0].page).toBe(1);
  });

  it('passes when phrase is gone', () => {
    const matches = findPhraseMatchesInText(1, 'Public content only', [
      'SECRET-TOKEN-42',
    ]);
    expect(matches).toEqual([]);
  });
});
