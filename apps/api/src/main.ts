import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { Logger } from 'nestjs-pino';
import cookieParser from 'cookie-parser';
import { json, urlencoded } from 'express';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

function normalizeOrigin(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    return new URL(trimmed).origin;
  } catch {
    return null;
  }
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
    bodyParser: false,
  });

  const config = app.get(ConfigService);
  const port = Number(config.get('API_PORT') ?? 4000);
  const trustProxy = Number(config.get('TRUST_PROXY') ?? 1);
  const ocrBodyLimit = Number(config.get('OCR_BODY_LIMIT_BYTES') ?? 6_291_456);
  const appUrl = String(config.get('APP_URL') ?? 'http://localhost:3000');
  const allowedOriginsRaw = String(config.get('ALLOWED_ORIGINS') ?? '');

  const origins = new Set<string>();
  for (const candidate of [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    appUrl,
    ...allowedOriginsRaw.split(','),
  ]) {
    const normalized = normalizeOrigin(candidate);
    if (normalized) origins.add(normalized);
  }
  const validated = config.get<string[]>('allowedOrigins');
  if (Array.isArray(validated)) {
    for (const o of validated) {
      const normalized = normalizeOrigin(o);
      if (normalized) origins.add(normalized);
    }
  }

  app.useLogger(app.get(Logger));
  app.setGlobalPrefix('api');
  app.useGlobalFilters(new AllExceptionsFilter());

  const httpAdapter = app.getHttpAdapter().getInstance();
  if (typeof httpAdapter.set === 'function') {
    httpAdapter.set('trust proxy', trustProxy);
  }

  app.enableCors({
    origin: [...origins],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    maxAge: 86400,
  });

  app.use(cookieParser());
  app.use(json({ limit: ocrBodyLimit }));
  app.use(urlencoded({ extended: true, limit: ocrBodyLimit }));

  app.enableShutdownHooks();

  await app.listen(port, '0.0.0.0');
  const logger = app.get(Logger);
  logger.log(`API listening on http://0.0.0.0:${port} (prefix=/api)`);

  const gemini = config.get<string>('geminiApiKey') ?? config.get<string>('GEMINI_API_KEY');
  if (!gemini) {
    logger.warn(
      'GEMINI_API_KEY not set — OCR endpoint will return 503 with fallback',
    );
  }
}

bootstrap().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[boot]', err instanceof Error ? err.message : err);
  process.exit(1);
});
