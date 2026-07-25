import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Query,
  Body,
  Res,
  Sse,
  UseGuards,
  MessageEvent,
} from '@nestjs/common';
import type { Response } from 'express';
import { Observable } from 'rxjs';
import { VerifiedUserStatus } from '@prisma/client';
import { AdminSessionGuard } from './auth/admin-session.guard';
import { RequirePermission } from './auth/require-permission.decorator';
import { CurrentAdmin } from './auth/current-admin.decorator';
import type { AdminRequestUser } from './auth/admin-session.guard';
import { AdminOverviewService } from './overview/admin-overview.service';
import { AdminLogsService } from './logs/admin-logs.service';
import { AdminUsersService } from './users/admin-users.service';
import { AdminAnalyticsService } from './analytics/admin-analytics.service';
import { AdminMonitoringService } from './monitoring/admin-monitoring.service';
import { AdminAuditQueryService } from './audit/admin-audit-query.service';
import { AdminErrorsService } from './errors/admin-errors.service';
import { AdminNotificationsService } from './notifications/admin-notifications.service';
import { AdminSecurityService } from './security/admin-security.service';

@Controller('admin')
@UseGuards(AdminSessionGuard)
export class AdminController {
  constructor(
    private readonly overview: AdminOverviewService,
    private readonly logs: AdminLogsService,
    private readonly users: AdminUsersService,
    private readonly analytics: AdminAnalyticsService,
    private readonly monitoring: AdminMonitoringService,
    private readonly audit: AdminAuditQueryService,
    private readonly errors: AdminErrorsService,
    private readonly notifications: AdminNotificationsService,
    private readonly security: AdminSecurityService,
  ) {}

  @Get('overview')
  @RequirePermission('dashboard.read')
  getOverview() {
    return this.overview.getOverview();
  }

  @Get('logs')
  @RequirePermission('logs.read')
  listLogs(@Query() query: Record<string, string>) {
    return this.logs.list({
      page: Number(query.page),
      pageSize: Number(query.pageSize),
      search: query.search,
      method: query.method,
      path: query.path,
      statusMin: query.statusMin ? Number(query.statusMin) : undefined,
      statusMax: query.statusMax ? Number(query.statusMax) : undefined,
      from: query.from,
      to: query.to,
      sort: query.sort === 'asc' ? 'asc' : 'desc',
    });
  }

  @Get('logs/export')
  @RequirePermission('logs.read')
  async exportLogs(
    @Query() query: Record<string, string>,
    @Res() res: Response,
  ) {
    const csv = await this.logs.exportCsv({
      search: query.search,
      method: query.method,
      path: query.path,
      from: query.from,
      to: query.to,
    });
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="request-logs.csv"',
    );
    res.send(csv);
  }

  @Get('users')
  @RequirePermission('users.read')
  listUsers(@Query() query: Record<string, string>) {
    return this.users.list({
      page: Number(query.page),
      pageSize: Number(query.pageSize),
      search: query.search,
      status: query.status,
      from: query.from,
      to: query.to,
    });
  }

  @Get('users/:id')
  @RequirePermission('users.read')
  userDetail(@Param('id') id: string) {
    return this.users.detail(id);
  }

  @Patch('users/:id/status')
  @RequirePermission('users.write')
  updateUserStatus(
    @Param('id') id: string,
    @Body() body: { status: VerifiedUserStatus; notes?: string },
    @CurrentAdmin() admin: AdminRequestUser,
  ) {
    return this.users.updateStatus(id, body.status, admin, body.notes);
  }

  @Get('analytics')
  @RequirePermission('analytics.read')
  analyticsReports(@Query() query: Record<string, string>) {
    return this.analytics.reports({
      from: query.from,
      to: query.to,
      days: query.days ? Number(query.days) : undefined,
    });
  }

  @Get('analytics/export')
  @RequirePermission('analytics.export')
  async analyticsExport(
    @Query() query: Record<string, string>,
    @Res() res: Response,
  ) {
    const format = (query.format || 'csv').toLowerCase();
    const params = {
      from: query.from,
      to: query.to,
      days: query.days ? Number(query.days) : undefined,
    };

    if (format === 'xlsx' || format === 'excel') {
      const buffer = await this.analytics.exportExcel(params);
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
      res.setHeader(
        'Content-Disposition',
        'attachment; filename="analytics.xlsx"',
      );
      return res.send(buffer);
    }

    if (format === 'pdf') {
      const buffer = await this.analytics.exportPdf(params);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        'attachment; filename="analytics.pdf"',
      );
      return res.send(buffer);
    }

    const csv = await this.analytics.exportCsv(params);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="analytics.csv"',
    );
    return res.send(csv);
  }

  @Get('monitoring/snapshot')
  @RequirePermission('monitoring.read')
  monitoringSnapshot() {
    return this.monitoring.snapshot();
  }

  @Get('audit')
  @RequirePermission('audit.read')
  listAudit(@Query() query: Record<string, string>) {
    return this.audit.list({
      page: Number(query.page),
      pageSize: Number(query.pageSize),
      search: query.search,
      action: query.action,
      from: query.from,
      to: query.to,
    });
  }

  @Get('errors')
  @RequirePermission('errors.read')
  listErrors(@Query() query: Record<string, string>) {
    return this.errors.list({
      page: Number(query.page),
      pageSize: Number(query.pageSize),
      status: query.status,
      severity: query.severity,
      search: query.search,
    });
  }

  @Post('errors/:id/resolve')
  @RequirePermission('errors.write')
  resolveError(@Param('id') id: string) {
    return this.errors.resolve(id);
  }

  @Get('notifications')
  @RequirePermission('notifications.read')
  listNotifications(@Query() query: Record<string, string>) {
    return this.notifications.list({
      page: Number(query.page),
      pageSize: Number(query.pageSize),
      unreadOnly: query.unreadOnly === 'true',
    });
  }

  @Post('notifications/:id/read')
  @RequirePermission('notifications.read')
  markNotificationRead(@Param('id') id: string) {
    return this.notifications.markRead(id);
  }

  @Post('notifications/read-all')
  @RequirePermission('notifications.read')
  markAllNotificationsRead() {
    return this.notifications.markAllRead();
  }

  @Sse('notifications/stream')
  @RequirePermission('notifications.read')
  notificationsStream(): Observable<MessageEvent> {
    return this.notifications.stream();
  }

  @Get('security')
  @RequirePermission('security.read')
  securitySummary() {
    return this.security.summary();
  }
}
