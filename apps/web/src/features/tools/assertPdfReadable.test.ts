import { describe, it, expect } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import {
  assertPdfReadable,
  PdfEncryptedError,
  sanitizeToolkitError,
} from './assertPdfReadable';

describe('assertPdfReadable', () => {
  it('accepts an unencrypted PDF', async () => {
    const doc = await PDFDocument.create();
    doc.addPage();
    const bytes = await doc.save();
    await expect(
      assertPdfReadable(Uint8Array.from(bytes).buffer as ArrayBuffer)
    ).resolves.toBeUndefined();
  });

  it('sanitizeToolkitError redacts password flags', () => {
    const msg = sanitizeToolkitError(
      new Error('qpdf failed --password=secret123 --user-password=abc')
    );
    expect(msg).not.toContain('secret123');
    expect(msg).not.toContain('abc');
    // When the scrubbed message still looks like an auth failure, return a safe generic copy.
    expect(msg).toMatch(/password/i);
    expect(msg).toBe('Invalid password. Enter the correct password for this PDF.');
  });

  it('sanitizeToolkitError keeps scrubbed *** when not an auth failure', () => {
    const msg = sanitizeToolkitError(
      new Error('qpdf warning --password=secret123 ignored')
    );
    expect(msg).not.toContain('secret123');
    expect(msg).toMatch(/\*\*\*/);
  });
});

describe('PdfEncryptedError', () => {
  it('points users to unlock', () => {
    const err = new PdfEncryptedError();
    expect(err.message).toMatch(/unlock-pdf/);
  });
});
