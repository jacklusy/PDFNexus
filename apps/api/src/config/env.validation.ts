import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  APP_URL: z.string().url().default('http://localhost:3000'),
  API_URL: z.string().url().default('http://localhost:4000'),
  ALLOWED_ORIGINS: z.string().default('http://localhost:3000'),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1).default('redis://localhost:6379'),
  COOKIE_SECRET: z.string().min(32),
  COOKIE_TTL_DAYS: z.coerce.number().int().positive().default(60),
  VERIFIED_EMAIL_COOKIE: z.string().default('verified_email'),
  MAIL_PROVIDER: z.enum(['smtp', 'resend']).default('smtp'),
  RESEND_API_KEY: z.string().optional().default(''),
  MAIL_FROM: z.string().default('PDFNexus <noreply@localhost>'),
  SMTP_HOST: z.string().default('localhost'),
  SMTP_PORT: z.coerce.number().int().positive().default(1025),
  SMTP_SECURE: z
    .string()
    .optional()
    .transform((v) => v === 'true' || v === '1'),
  SMTP_USER: z.string().optional().default(''),
  SMTP_PASS: z.string().optional().default(''),
  S3_ENDPOINT: z.string().url().default('http://localhost:9000'),
  S3_REGION: z.string().default('us-east-1'),
  S3_ACCESS_KEY: z.string().min(1),
  S3_SECRET_KEY: z.string().min(1),
  S3_BUCKET: z.string().min(1).default('pdfnexus'),
  S3_FORCE_PATH_STYLE: z
    .string()
    .optional()
    .transform((v) => v !== 'false' && v !== '0'),
  FILE_TTL_DAYS: z.coerce.number().int().positive().default(7),
  MAX_UPLOAD_BYTES: z.coerce.number().int().positive().default(524_288_000),
  GEMINI_API_KEY: z.string().optional().default(''),
  OCR_BODY_LIMIT_BYTES: z.coerce.number().int().positive().default(6_291_456),
  OCR_MAX_BASE64_CHARS: z.coerce.number().int().positive().default(5_500_000),
  OCR_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
  OCR_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(20),
  OCR_MAX_CONCURRENT: z.coerce.number().int().positive().default(2),
  OCR_TIMEOUT_MS: z.coerce.number().int().positive().default(45_000),
  OCR_DAILY_BUDGET: z.coerce.number().int().positive().default(500),
  API_PORT: z.coerce.number().int().positive().default(4000),
  TRUST_PROXY: z.coerce.number().int().nonnegative().default(1),
  ADMIN_SESSION_SECRET: z.string().min(32).optional(),
  ADMIN_SESSION_COOKIE: z.string().default('admin_session'),
  ADMIN_SESSION_TTL_HOURS: z.coerce.number().int().positive().default(12),
  ADMIN_SEED_EMAIL: z
    .string()
    .optional()
    .default('')
    .transform((v) => v.trim()),
  ADMIN_SEED_PASSWORD: z.string().optional().default(''),
  ADMIN_MAX_LOGIN_ATTEMPTS: z.coerce.number().int().positive().default(5),
  ADMIN_LOCKOUT_MINUTES: z.coerce.number().int().positive().default(15),
  LOG_RETENTION_DAYS: z.coerce.number().int().positive().default(30),
});

export type EnvConfig = z.infer<typeof envSchema> & {
  allowedOrigins: string[];
  geminiApiKey: string | null;
  isProduction: boolean;
};

export function validateEnv(config: Record<string, unknown>): EnvConfig {
  const parsed = envSchema.safeParse(config);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((i) => `${i.path.join('.')}: ${i.message}`)
      .join('; ');
    throw new Error(`Invalid environment configuration: ${details}`);
  }

  const data = parsed.data;
  const origins = new Set<string>([
    'http://localhost:3000',
    'http://127.0.0.1:3000',
  ]);

  for (const part of data.ALLOWED_ORIGINS.split(',')) {
    const trimmed = part.trim();
    if (trimmed) origins.add(trimmed);
  }

  try {
    origins.add(new URL(data.APP_URL).origin);
  } catch {
    // ignore invalid APP_URL — zod already validated url
  }

  const geminiRaw = data.GEMINI_API_KEY?.trim() ?? '';
  const geminiApiKey =
    geminiRaw && geminiRaw !== 'MY_GEMINI_API_KEY' ? geminiRaw : null;

  return {
    ...data,
    SMTP_SECURE: Boolean(data.SMTP_SECURE),
    S3_FORCE_PATH_STYLE: data.S3_FORCE_PATH_STYLE !== false,
    allowedOrigins: [...origins],
    geminiApiKey,
    isProduction: data.NODE_ENV === 'production',
  };
}
