import { Injectable, MessageEvent } from '@nestjs/common';
import { NotificationSeverity, Prisma } from '@prisma/client';
import { Observable, interval, switchMap, startWith, map } from 'rxjs';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AdminNotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: {
    userId?: string;
    type: string;
    severity?: NotificationSeverity;
    title: string;
    body: string;
    meta?: unknown;
  }) {
    return this.prisma.adminNotification.create({
      data: {
        userId: input.userId ?? null,
        type: input.type,
        severity: input.severity ?? 'INFO',
        title: input.title,
        body: input.body,
        metaJson: input.meta != null ? JSON.stringify(input.meta) : null,
      },
    });
  }

  async list(query: { page?: number; pageSize?: number; unreadOnly?: boolean }) {
    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(query.pageSize) || 25));
    const where: Prisma.AdminNotificationWhereInput = {};
    if (query.unreadOnly) where.readAt = null;
    const [total, unread, items] = await Promise.all([
      this.prisma.adminNotification.count({ where }),
      this.prisma.adminNotification.count({ where: { readAt: null } }),
      this.prisma.adminNotification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    return { total, unread, page, pageSize, items };
  }

  async markRead(id: string) {
    return this.prisma.adminNotification.update({
      where: { id },
      data: { readAt: new Date() },
    });
  }

  async markAllRead() {
    await this.prisma.adminNotification.updateMany({
      where: { readAt: null },
      data: { readAt: new Date() },
    });
    return { ok: true };
  }

  stream(): Observable<MessageEvent> {
    return interval(8000).pipe(
      startWith(0),
      switchMap(async () => {
        const unread = await this.prisma.adminNotification.count({
          where: { readAt: null },
        });
        const latest = await this.prisma.adminNotification.findMany({
          where: { readAt: null },
          orderBy: { createdAt: 'desc' },
          take: 5,
        });
        return { unread, latest };
      }),
      map((data) => ({ data }) as MessageEvent),
    );
  }
}
