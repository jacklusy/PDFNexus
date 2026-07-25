import { describe, expect, it } from 'vitest';
import { CookieService } from '../src/auth/cookie.service';

function makeConfig(overrides: Record<string, string | number> = {}) {
  const map: Record<string, string | number> = {
    COOKIE_SECRET: 'test-secret-at-least-32-characters-long',
    VERIFIED_EMAIL_COOKIE: 'verified_email',
    COOKIE_TTL_DAYS: 60,
    NODE_ENV: 'test',
    ...overrides,
  };
  return {
    get: <T>(key: string) => map[key] as T,
    getOrThrow: <T>(key: string) => {
      if (!(key in map)) throw new Error(`Missing ${key}`);
      return map[key] as T;
    },
  };
}

describe('CookieService', () => {
  it('signs and unsigns email', () => {
    const service = new CookieService(makeConfig() as never);
    const signed = service.signEmail('User@Example.com');
    expect(signed.startsWith('s:')).toBe(true);
    expect(service.unsignEmail(signed)).toBe('user@example.com');
  });

  it('rejects tampered cookie', () => {
    const service = new CookieService(makeConfig() as never);
    const signed = service.signEmail('a@b.co');
    expect(service.unsignEmail(signed + 'x')).toBeNull();
    expect(service.unsignEmail(undefined)).toBeNull();
  });
});
