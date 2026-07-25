import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AdminLogsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: {
    page?: number;
    pageSize?: number;
    search?: string;
    method?: string;
    statusMin?: number;
    statusMax?: number;
    path?: string;
    from?: string;
    to?: string;
    sort?: 'asc' | 'desc';
  }) {
    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(query.pageSize) || 25));
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
    if (query.search) {
      where.OR = [
        { path: { contains: query.search, mode: 'insensitive' } },
        { ip: { contains: query.search } },
        { userEmail: { contains: query.search, mode: 'insensitive' } },
        { requestId: { contains: query.search } },
        { errorMessage: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [total, items] = await Promise.all([
      this.prisma.httpRequestLog.count({ where }),
      this.prisma.httpRequestLog.findMany({
        where,
        orderBy: { createdAt: query.sort === 'asc' ? 'asc' : 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return {
      total,
      page,
      pageSize,
      items,
    };
  }

  async exportCsv(query: Parameters<AdminLogsService['list']>[0]) {
    const result = await this.list({ ...query, page: 1, pageSize: 5000 });
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
    ];
    const rows = result.items.map((r) =>
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
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(','),
    );
    return [header.join(','), ...rows].join('\n');
  }
}
