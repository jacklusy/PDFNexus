import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { ErrorSeverity, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

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

  async list(query: {
    page?: number;
    pageSize?: number;
    status?: string;
    severity?: string;
    search?: string;
  }) {
    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(query.pageSize) || 25));
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
    if (query.search) {
      where.OR = [
        { message: { contains: query.search, mode: 'insensitive' } },
        { source: { contains: query.search, mode: 'insensitive' } },
      ];
    }
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

  async resolve(id: string) {
    return this.prisma.errorEvent.update({
      where: { id },
      data: { status: 'RESOLVED', resolvedAt: new Date() },
    });
  }
}
