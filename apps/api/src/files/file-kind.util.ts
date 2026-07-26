import { BadRequestException } from '@nestjs/common';
import { FileKind } from '@prisma/client';
import { ErrorCodes } from '@pdfnexus/shared';

const PDF_MIME = new Set(['application/pdf']);
const DOCX_MIME = new Set([
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/docx',
]);

export interface DetectedFileKind {
  kind: FileKind;
  contentType: string;
  extension: 'pdf' | 'docx';
}

export function detectFileKind(
  mime: string,
  originalName: string,
): DetectedFileKind {
  const lower = (mime || '').toLowerCase();
  const name = (originalName || '').toLowerCase();

  if (PDF_MIME.has(lower) || name.endsWith('.pdf')) {
    return {
      kind: FileKind.MERGED_PDF,
      contentType: 'application/pdf',
      extension: 'pdf',
    };
  }
  if (
    DOCX_MIME.has(lower) ||
    name.endsWith('.docx') ||
    lower.includes('wordprocessingml')
  ) {
    return {
      kind: FileKind.DOCX,
      contentType:
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      extension: 'docx',
    };
  }
  throw new BadRequestException({
    error: 'Only PDF and DOCX uploads are allowed',
    code: ErrorCodes.FILE_INVALID,
  });
}

/**
 * ASCII slug of a filename base for use inside storage keys. The original
 * name is preserved verbatim only in the database.
 */
export function sanitizeFileBaseName(originalName: string): string {
  const base = (originalName || '')
    .replace(/\.[a-zA-Z0-9]+$/, '')
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '')
    .slice(0, 64);
  return base || 'document';
}

/**
 * Magic-byte validation of the first bytes of a completed upload.
 * PDF: "%PDF-"; DOCX: ZIP local file header "PK\x03\x04".
 */
export function matchesMagicBytes(kind: FileKind, header: Buffer): boolean {
  if (kind === FileKind.MERGED_PDF) {
    return header.subarray(0, 5).toString('latin1') === '%PDF-';
  }
  return (
    header.length >= 4 &&
    header[0] === 0x50 &&
    header[1] === 0x4b &&
    header[2] === 0x03 &&
    header[3] === 0x04
  );
}
