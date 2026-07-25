import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ErrorCodes } from '@pdfnexus/shared';
import type { Request } from 'express';

@Injectable()
export class SameOriginGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const origin = req.headers.origin;
    const referer = req.headers.referer;

    if (!origin && !referer) {
      throw new ForbiddenException({
        error: 'Origin required',
        code: ErrorCodes.ORIGIN_REQUIRED,
        fallback: true,
      });
    }

    let requestOrigin: string | null = null;
    try {
      if (origin) requestOrigin = new URL(origin).origin;
      else if (referer) requestOrigin = new URL(referer).origin;
    } catch {
      throw new ForbiddenException({
        error: 'Invalid origin',
        code: ErrorCodes.ORIGIN_INVALID,
        fallback: true,
      });
    }

    const allowed =
      this.config.get<string[]>('allowedOrigins') ??
      (this.config.get<string>('ALLOWED_ORIGINS') || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

    const defaults = [
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      this.config.get<string>('APP_URL'),
    ].filter(Boolean) as string[];

    const allowSet = new Set([...defaults, ...allowed]);
    // Normalize APP_URL to origin
    for (const d of [...allowSet]) {
      try {
        allowSet.add(new URL(d).origin);
      } catch {
        // skip
      }
    }

    if (requestOrigin && !allowSet.has(requestOrigin)) {
      throw new ForbiddenException({
        error: 'Origin not allowed',
        code: ErrorCodes.ORIGIN_FORBIDDEN,
        fallback: true,
      });
    }

    return true;
  }
}
