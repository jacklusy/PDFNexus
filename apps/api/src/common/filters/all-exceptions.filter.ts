import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
  Injectable,
  Optional,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AdminErrorsService } from '../../admin/errors/admin-errors.service';
import { AdminNotificationsService } from '../../admin/notifications/admin-notifications.service';

@Catch()
@Injectable()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  constructor(
    @Optional() private readonly errors?: AdminErrorsService,
    @Optional() private readonly notifications?: AdminNotificationsService,
  ) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

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
      this.logger.error(exception.message, exception.stack);
      body = { error: 'Internal server error', code: 'INTERNAL_ERROR' };
    }

    if (status >= 500 && this.errors) {
      const message =
        exception instanceof Error ? exception.message : 'Unknown error';
      const stack = exception instanceof Error ? exception.stack : undefined;
      void this.errors
        .capture({
          source: 'http',
          message,
          stack,
          severity: status >= 500 ? 'HIGH' : 'MEDIUM',
          requestId:
            typeof request.headers['x-request-id'] === 'string'
              ? request.headers['x-request-id']
              : undefined,
          adminUserId: request.adminUser?.id,
          meta: { path: request.url, method: request.method, status },
        })
        .then(async (evt) => {
          if (
            this.notifications &&
            (evt.severity === 'HIGH' || evt.severity === 'CRITICAL')
          ) {
            await this.notifications.create({
              type: 'error.critical',
              severity: 'CRITICAL',
              title: 'Server error',
              body: message.slice(0, 300),
              meta: { errorId: evt.id },
            });
          }
        })
        .catch(() => undefined);
    }

    response.status(status).json(body);
  }
}
