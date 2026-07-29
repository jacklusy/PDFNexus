/**
 * Lazy pdfstudio (qpdf.wasm) loader. Passwords are never logged.
 */

let toolkitPromise: Promise<
  import('pdfstudio').PdfToolkit
> | null = null;

export async function getPdfToolkit() {
  if (!toolkitPromise) {
    toolkitPromise = (async () => {
      try {
        const { createPdfToolkit } = await import('pdfstudio');
        return await createPdfToolkit({
          wasmUrl: '/qpdf.wasm',
        });
      } catch (err) {
        toolkitPromise = null;
        throw err;
      }
    })();
  }
  return toolkitPromise;
}

/** Drop local password string references after use (JS strings are immutable). */
export function clearPassword(_value: string): void {
  void _value;
}

export function passwordStrength(password: string): {
  score: 0 | 1 | 2 | 3 | 4;
  label: string;
} {
  if (!password) return { score: 0, label: 'Enter a password' };
  let score = 0 as 0 | 1 | 2 | 3 | 4;
  if (password.length >= 8) score = 1;
  if (password.length >= 12) score = 2;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password))
    score = Math.max(score, 2) as 0 | 1 | 2 | 3 | 4;
  if (/\d/.test(password)) score = Math.min(4, score + 1) as 0 | 1 | 2 | 3 | 4;
  if (/[^A-Za-z0-9]/.test(password))
    score = Math.min(4, score + 1) as 0 | 1 | 2 | 3 | 4;
  const labels = ['Very weak', 'Weak', 'Fair', 'Good', 'Strong'] as const;
  return { score, label: labels[score] };
}
