/** Soft guidance only — not a hard block unless a tool already enforces a cap. */
export const SOFT_LARGE_PDF_BYTES = 80 * 1024 * 1024;

export function softLargePdfHint(byteLength: number): string | null {
  if (!Number.isFinite(byteLength) || byteLength < SOFT_LARGE_PDF_BYTES) {
    return null;
  }
  return 'This PDF is large (about 80MB+). Processing may be slow or run out of memory in the browser.';
}
