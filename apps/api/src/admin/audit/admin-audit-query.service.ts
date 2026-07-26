import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { AdminAuditQuery } from '@pdfnexus/shared';
import { PrismaService } from '../../prisma/prisma.service';

const EXPORT_CAP = 5000;

@Injectable()
export class AdminAuditQueryService {
  constructor(private readonly prisma: PrismaService) {}

  private buildWhere(query: AdminAuditQuery): Prisma.AuditLogWhereInput {
    const where: Prisma.AuditLogWhereInput = {};
    if (query.action) {
      where.action = { contains: query.action, mode: 'insensitive' };
    }
    if (query.resourceType) {
      where.resourceType = {
        contains: query.resourceType,
        mode: 'insensitive',
      };
    }
    if (query.actorEmail) {
      where.actorEmail = { contains: query.actorEmail, mode: 'insensitive' };
    }
    if (query.success != null) where.success = query.success;
    if (query.from || query.to) {
      where.createdAt = {};
      if (query.from) where.createdAt.gte = new Date(query.from);
      if (query.to) where.createdAt.lte = new Date(query.to);
    }
    if (query.search) {
      where.OR = [
        { actorEmail: { contains: query.search, mode: 'insensitive' } },
        { action: { contains: query.search, mode: 'insensitive' } },
        { resourceId: { contains: query.search } },
        { ip: { contains: query.search } },
      ];
    }
    return where;
  }

  async list(query: AdminAuditQuery = {}) {
    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(query.pageSize) || 25));
    const where = this.buildWhere(query);
    const [total, items] = await Promise.all([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    return { total, page, pageSize, items };
  }

  async exportCsv(query: AdminAuditQuery = {}) {
    const where = this.buildWhere(query);
    const total = await this.prisma.auditLog.count({ where });
    const items = await this.prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: EXPORT_CAP,
    });
    const header = [
      'createdAt',
      'actorEmail',
      'action',
      'resourceType',
      'resourceId',
      'success',
      'ip',
    ];
    const rows = items.map((r) =>
      [
        r.createdAt.toISOString(),
        r.actorEmail ?? '',
        r.action,
        r.resourceType ?? '',
        r.resourceId ?? '',
        r.success,
        r.ip ?? '',
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

  async exportExcel(query: AdminAuditQuery = {}) {
    const ExcelJS = await import('exceljs');
    const where = this.buildWhere(query);
    const total = await this.prisma.auditLog.count({ where });
    const items = await this.prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: EXPORT_CAP,
    });
    const wb = new ExcelJS.Workbook();
    const sheet = wb.addWorksheet('Audit');
    sheet.addRow([
      'Created At',
      'Actor',
      'Action',
      'Resource Type',
      'Resource ID',
      'Success',
      'IP',
    ]);
    for (const r of items) {
      sheet.addRow([
        r.createdAt.toISOString(),
        r.actorEmail,
        r.action,
        r.resourceType,
        r.resourceId,
        r.success,
        r.ip,
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
}
