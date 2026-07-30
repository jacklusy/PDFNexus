import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { validateEnv } from './config/env.validation';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { HealthModule } from './health/health.module';
import { AuthEmailModule } from './auth/auth-email.module';
import { FilesModule } from './files/files.module';
import { MailModule } from './mail/mail.module';
import { JobsModule } from './jobs/jobs.module';
import { StorageModule } from './storage/storage.module';
import { OcrModule } from './ocr/ocr.module';
import { ConversionsModule } from './conversions/conversions.module';
import { CloudModule } from './cloud/cloud.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { FeedbackModule } from './feedback/feedback.module';
import { AdminModule } from './admin/admin.module';
import { SecurityMiddleware } from './common/middleware/security.middleware';
import { HttpRequestLogMiddleware } from './common/middleware/http-request-log.middleware';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { AppThrottlerGuard } from './common/guards/app-throttler.guard';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      envFilePath: ['.env', '../../.env', '../.env'],
      validate: validateEnv,
    }),
    // Generous global baseline against request floods; endpoint-specific
    // limits (upload initiate, part URLs, email delivery) use Redis.
    ThrottlerModule.forRoot({
      throttlers: [{ name: 'global', ttl: 60_000, limit: 300 }],
    }),
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
        autoLogging: true,
        redact: ['req.headers.cookie', 'req.headers.authorization'],
      },
    }),
    PrismaModule,
    RedisModule,
    MailModule,
    StorageModule,
    JobsModule,
    HealthModule,
    AuthEmailModule,
    FilesModule,
    OcrModule,
    ConversionsModule,
    CloudModule,
    AnalyticsModule,
    FeedbackModule,
    AdminModule,
  ],
  providers: [
    SecurityMiddleware,
    HttpRequestLogMiddleware,
    AllExceptionsFilter,
    { provide: APP_FILTER, useExisting: AllExceptionsFilter },
    { provide: APP_GUARD, useClass: AppThrottlerGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(SecurityMiddleware, HttpRequestLogMiddleware)
      .forRoutes('*');
  }
}
