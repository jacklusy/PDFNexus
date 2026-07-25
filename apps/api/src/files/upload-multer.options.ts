import { diskStorage } from 'multer';
import type { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';
import { tmpdir } from 'os';
import { randomBytes } from 'crypto';

/** Default 500MB — large merged PDFs from multi-file / high-page projects. */
export const DEFAULT_MAX_UPLOAD_BYTES = 524_288_000;

/**
 * Disk-backed multipart config so large uploads are not held entirely in RAM
 * during parse. Limit is read from env at process start (Nest ConfigService
 * is not available in decorator factories).
 */
export function buildUploadMulterOptions(
  maxBytes = Number(process.env.MAX_UPLOAD_BYTES) || DEFAULT_MAX_UPLOAD_BYTES,
): MulterOptions {
  return {
    storage: diskStorage({
      destination: (_req, _file, cb) => cb(null, tmpdir()),
      filename: (_req, file, cb) => {
        const safe = (file.originalname || 'upload').replace(
          /[^a-zA-Z0-9._-]/g,
          '_',
        );
        cb(null, `pdfnexus-${Date.now()}-${randomBytes(6).toString('hex')}-${safe}`);
      },
    }),
    limits: {
      fileSize: maxBytes,
      files: 1,
    },
  };
}
