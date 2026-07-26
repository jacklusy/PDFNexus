import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { AdminLogsQuery } from '@pdfnexus/shared';
import { PrismaService } from '../../prisma/prisma.service';

const EXPORT_CAP = 5000;

@Injectable()
export class AdminLogsService {
  constructor(private readonly prisma: PrismaService) {}

  private buildWhere(query: AdminLogsQuery): Prisma.HttpRequestLogWhereInput {
    const where: Prisma.HttpRequestLogWhereInput = {};

    if (query.from || query.to) {
      where.createdAt = {};
      if (query.from) where.createdAt.gte = new Date(query.from);
      if (query.to) where.createdAt.lte = new Date(query.to);
    }
    if (query.method) where.method = query.method.toUpperCase();
    if (query.path) where.path = { contains: query.path, mode: 'insensitive' };
    if (query.statusMin != null || query.statusMax != null) {
      where.statusCode = {};
      if (query.statusMin != null) where.statusCode.gte = Number(query.statusMin);
      if (query.statusMax != null) where.statusCode.lte = Number(query.statusMax);
    }
    if (query.os) where.os = { contains: query.os, mode: 'insensitive' };
    if (query.browser) {
      where.browser = { contains: query.browser, mode: 'insensitive' };
    }
    if (query.deviceType) {
      where.deviceType = { equals: query.deviceType, mode: 'insensitive' };
    }
    if (query.authStatus) {
      where.authStatus = { equals: query.authStatus, mode: 'insensitive' };
    }
    if (query.ip) where.ip = { contains: query.ip };
    if (query.userEmail) {
      where.userEmail = { contains: query.userEmail, mode: 'insensitive' };
    }
    if (query.adminUserId) where.adminUserId = query.adminUserId;
    if (query.search) {
      where.OR = [
        { path: { contains: query.search, mode: 'insensitive' } },
        { ip: { contains: query.search } },
        { userEmail: { contains: query.search, mode: 'insensitive' } },
        { requestId: { contains: query.search } },
        { errorMessage: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    return where;
  }

  async list(query: AdminLogsQuery = {}) {
    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(query.pageSize) || 25));
    const where = this.buildWhere(query);
    const sortBy = query.sortBy || 'createdAt';
    const sortDir = query.sort === 'asc' ? 'asc' : 'desc';

    const [total, items] = await Promise.all([
      this.prisma.httpRequestLog.count({ where }),
      this.prisma.httpRequestLog.findMany({
        where,
        orderBy: { [sortBy]: sortDir },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return { total, page, pageSize, items };
  }

  async exportCsv(query: AdminLogsQuery = {}) {
    const where = this.buildWhere(query);
    const sortBy = query.sortBy || 'createdAt';
    const sortDir = query.sort === 'asc' ? 'asc' : 'desc';
    const total = await this.prisma.httpRequestLog.count({ where });
    const items = await this.prisma.httpRequestLog.findMany({
      where,
      orderBy: { [sortBy]: sortDir },
      take: EXPORT_CAP,
    });
    const truncated = total > items.length;
    const header = [
      'createdAt',
      'requestId',
      'method',
      'path',
      'statusCode',
      'durationMs',
      'ip',
      'userEmail',
      'adminUserId',
      'browser',
      'os',
      'deviceType',
      'authStatus',
      'errorMessage',
    ];
    const rows = items.map((r) =>
      [
        r.createdAt.toISOString(),
        r.requestId,
        r.method,
        r.path,
        r.statusCode,
        r.durationMs,
        r.ip ?? '',
        r.userEmail ?? '',
        r.adminUserId ?? '',
        r.browser ?? '',
        r.os ?? '',
        r.deviceType ?? '',
        r.authStatus ?? '',
        r.errorMessage ?? '',
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(','),
    );
    return {
      csv: [header.join(','), ...rows].join('\n'),
      truncated,
      total,
      exported: items.length,
    };
  }

  async exportExcel(query: AdminLogsQuery = {}) {
    const ExcelJS = await import('exceljs');
    const where = this.buildWhere(query);
    const sortBy = query.sortBy || 'createdAt';
    const sortDir = query.sort === 'asc' ? 'asc' : 'desc';
    const total = await this.prisma.httpRequestLog.count({ where });
    const items = await this.prisma.httpRequestLog.findMany({
      where,
      orderBy: { [sortBy]: sortDir },
      take: EXPORT_CAP,
    });
    const truncated = total > items.length;
    const wb = new ExcelJS.Workbook();
    const sheet = wb.addWorksheet('Request Logs');
    sheet.addRow([
      'Created At',
      'Request ID',
      'Method',
      'Path',
      'Status',
      'Duration (ms)',
      'IP',
      'User Email',
      'Admin User ID',
      'Browser',
      'OS',
      'Device',
      'Auth Status',
      'Error',
    ]);
    for (const r of items) {
      sheet.addRow([
        r.createdAt.toISOString(),
        r.requestId,
        r.method,
        r.path,
        r.statusCode,
        r.durationMs,
        r.ip,
        r.userEmail,
        r.adminUserId,
        r.browser,
        r.os,
        r.deviceType,
        r.authStatus,
        r.errorMessage,
      ]);
    }
    const summary = wb.addWorksheet('Export Info');
    summary.addRow(['Total matching', total]);
    summary.addRow(['Exported', items.length]);
    summary.addRow(['Truncated', truncated ? 'yes' : 'no']);
    const buf = await wb.xlsx.writeBuffer();
    return {
      buffer: Buffer.from(buf),
      truncated,
      total,
      exported: items.length,
    };
  }
}
