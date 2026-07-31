import { describe, expect, it } from 'vitest';
import { createGenerationGuard } from './ocrGenerationGuard';

/**
 * Mirrors PdfToExcelTool OCR abort early-return: clear progress only when gen is current.
 */
function clearProgressOnAbortEarlyReturn(options: {
  isCurrent: boolean;
  setProgress: (v: string | null) => void;
}): void {
  if (options.isCurrent) options.setProgress(null);
}

describe('OCR abort early-return progress clear', () => {
  it('clears progress when generation is current', () => {
    const guard = createGenerationGuard();
    const gen = guard.bump();
    let progress: string | null = 'Cancelling…';
    clearProgressOnAbortEarlyReturn({
      isCurrent: guard.isCurrent(gen),
      setProgress: (v) => {
        progress = v;
      },
    });
    expect(progress).toBeNull();
  });

  it('does not clear progress owned by a newer generation', () => {
    const guard = createGenerationGuard();
    const first = guard.bump();
    guard.bump();
    let progress: string | null = 'OCR page 1…';
    clearProgressOnAbortEarlyReturn({
      isCurrent: guard.isCurrent(first),
      setProgress: (v) => {
        progress = v;
      },
    });
    expect(progress).toBe('OCR page 1…');
  });
});
