import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import * as signature from 'cookie-signature';
import { generateSessionToken, hashToken } from './admin-crypto';

@Injectable()
export class AdminCookieService {
  constructor(private readonly config: ConfigService) {}

  private get secret(): string {
    return (
      this.config.get<string>('ADMIN_SESSION_SECRET') ||
      this.config.getOrThrow<string>('COOKIE_SECRET')
    );
  }

  private get cookieName(): string {
    return this.config.get<string>('ADMIN_SESSION_COOKIE') ?? 'admin_session';
  }

  private get ttlHours(): number {
    return this.config.get<number>('ADMIN_SESSION_TTL_HOURS') ?? 12;
  }

  private get isProduction(): boolean {
    return this.config.get<string>('NODE_ENV') === 'production';
  }

  createRawToken(): { raw: string; hash: string; expiresAt: Date } {
    const raw = generateSessionToken();
    const hash = hashToken(raw);
    const expiresAt = new Date(Date.now() + this.ttlHours * 60 * 60 * 1000);
    return { raw, hash, expiresAt };
  }

  setSessionCookie(res: Response, rawToken: string, expiresAt: Date): void {
    const signed = `s:${signature.sign(rawToken, this.secret)}`;
    res.cookie(this.cookieName, signed, {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.isProduction,
      expires: expiresAt,
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

  readRawToken(req: Request): string | null {
    const cookies = req.cookies as Record<string, string> | undefined;
    const raw = cookies?.[this.cookieName];
    if (!raw) return null;
    const value = raw.startsWith('s:') ? raw.slice(2) : raw;
    const result = signature.unsign(value, this.secret);
    if (result === false) return null;
    return result;
  }

  tokenHashFromRequest(req: Request): string | null {
    const raw = this.readRawToken(req);
    return raw ? hashToken(raw) : null;
  }
}
