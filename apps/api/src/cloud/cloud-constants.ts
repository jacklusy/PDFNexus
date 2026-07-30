/** Shared cloud upload/download size cap (50MB). */
export const MAX_CLOUD_FILE_BYTES = 50 * 1024 * 1024;

/** @deprecated Prefer MAX_CLOUD_FILE_BYTES */
export const MAX_DRIVE_FILE_BYTES = MAX_CLOUD_FILE_BYTES;

/**
 * PDF-only gate for cloud export (name/mime).
 * Accepts application/pdf, or a .pdf filename (even if mime is empty/octet-stream).
 * Never treats bare application/octet-stream without .pdf as PDF.
 * Callers must also verify magic bytes via {@link isPdfMagic}.
 */
export function isPdfUpload(file: {
  mimetype?: string;
  originalname?: string;
}): boolean {
  const mime = (file.mimetype || '').toLowerCase();
  const nameLower = (file.originalname || '').toLowerCase();
  if (nameLower.endsWith('.pdf')) return true;
  return mime === 'application/pdf';
}

/** True when cloud file metadata looks like a PDF. */
export function isCloudPdfMeta(meta: {
  name?: string;
  mimeType?: string;
}): boolean {
  const name = (meta.name || '').toLowerCase();
  const mime = (meta.mimeType || '').toLowerCase();
  return (
    name.endsWith('.pdf') ||
    mime === 'application/pdf' ||
    mime === 'application/x-pdf'
  );
}

/** PDF magic: first bytes are `%PDF-`. */
export function isPdfMagic(buf: Buffer | Uint8Array): boolean {
  if (!buf || buf.length < 5) return false;
  return (
    buf[0] === 0x25 && // %
    buf[1] === 0x50 && // P
    buf[2] === 0x44 && // D
    buf[3] === 0x46 && // F
    buf[4] === 0x2d // -
  );
}

/**
 * Read a fetch Response body with a hard byte cap.
 * Never buffers more than maxBytes; throws `{ code: 'TOO_LARGE' }` if exceeded,
 * or `{ code: 'EMPTY' }` if empty.
 */
export async function readCloudBodyCapped(
  res: Response,
  maxBytes: number = MAX_CLOUD_FILE_BYTES,
): Promise<Buffer> {
  const contentLength = res.headers.get('content-length');
  if (contentLength) {
    const n = Number(contentLength);
    if (Number.isFinite(n) && n > maxBytes) {
      // Cancel body if possible to free the connection
      try {
        await res.body?.cancel();
      } catch {
        /* ignore */
      }
      throw Object.assign(new Error('File exceeds cloud size limit'), {
        code: 'TOO_LARGE' as const,
      });
    }
  }

  if (!res.body) {
    const ab = await res.arrayBuffer();
    if (ab.byteLength > maxBytes) {
      throw Object.assign(new Error('File exceeds cloud size limit'), {
        code: 'TOO_LARGE' as const,
      });
    }
    if (ab.byteLength === 0) {
      throw Object.assign(new Error('Empty file'), { code: 'EMPTY' as const });
    }
    return Buffer.from(ab);
  }

  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value?.length) continue;
      total += value.length;
      if (total > maxBytes) {
        try {
          await reader.cancel();
        } catch {
          /* ignore */
        }
        throw Object.assign(new Error('File exceeds cloud size limit'), {
          code: 'TOO_LARGE' as const,
        });
      }
      chunks.push(value);
    }
  } finally {
    try {
      reader.releaseLock();
    } catch {
      /* ignore */
    }
  }

  if (total === 0) {
    throw Object.assign(new Error('Empty file'), { code: 'EMPTY' as const });
  }
  return Buffer.concat(chunks, total);
}

/**
 * OneDrive approot containment: parent id match, or path under `/Apps/{name}/`
 * (trailing slash avoids `/Apps/MyAppExtra` prefix collisions).
 */
export function isUnderOneDriveApproot(opts: {
  approotId?: string;
  approotName?: string;
  parentId?: string;
  parentPath?: string;
}): boolean {
  if (opts.approotId && opts.parentId === opts.approotId) return true;
  if (!opts.approotName || !opts.parentPath) return false;
  const marker = `/Apps/${opts.approotName}/`;
  const path = opts.parentPath;
  return path.includes(marker) || path.endsWith(`/Apps/${opts.approotName}`);
}

/** Safe Dropbox app-folder upload path from a client filename. */
export function dropboxAppFolderUploadPath(originalname?: string): string {
  const base = (originalname || 'document.pdf')
    .replace(/\\/g, '/')
    .split('/')
    .pop()!
    .replace(/^\.+/, '')
    .replace(/[^\w.\-()+ ]+/g, '_')
    .slice(0, 160);
  const name = base.toLowerCase().endsWith('.pdf')
    ? base || 'document.pdf'
    : `${base || 'document'}.pdf`;
  return `/${name}`;
}

export function isCloudTokenConnected(record: {
  refreshToken?: string;
  accessToken?: string;
  accessExpiresAt?: number;
} | null): boolean {
  if (!record) return false;
  if (record.refreshToken && record.refreshToken.length > 0) return true;
  if (
    record.accessToken &&
    record.accessExpiresAt != null &&
    record.accessExpiresAt > Date.now()
  ) {
    return true;
  }
  return false;
}
