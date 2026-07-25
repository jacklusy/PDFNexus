import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import { MulterError } from 'multer';
import { DEFAULT_MAX_UPLOAD_BYTES } from '../../files/upload-multer.options';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let body: Record<string, unknown> = {
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
    };

    if (exception instanceof MulterError) {
      if (exception.code === 'LIMIT_FILE_SIZE') {
        const max =
          Number(process.env.MAX_UPLOAD_BYTES) || DEFAULT_MAX_UPLOAD_BYTES;
        const mb = Math.round(max / (1024 * 1024));
        status = HttpStatus.PAYLOAD_TOO_LARGE;
        body = {
          error: `File exceeds ${mb}MB limit`,
          code: 'FILE_TOO_LARGE',
        };
      } else {
        status = HttpStatus.BAD_REQUEST;
        body = {
          error: exception.message || 'Invalid upload',
          code: 'FILE_INVALID',
        };
      }
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exResponse = exception.getResponse();
      if (typeof exResponse === 'string') {
        body = { error: exResponse };
      } else if (typeof exResponse === 'object' && exResponse !== null) {
        body = exResponse as Record<string, unknown>;
      }
    } else if (exception instanceof Error) {
      this.logger.error(exception.message);
      body = { error: 'Internal server error', code: 'INTERNAL_ERROR' };
    }

    response.status(status).json(body);
  }
}
