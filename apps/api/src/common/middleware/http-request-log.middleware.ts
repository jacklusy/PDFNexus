import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { CookieService } from '../../auth/cookie.service';
import { AdminCookieService } from '../../admin/auth/admin-cookie.service';
import { hashToken } from '../../admin/auth/admin-crypto';

const SKIP_PREFIXES = ['/api/health', '/api/ready'];
const SENSITIVE_KEYS = new Set([
  'password',
  'currentpassword',
  'newpassword',
  'code',
  'token',
  'otp',
  'authorization',
  'cookie',
  'smtp_pass',
  'apikey',
  'api_key',
  'secret',
]);

function redact(value: unknown, depth = 0): unknown {
  if (depth > 4) return '[truncated]';
  if (value == null) return value;
  if (Array.isArray(value)) return value.slice(0, 20).map((v) => redact(v, depth + 1));
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_KEYS.has(k.toLowerCase())) {
        out[k] = '[redacted]';
      } else {
        out[k] = redact(v, depth + 1);
      }
    }
    return out;
  }
  if (typeof value === 'string' && value.length > 500) {
    return `${value.slice(0, 500)}…`;
  }
  return value;
}

function parseUa(ua: string | undefined) {
  if (!ua) return { browser: null, os: null, deviceType: null as string | null };
  const lower = ua.toLowerCase();
  let browser = 'unknown';
  if (lower.includes('edg/')) browser = 'Edge';
  else if (lower.includes('chrome/')) browser = 'Chrome';
  else if (lower.includes('firefox/')) browser = 'Firefox';
  else if (lower.includes('safari/') && !lower.includes('chrome')) browser = 'Safari';

  let os = 'unknown';
  if (lower.includes('windows')) os = 'Windows';
  else if (lower.includes('mac os') || lower.includes('macos')) os = 'macOS';
  else if (lower.includes('android')) os = 'Android';
  else if (lower.includes('iphone') || lower.includes('ipad')) os = 'iOS';
  else if (lower.includes('linux')) os = 'Linux';

  let deviceType = 'desktop';
  if (lower.includes('mobile') || lower.includes('iphone') || lower.includes('android')) {
    deviceType = 'mobile';
  } else if (lower.includes('ipad') || lower.includes('tablet')) {
    deviceType = 'tablet';
  }

  return { browser, os, deviceType };
}

@Injectable()
export class HttpRequestLogMiddleware implements NestMiddleware {
  private readonly logger = new Logger(HttpRequestLogMiddleware.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly productCookies: CookieService,
    private readonly adminCookies: AdminCookieService,
  ) {}

  use(req: Request, res: Response, next: NextFunction): void {
    const path = req.originalUrl?.split('?')[0] || req.path || '';
    if (SKIP_PREFIXES.some((p) => path.startsWith(p))) {
      next();
      return;
    }

    const requestId =
      (typeof req.headers['x-request-id'] === 'string' &&
        req.headers['x-request-id']) ||
      randomUUID();
    res.setHeader('x-request-id', requestId);
    const started = Date.now();

    res.on('finish', () => {
      void this.persist(req, res, requestId, started).catch((err) => {
        this.logger.warn(
          `Failed to persist request log: ${err instanceof Error ? err.message : err}`,
        );
      });
    });

    next();
  }

  private async persist(
    req: Request,
    res: Response,
    requestId: string,
    started: number,
  ) {
    const path = req.originalUrl?.split('?')[0] || req.url || '';
    const ua = req.headers['user-agent'];
    const { browser, os, deviceType } = parseUa(
      typeof ua === 'string' ? ua : undefined,
    );

    let adminUserId: string | null = null;
    try {
      const raw = this.adminCookies.readRawToken(req);
      if (raw) {
        const session = await this.prisma.adminSession.findUnique({
          where: { tokenHash: hashToken(raw) },
          select: { userId: true, revokedAt: true, expiresAt: true },
        });
        if (
          session &&
          !session.revokedAt &&
          session.expiresAt.getTime() > Date.now()
        ) {
          adminUserId = session.userId;
        }
      }
    } catch {
      // ignore
    }

    const userEmail = this.productCookies.readVerifiedEmail(req);
    let bodySummary: string | null = null;
    if (req.body && typeof req.body === 'object' && !(req.body as { buffer?: Buffer }).buffer) {
      try {
        bodySummary = JSON.stringify(redact(req.body)).slice(0, 2000);
      } catch {
        bodySummary = null;
      }
    }

    const forwarded = req.headers['x-forwarded-for'];
    const ip =
      typeof forwarded === 'string'
        ? forwarded.split(',')[0].trim()
        : req.socket.remoteAddress || null;

    await this.prisma.httpRequestLog.create({
      data: {
        requestId,
        userEmail,
        adminUserId,
        ip,
        method: req.method,
        path,
        route: req.route?.path ? String(req.route.path) : null,
        query: req.query && Object.keys(req.query).length
          ? JSON.stringify(redact(req.query)).slice(0, 1000)
          : null,
        bodySummary,
        statusCode: res.statusCode,
        durationMs: Date.now() - started,
        userAgent: typeof ua === 'string' ? ua.slice(0, 512) : null,
        browser,
        os,
        deviceType,
        referrer:
          typeof req.headers.referer === 'string'
            ? req.headers.referer.slice(0, 512)
            : null,
        authStatus: adminUserId
          ? 'admin'
          : userEmail
            ? 'verified_user'
            : 'anonymous',
        requestBytes: req.headers['content-length']
          ? Number(req.headers['content-length'])
          : null,
        responseBytes: res.getHeader('content-length')
          ? Number(res.getHeader('content-length'))
          : null,
        errorMessage:
          res.statusCode >= 400
            ? `HTTP ${res.statusCode}`
            : null,
      },
    });
  }
}
