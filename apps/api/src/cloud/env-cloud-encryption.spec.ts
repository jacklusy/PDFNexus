import { describe, expect, it } from 'vitest';
import { validateEnv } from '../config/env.validation';

const required = {
  DATABASE_URL: 'postgresql://localhost:5432/pdfnexus',
  COOKIE_SECRET: 'c'.repeat(32),
  S3_ACCESS_KEY: 'minio',
  S3_SECRET_KEY: 'minio123',
  APP_URL: 'https://example.com',
  GOTENBERG_URL: 'https://gotenberg.example.com',
  ALLOWED_ORIGINS: 'https://example.com',
};

describe('env cloud encryption fail-closed', () => {
  it('rejects production with Drive enabled and short encryption key', () => {
    expect(() =>
      validateEnv({
        ...required,
        NODE_ENV: 'production',
        GOOGLE_CLIENT_ID: 'client.apps.googleusercontent.com',
        GOOGLE_TOKEN_ENCRYPTION_KEY: 'short',
      }),
    ).toThrow(/ENCRYPTION_KEY/);
  });

  it('accepts production with CLOUD_TOKEN_ENCRYPTION_KEY alone', () => {
    const env = validateEnv({
      ...required,
      NODE_ENV: 'production',
      GOOGLE_CLIENT_ID: 'client.apps.googleusercontent.com',
      CLOUD_TOKEN_ENCRYPTION_KEY: 'k'.repeat(32),
    });
    expect(env.CLOUD_TOKEN_ENCRYPTION_KEY.length).toBe(32);
  });
});
