import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, VerifiedUserStatus } from '@prisma/client';
import { ErrorCodes } from '@pdfnexus/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class AdminUsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(query: {
    page?: number;
    pageSize?: number;
    search?: string;
    status?: string;
    from?: string;
    to?: string;
  }) {
    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(query.pageSize) || 25));
    const where: Prisma.VerifiedUserWhereInput = {};
    if (query.search) {
      where.email = { contains: query.search, mode: 'insensitive' };
    }
    if (query.status && ['ACTIVE', 'SUSPENDED'].includes(query.status)) {
      where.status = query.status as VerifiedUserStatus;
    }
    if (query.from || query.to) {
      where.createdAt = {};
      if (query.from) where.createdAt.gte = new Date(query.from);
      if (query.to) where.createdAt.lte = new Date(query.to);
    }

    const [total, users] = await Promise.all([
      this.prisma.verifiedUser.count({ where }),
      this.prisma.verifiedUser.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    const emails = users.map((u) => u.email);
    const storage = await this.prisma.storedFile.groupBy({
      by: ['ownerEmail'],
      where: { ownerEmail: { in: emails } },
      _sum: { sizeBytes: true },
      _count: true,
    });
    const storageMap = new Map(
      storage.map((s) => [
        s.ownerEmail,
        { bytes: s._sum.sizeBytes ?? 0, files: s._count },
      ]),
    );

    return {
      total,
      page,
      pageSize,
      items: users.map((u) => ({
        ...u,
        storageBytes: storageMap.get(u.email)?.bytes ?? 0,
        fileCount: storageMap.get(u.email)?.files ?? 0,
      })),
    };
  }

  async detail(id: string) {
    const user = await this.prisma.verifiedUser.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException({
        error: 'User not found',
        code: ErrorCodes.FILE_NOT_FOUND,
      });
    }

    const [files, downloads, requestLogs, storageAgg] = await Promise.all([
      this.prisma.storedFile.findMany({
        where: { ownerEmail: user.email },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      this.prisma.download.findMany({
        where: { email: user.email },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      this.prisma.httpRequestLog.findMany({
        where: { userEmail: user.email },
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: {
          id: true,
          createdAt: true,
          ip: true,
          method: true,
          path: true,
          statusCode: true,
          browser: true,
          os: true,
          deviceType: true,
          userAgent: true,
        },
      }),
      this.prisma.storedFile.aggregate({
        where: { ownerEmail: user.email },
        _sum: { sizeBytes: true },
        _count: true,
      }),
    ]);

    const ips = [
      ...new Set(requestLogs.map((r) => r.ip).filter(Boolean)),
    ] as string[];

    return {
      user,
      storageBytes: storageAgg._sum.sizeBytes ?? 0,
      fileCount: storageAgg._count,
      files,
      downloads,
      loginHistory: requestLogs,
      ipHistory: ips,
    };
  }

  async updateStatus(
    id: string,
    status: VerifiedUserStatus,
    actor: { id: string; email: string },
    notes?: string,
  ) {
    const before = await this.prisma.verifiedUser.findUnique({ where: { id } });
    if (!before) {
      throw new NotFoundException({
        error: 'User not found',
        code: ErrorCodes.FILE_NOT_FOUND,
      });
    }
    const user = await this.prisma.verifiedUser.update({
      where: { id },
      data: {
        status,
        ...(notes !== undefined ? { notes } : {}),
      },
    });
    await this.audit.record({
      actorUserId: actor.id,
      actorEmail: actor.email,
      action: 'verified_user.status_change',
      resourceType: 'VerifiedUser',
      resourceId: id,
      before: { status: before.status },
      after: { status: user.status, notes: user.notes },
    });
    return user;
  }
}
