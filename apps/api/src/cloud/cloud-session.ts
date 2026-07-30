import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';
import type { Request, Response } from 'express';
import { ErrorCodes } from '@pdfnexus/shared';
import { CookieService } from '../auth/cookie.service';
import type { CloudProviderId } from './cloud-provider';

const SESSION_COOKIES: Record<CloudProviderId, string> = {
  drive: 'drive_session',
  dropbox: 'dropbox_session',
  onedrive: 'onedrive_session',
};

export function cloudSessionCookieName(provider: CloudProviderId): string {
  return SESSION_COOKIES[provider];
}

export class CloudSessionHelper {
  constructor(
    private readonly provider: CloudProviderId,
    private readonly cookies: CookieService,
    private readonly config: ConfigService,
  ) {}

  private get isProduction(): boolean {
    return this.config.get<string>('NODE_ENV') === 'production';
  }

  private get cookieName(): string {
    return cloudSessionCookieName(this.provider);
  }

  readSession(req: Request): string | null {
    const cookies = req.cookies as Record<string, string> | undefined;
    const value = cookies?.[this.cookieName];
    if (!value || value.length < 16) return null;
    return value;
  }

  ensureSession(req: Request, res: Response): string {
    const existing = this.readSession(req);
    if (existing) return existing;
    const sessionId = randomBytes(24).toString('hex');
    this.setSessionCookie(res, sessionId);
    return sessionId;
  }

  setSessionCookie(res: Response, sessionId: string): void {
    const ttlDays = this.config.get<number>('COOKIE_TTL_DAYS') ?? 60;
    res.cookie(this.cookieName, sessionId, {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.isProduction,
      maxAge: ttlDays * 24 * 60 * 60 * 1000,
      path: '/',
    });
  }

  clearSessionCookie(res: Response): void {
    res.clearCookie(this.cookieName, {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.isProduction,
      path: '/',
    });
  }

  /**
   * Prefer verified_email when present. Always use provider session cookie
   * for Redis token keys (set on auth-url / OAuth callback).
   */
  requireSession(req: Request, res: Response): string {
    const verified = this.cookies.readVerifiedEmail(req);
    const session = this.readSession(req);
    if (!verified && !session) {
      const label =
        this.provider === 'drive'
          ? 'Drive'
          : this.provider === 'dropbox'
            ? 'Dropbox'
            : 'OneDrive';
      throw new UnauthorizedException({
        error: `A ${label} session is required. Connect ${label} first, or verify your email.`,
        code: ErrorCodes.AUTH_REQUIRED,
      });
    }
    return this.ensureSession(req, res);
  }
}
