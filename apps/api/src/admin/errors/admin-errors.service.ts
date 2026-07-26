import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { ErrorSeverity, Prisma } from '@prisma/client';
import type { AdminErrorsQuery } from '@pdfnexus/shared';
import { PrismaService } from '../../prisma/prisma.service';

const EXPORT_CAP = 5000;

@Injectable()
export class AdminErrorsService {
  constructor(private readonly prisma: PrismaService) {}

  fingerprint(source: string, message: string): string {
    return createHash('sha256')
      .update(`${source}|${message.slice(0, 500)}`)
      .digest('hex')
      .slice(0, 32);
  }

  async capture(input: {
    source: string;
    message: string;
    stack?: string;
    severity?: ErrorSeverity;
    requestId?: string;
    userEmail?: string;
    adminUserId?: string;
    meta?: unknown;
  }) {
    const fp = this.fingerprint(input.source, input.message);
    const existing = await this.prisma.errorEvent.findUnique({
      where: { fingerprint: fp },
    });
    if (existing) {
      return this.prisma.errorEvent.update({
        where: { id: existing.id },
        data: {
          occurrenceCount: { increment: 1 },
          lastSeenAt: new Date(),
          status: 'OPEN',
          stack: input.stack ?? existing.stack,
        },
      });
    }
    return this.prisma.errorEvent.create({
      data: {
        fingerprint: fp,
        source: input.source,
        message: input.message.slice(0, 4000),
        stack: input.stack?.slice(0, 16_000) ?? null,
        severity: input.severity ?? 'MEDIUM',
        requestId: input.requestId ?? null,
        userEmail: input.userEmail ?? null,
        adminUserId: input.adminUserId ?? null,
        metaJson: input.meta != null ? JSON.stringify(input.meta) : null,
      },
    });
  }

  private buildWhere(query: AdminErrorsQuery): Prisma.ErrorEventWhereInput {
    const where: Prisma.ErrorEventWhereInput = {};
    if (query.status === 'OPEN' || query.status === 'RESOLVED') {
      where.status = query.status;
    }
    if (
      query.severity &&
      ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(query.severity)
    ) {
      where.severity = query.severity as ErrorSeverity;
    }
    if (query.from || query.to) {
      where.lastSeenAt = {};
      if (query.from) where.lastSeenAt.gte = new Date(query.from);
      if (query.to) where.lastSeenAt.lte = new Date(query.to);
    }
    if (query.search) {
      where.OR = [
        { message: { contains: query.search, mode: 'insensitive' } },
        { source: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    return where;
  }

  async list(query: AdminErrorsQuery = {}) {
    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(query.pageSize) || 25));
    const where = this.buildWhere(query);
    const [total, items] = await Promise.all([
      this.prisma.errorEvent.count({ where }),
      this.prisma.errorEvent.findMany({
        where,
        orderBy: { lastSeenAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    return { total, page, pageSize, items };
  }

  async exportCsv(query: AdminErrorsQuery = {}) {
    const where = this.buildWhere(query);
    const total = await this.prisma.errorEvent.count({ where });
    const items = await this.prisma.errorEvent.findMany({
      where,
      orderBy: { lastSeenAt: 'desc' },
      take: EXPORT_CAP,
    });
    const header = [
      'lastSeenAt',
      'firstSeenAt',
      'severity',
      'status',
      'source',
      'message',
      'occurrenceCount',
      'requestId',
    ];
    const rows = items.map((r) =>
      [
        r.lastSeenAt.toISOString(),
        r.firstSeenAt.toISOString(),
        r.severity,
        r.status,
        r.source,
        r.message,
        r.occurrenceCount,
        r.requestId ?? '',
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(','),
    );
    return {
      csv: [header.join(','), ...rows].join('\n'),
      truncated: total > items.length,
      total,
      exported: items.length,
    };
  }

  async exportExcel(query: AdminErrorsQuery = {}) {
    const ExcelJS = await import('exceljs');
    const where = this.buildWhere(query);
    const total = await this.prisma.errorEvent.count({ where });
    const items = await this.prisma.errorEvent.findMany({
      where,
      orderBy: { lastSeenAt: 'desc' },
      take: EXPORT_CAP,
    });
    const wb = new ExcelJS.Workbook();
    const sheet = wb.addWorksheet('Errors');
    sheet.addRow([
      'Last Seen',
      'First Seen',
      'Severity',
      'Status',
      'Source',
      'Message',
      'Occurrences',
      'Request ID',
    ]);
    for (const r of items) {
      sheet.addRow([
        r.lastSeenAt.toISOString(),
        r.firstSeenAt.toISOString(),
        r.severity,
        r.status,
        r.source,
        r.message,
        r.occurrenceCount,
        r.requestId,
      ]);
    }
    const buf = await wb.xlsx.writeBuffer();
    return {
      buffer: Buffer.from(buf),
      truncated: total > items.length,
      total,
      exported: items.length,
    };
  }

  async resolve(id: string) {
    return this.prisma.errorEvent.update({
      where: { id },
      data: { status: 'RESOLVED', resolvedAt: new Date() },
    });
  }
}
