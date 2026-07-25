import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AdminSecurityService {
  constructor(private readonly prisma: PrismaService) {}

  async summary() {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [
      failedLogins,
      lockouts,
      unauthorized,
      rateLimited,
      suspiciousIps,
      recentFailedAudits,
    ] = await Promise.all([
      this.prisma.auditLog.count({
        where: {
          action: 'admin.login.failed',
          createdAt: { gte: since },
        },
      }),
      this.prisma.adminNotification.count({
        where: { type: 'security.lockout', createdAt: { gte: since7d } },
      }),
      this.prisma.httpRequestLog.count({
        where: {
          createdAt: { gte: since },
          statusCode: { in: [401, 403] },
        },
      }),
      this.prisma.httpRequestLog.count({
        where: { createdAt: { gte: since }, statusCode: 429 },
      }),
      this.prisma.$queryRaw<Array<{ ip: string; failures: bigint }>>`
        SELECT ip, COUNT(*)::bigint as failures
        FROM "HttpRequestLog"
        WHERE "createdAt" >= ${since}
          AND "statusCode" IN (401, 403, 429)
          AND ip IS NOT NULL
        GROUP BY ip
        HAVING COUNT(*) >= 10
        ORDER BY failures DESC
        LIMIT 20
      `,
      this.prisma.auditLog.findMany({
        where: {
          success: false,
          createdAt: { gte: since7d },
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
    ]);

    const claimVolume = await this.prisma.httpRequestLog.count({
      where: {
        createdAt: { gte: since },
        path: { contains: 'claim-download' },
      },
    });

    return {
      windowHours: 24,
      failedLogins24h: failedLogins,
      lockouts7d: lockouts,
      unauthorized24h: unauthorized,
      rateLimited24h: rateLimited,
      claimDownloads24h: claimVolume,
      suspiciousIps: suspiciousIps.map((r) => ({
        ip: r.ip,
        failures: Number(r.failures),
      })),
      recentFailedAudits,
    };
  }
}
