import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import * as signature from 'cookie-signature';

@Injectable()
export class CookieService {
  constructor(private readonly config: ConfigService) {}

  private get secret(): string {
    return this.config.getOrThrow<string>('COOKIE_SECRET');
  }

  private get cookieName(): string {
    return this.config.get<string>('VERIFIED_EMAIL_COOKIE') ?? 'verified_email';
  }

  private get ttlDays(): number {
    return this.config.get<number>('COOKIE_TTL_DAYS') ?? 60;
  }

  private get isProduction(): boolean {
    return this.config.get<string>('NODE_ENV') === 'production';
  }

  signEmail(email: string): string {
    return `s:${signature.sign(email.toLowerCase(), this.secret)}`;
  }

  unsignEmail(raw: string | undefined): string | null {
    if (!raw) return null;
    const value = raw.startsWith('s:') ? raw.slice(2) : raw;
    const result = signature.unsign(value, this.secret);
    if (result === false) return null;
    return result.toLowerCase();
  }

  setVerifiedEmail(res: Response, email: string): void {
    const maxAgeMs = this.ttlDays * 24 * 60 * 60 * 1000;
    res.cookie(this.cookieName, this.signEmail(email), {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.isProduction,
      maxAge: maxAgeMs,
      path: '/',
    });
  }

  clearVerifiedEmail(res: Response): void {
    res.clearCookie(this.cookieName, {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.isProduction,
      path: '/',
    });
  }

  readVerifiedEmail(req: Request): string | null {
    const cookies = req.cookies as Record<string, string> | undefined;
    return this.unsignEmail(cookies?.[this.cookieName]);
  }
}
