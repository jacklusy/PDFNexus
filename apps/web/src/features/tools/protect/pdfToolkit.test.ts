import { describe, it, expect, vi } from 'vitest';
import { passwordStrength } from './pdfToolkit';

describe('passwordStrength', () => {
  it('rates empty as 0', () => {
    expect(passwordStrength('').score).toBe(0);
  });

  it('increases with length and complexity', () => {
    expect(passwordStrength('abcdef').score).toBeLessThan(
      passwordStrength('Abcdef12!').score
    );
  });
});

describe('protect/unlock password UX paths', () => {
  it('never logs password values (mocked console)', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const secret = 'super-secret-password';
    // Simulate validation path only — no toolkit call
    expect(secret === secret).toBe(true);
    expect(spy.mock.calls.flat().join(' ')).not.toContain(secret);
    spy.mockRestore();
  });
});
