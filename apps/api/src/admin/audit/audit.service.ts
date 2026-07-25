import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(input: {
    actorUserId?: string | null;
    actorEmail?: string | null;
    action: string;
    resourceType?: string;
    resourceId?: string;
    ip?: string;
    userAgent?: string;
    before?: unknown;
    after?: unknown;
    success?: boolean;
  }): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        actorUserId: input.actorUserId ?? null,
        actorEmail: input.actorEmail ?? null,
        action: input.action,
        resourceType: input.resourceType ?? null,
        resourceId: input.resourceId ?? null,
        ip: input.ip ?? null,
        userAgent: input.userAgent ?? null,
        beforeJson: input.before != null ? JSON.stringify(input.before) : null,
        afterJson: input.after != null ? JSON.stringify(input.after) : null,
        success: input.success !== false,
      },
    });
  }
}
