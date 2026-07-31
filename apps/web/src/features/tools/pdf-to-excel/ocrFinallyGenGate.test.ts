import { describe, expect, it } from 'vitest';
import { createGenerationGuard } from './ocrGenerationGuard';

describe('OCR finally gen-gate pattern', () => {
  it('stale generation must not clear busy owned by a newer run', () => {
    const guard = createGenerationGuard();
    const first = guard.bump();
    let busy = true;
    let ocrBusy = true;

    // Newer detect/OCR starts
    guard.bump();

    // Stale OCR finally
    if (guard.isCurrent(first)) {
      busy = false;
      ocrBusy = false;
    }

    expect(busy).toBe(true);
    expect(ocrBusy).toBe(true);
  });

  it('current generation may clear busy', () => {
    const guard = createGenerationGuard();
    const gen = guard.bump();
    let busy = true;
    if (guard.isCurrent(gen)) busy = false;
    expect(busy).toBe(false);
  });
});
