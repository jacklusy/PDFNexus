import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';

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

    if (exception instanceof HttpException) {
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
