import {
  BadRequestException,
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
  NotFoundException,
} from '@nestjs/common';
import type { Response } from 'express';
import { Observable } from 'rxjs';
import { VerifiedUserStatus } from '@prisma/client';
import {
  adminAnalyticsQuerySchema,
  adminAuditQuerySchema,
  adminErrorsQuerySchema,
  adminLogsQuerySchema,
  ErrorCodes,
} from '@pdfnexus/shared';
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

function parseQuery<T>(
  schema: { safeParse: (v: unknown) => { success: true; data: T } | { success: false } },
  query: Record<string, string>,
): T {
  const parsed = schema.safeParse(query);
  if (!parsed.success) {
    throw new BadRequestException({
      error: 'Invalid query parameters',
      code: ErrorCodes.VALIDATION_ERROR,
    });
  }
  return parsed.data;
}

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
    return this.logs.list(parseQuery(adminLogsQuerySchema, query));
  }

  @Get('logs/export')
  @RequirePermission('logs.read')
  async exportLogs(
    @Query() query: Record<string, string>,
    @Res() res: Response,
  ) {
    const params = parseQuery(adminLogsQuerySchema, query);
    const format = (params.format || 'csv').toLowerCase();

    if (format === 'xlsx' || format === 'excel') {
      const result = await this.logs.exportExcel(params);
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
      res.setHeader(
        'Content-Disposition',
        'attachment; filename="request-logs.xlsx"',
      );
      if (result.truncated) res.setHeader('X-Export-Truncated', 'true');
      res.setHeader('X-Export-Total', String(result.total));
      res.setHeader('X-Export-Count', String(result.exported));
      return res.send(result.buffer);
    }

    const result = await this.logs.exportCsv(params);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="request-logs.csv"',
    );
    if (result.truncated) res.setHeader('X-Export-Truncated', 'true');
    res.setHeader('X-Export-Total', String(result.total));
    res.setHeader('X-Export-Count', String(result.exported));
    return res.send(result.csv);
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
    return this.analytics.reports(parseQuery(adminAnalyticsQuerySchema, query));
  }

  @Get('analytics/export')
  @RequirePermission('analytics.export')
  async analyticsExport(
    @Query() query: Record<string, string>,
    @Res() res: Response,
  ) {
    const params = parseQuery(adminAnalyticsQuerySchema, query);
    const format = (params.format || 'csv').toLowerCase();

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
    return this.audit.list(parseQuery(adminAuditQuerySchema, query));
  }

  @Get('audit/export')
  @RequirePermission('audit.read')
  async exportAudit(
    @Query() query: Record<string, string>,
    @Res() res: Response,
  ) {
    const params = parseQuery(adminAuditQuerySchema, query);
    const format = (params.format || 'csv').toLowerCase();
    if (format === 'xlsx' || format === 'excel') {
      const result = await this.audit.exportExcel(params);
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
      res.setHeader(
        'Content-Disposition',
        'attachment; filename="audit.xlsx"',
      );
      if (result.truncated) res.setHeader('X-Export-Truncated', 'true');
      return res.send(result.buffer);
    }
    const result = await this.audit.exportCsv(params);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="audit.csv"');
    if (result.truncated) res.setHeader('X-Export-Truncated', 'true');
    return res.send(result.csv);
  }

  @Get('errors')
  @RequirePermission('errors.read')
  listErrors(@Query() query: Record<string, string>) {
    return this.errors.list(parseQuery(adminErrorsQuerySchema, query));
  }

  @Get('errors/export')
  @RequirePermission('errors.read')
  async exportErrors(
    @Query() query: Record<string, string>,
    @Res() res: Response,
  ) {
    const params = parseQuery(adminErrorsQuerySchema, query);
    const format = (params.format || 'csv').toLowerCase();
    if (format === 'xlsx' || format === 'excel') {
      const result = await this.errors.exportExcel(params);
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
      res.setHeader(
        'Content-Disposition',
        'attachment; filename="errors.xlsx"',
      );
      if (result.truncated) res.setHeader('X-Export-Truncated', 'true');
      return res.send(result.buffer);
    }
    const result = await this.errors.exportCsv(params);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="errors.csv"');
    if (result.truncated) res.setHeader('X-Export-Truncated', 'true');
    return res.send(result.csv);
  }

  @Post('errors/:id/resolve')
  @RequirePermission('errors.write')
  resolveError(@Param('id') id: string) {
    return this.errors.resolve(id);
  }

  @Get('notifications')
  @RequirePermission('notifications.read')
  listNotifications(
    @Query() query: Record<string, string>,
    @CurrentAdmin() admin: AdminRequestUser,
  ) {
    return this.notifications.list(
      {
        page: Number(query.page),
        pageSize: Number(query.pageSize),
        unreadOnly: query.unreadOnly === 'true',
      },
      admin.id,
    );
  }

  @Post('notifications/:id/read')
  @RequirePermission('notifications.read')
  async markNotificationRead(
    @Param('id') id: string,
    @CurrentAdmin() admin: AdminRequestUser,
  ) {
    const updated = await this.notifications.markRead(id, admin.id);
    if (!updated) {
      throw new NotFoundException({ error: 'Notification not found' });
    }
    return updated;
  }

  @Post('notifications/read-all')
  @RequirePermission('notifications.read')
  markAllNotificationsRead(@CurrentAdmin() admin: AdminRequestUser) {
    return this.notifications.markAllRead(admin.id);
  }

  @Sse('notifications/stream')
  @RequirePermission('notifications.read')
  notificationsStream(
    @CurrentAdmin() admin: AdminRequestUser,
  ): Observable<MessageEvent> {
    return this.notifications.stream(admin.id);
  }

  @Get('security')
  @RequirePermission('security.read')
  securitySummary() {
    return this.security.summary();
  }
}
