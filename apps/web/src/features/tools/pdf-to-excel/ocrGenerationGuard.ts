/**
 * Generation guard for async OCR / detect races.
 * Bump on file change or new request; ignore results when stale.
 */
export function createGenerationGuard() {
  let gen = 0;
  return {
    bump(): number {
      gen += 1;
      return gen;
    },
    current(): number {
      return gen;
    },
    isCurrent(token: number): boolean {
      return token === gen;
    },
  };
}
