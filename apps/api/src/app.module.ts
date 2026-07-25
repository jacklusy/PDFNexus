import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER } from '@nestjs/core';
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
import { AnalyticsModule } from './analytics/analytics.module';
import { FeedbackModule } from './feedback/feedback.module';
import { AdminModule } from './admin/admin.module';
import { SecurityMiddleware } from './common/middleware/security.middleware';
import { HttpRequestLogMiddleware } from './common/middleware/http-request-log.middleware';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      envFilePath: ['.env', '../../.env', '../.env'],
      validate: validateEnv,
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
    AnalyticsModule,
    FeedbackModule,
    AdminModule,
  ],
  providers: [
    SecurityMiddleware,
    HttpRequestLogMiddleware,
    AllExceptionsFilter,
    { provide: APP_FILTER, useExisting: AllExceptionsFilter },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(SecurityMiddleware, HttpRequestLogMiddleware)
      .forRoutes('*');
  }
}
