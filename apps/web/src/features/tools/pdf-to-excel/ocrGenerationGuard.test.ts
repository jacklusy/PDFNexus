import { describe, expect, it } from 'vitest';
import { createGenerationGuard } from './ocrGenerationGuard';

describe('createGenerationGuard', () => {
  it('ignores stale OCR generations after a bump', async () => {
    const guard = createGenerationGuard();
    const first = guard.bump();

    const stale = new Promise<{ tables: number }>((resolve) => {
      setTimeout(() => resolve({ tables: 1 }), 30);
    });

    // File change invalidates in-flight OCR.
    guard.bump();

    const result = await stale;
    expect(guard.isCurrent(first)).toBe(false);
    expect(result.tables).toBe(1);
  });

  it('accepts the current generation', () => {
    const guard = createGenerationGuard();
    const token = guard.bump();
    expect(guard.isCurrent(token)).toBe(true);
    expect(guard.current()).toBe(token);
  });
});
