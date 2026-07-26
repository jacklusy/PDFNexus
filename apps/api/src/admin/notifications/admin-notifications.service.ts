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

  /** Notifications for a user include both targeted and broadcast (userId null). */
  private scope(userId: string): Prisma.AdminNotificationWhereInput {
    return {
      OR: [{ userId }, { userId: null }],
    };
  }

  async list(
    query: { page?: number; pageSize?: number; unreadOnly?: boolean },
    userId: string,
  ) {
    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(query.pageSize) || 25));
    const where: Prisma.AdminNotificationWhereInput = {
      AND: [this.scope(userId)],
    };
    if (query.unreadOnly) {
      (where.AND as Prisma.AdminNotificationWhereInput[]).push({
        readAt: null,
      });
    }
    const [total, unread, items] = await Promise.all([
      this.prisma.adminNotification.count({ where }),
      this.prisma.adminNotification.count({
        where: { AND: [this.scope(userId), { readAt: null }] },
      }),
      this.prisma.adminNotification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    return { total, unread, page, pageSize, items };
  }

  async markRead(id: string, userId: string) {
    const note = await this.prisma.adminNotification.findFirst({
      where: { id, OR: [{ userId }, { userId: null }] },
    });
    if (!note) return null;
    return this.prisma.adminNotification.update({
      where: { id },
      data: { readAt: new Date() },
    });
  }

  async markAllRead(userId: string) {
    await this.prisma.adminNotification.updateMany({
      where: { AND: [this.scope(userId), { readAt: null }] },
      data: { readAt: new Date() },
    });
    return { ok: true };
  }

  stream(userId: string): Observable<MessageEvent> {
    return interval(8000).pipe(
      startWith(0),
      switchMap(async () => {
        const scope = this.scope(userId);
        const unread = await this.prisma.adminNotification.count({
          where: { AND: [scope, { readAt: null }] },
        });
        const latest = await this.prisma.adminNotification.findMany({
          where: { AND: [scope, { readAt: null }] },
          orderBy: { createdAt: 'desc' },
          take: 5,
        });
        return { unread, latest };
      }),
      map((data) => ({ data }) as MessageEvent),
    );
  }
}
