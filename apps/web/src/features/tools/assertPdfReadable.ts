import { PDFDocument } from 'pdf-lib';

export class PdfEncryptedError extends Error {
  constructor(
    message = 'This PDF is password-protected. Unlock it first at /unlock-pdf, then try again.'
  ) {
    super(message);
    this.name = 'PdfEncryptedError';
  }
}

/**
 * Load a PDF for local tools. Refuses encrypted documents (pdf-lib cannot decrypt).
 * Protect/Unlock use pdfstudio separately and must not call this.
 */
export async function loadReadablePdf(bytes: ArrayBuffer): Promise<PDFDocument> {
  await assertPdfReadable(bytes);
  return PDFDocument.load(bytes.slice(0));
}

/**
 * Detect encryption without producing a usable document for processing.
 * Uses a probe load; if encryption is present, throws PdfEncryptedError.
 */
export async function assertPdfReadable(bytes: ArrayBuffer): Promise<void> {
  try {
    await PDFDocument.load(bytes.slice(0), { ignoreEncryption: false });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (
      /encrypt|password|permissions|is encrypted/i.test(msg) ||
      /Input document to.*encrypt/i.test(msg)
    ) {
      throw new PdfEncryptedError();
    }
    // Some encrypted PDFs throw differently — probe with ignoreEncryption
    // then inspect Encrypt dict via low-level API.
    try {
      const probe = await PDFDocument.load(bytes.slice(0), {
        ignoreEncryption: true,
      });
      const catalog = (probe as unknown as { catalog?: { dict?: { lookup?: (k: unknown) => unknown } } }).catalog;
      // Fallback: check raw bytes for /Encrypt near trailer (heuristic)
      void catalog;
      const head = new TextDecoder('latin1').decode(
        new Uint8Array(bytes).subarray(0, Math.min(bytes.byteLength, 4096))
      );
      const tail = new TextDecoder('latin1').decode(
        new Uint8Array(bytes).subarray(Math.max(0, bytes.byteLength - 8192))
      );
      if (/\/Encrypt[\s\/]/.test(head + tail)) {
        throw new PdfEncryptedError();
      }
    } catch (inner) {
      if (inner instanceof PdfEncryptedError) throw inner;
      throw err instanceof Error ? err : new Error(msg);
    }
  }
}

/** Sanitize toolkit errors so passwords in CLI args never reach the UI. */
export function sanitizeToolkitError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  const scrubbed = raw
    .replace(/--(?:user|owner|)?password=[^\s]+/gi, '--password=***')
    .replace(/password[=:]\s*\S+/gi, 'password=***');
  if (/password/i.test(scrubbed) && /invalid|incorrect|wrong|fail/i.test(scrubbed)) {
    return 'Invalid password. Enter the correct password for this PDF.';
  }
  if (scrubbed.length > 240) return scrubbed.slice(0, 240) + '…';
  return scrubbed || 'Something went wrong while processing the PDF.';
}
