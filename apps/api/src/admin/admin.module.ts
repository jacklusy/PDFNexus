import { Module } from '@nestjs/common';
import { AdminAuthController } from './auth/admin-auth.controller';
import { AdminAuthService } from './auth/admin-auth.service';
import { AdminCookieService } from './auth/admin-cookie.service';
import { AdminSessionGuard } from './auth/admin-session.guard';
import { AdminController } from './admin.controller';
import { AdminOverviewService } from './overview/admin-overview.service';
import { AdminLogsService } from './logs/admin-logs.service';
import { AdminUsersService } from './users/admin-users.service';
import { AdminAnalyticsService } from './analytics/admin-analytics.service';
import { AdminMonitoringService } from './monitoring/admin-monitoring.service';
import { AuditService } from './audit/audit.service';
import { AdminAuditQueryService } from './audit/admin-audit-query.service';
import { AdminErrorsService } from './errors/admin-errors.service';
import { AdminNotificationsService } from './notifications/admin-notifications.service';
import { AdminSecurityService } from './security/admin-security.service';
import { MailModule } from '../mail/mail.module';
import { JobsModule } from '../jobs/jobs.module';
import { AuthEmailModule } from '../auth/auth-email.module';

@Module({
  imports: [MailModule, JobsModule, AuthEmailModule],
  controllers: [AdminAuthController, AdminController],
  providers: [
    AdminAuthService,
    AdminCookieService,
    AdminSessionGuard,
    AdminOverviewService,
    AdminLogsService,
    AdminUsersService,
    AdminAnalyticsService,
    AdminMonitoringService,
    AuditService,
    AdminAuditQueryService,
    AdminErrorsService,
    AdminNotificationsService,
    AdminSecurityService,
  ],
  exports: [
    AdminAuthService,
    AdminCookieService,
    AdminSessionGuard,
    AdminErrorsService,
    AuditService,
    AdminNotificationsService,
  ],
})
export class AdminModule {}
