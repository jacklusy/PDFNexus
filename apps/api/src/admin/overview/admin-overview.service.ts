import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FileStatus } from '@prisma/client';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import {
  SEND_FILE_EMAIL_QUEUE,
  SEND_OTP_QUEUE,
} from '../../jobs/job.constants';

const BOOT_TIME = Date.now();

@Injectable()
export class AdminOverviewService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly config: ConfigService,
    @InjectQueue(SEND_OTP_QUEUE) private readonly otpQueue: Queue,
    @InjectQueue(SEND_FILE_EMAIL_QUEUE) private readonly fileEmailQueue: Queue,
  ) {}

  async getOverview() {
    const cacheKey = 'admin:overview:v1';
    const cached = await this.redis.client.get(cacheKey);
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch {
        // ignore
      }
    }

    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const activeSince = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [
      totalUsers,
      activeUsers,
      newUsersToday,
      totalFiles,
      pdfFiles,
      docxFiles,
      storageAgg,
      processingOk,
      processingFailed,
      avgProcessing,
      apiRequests7d,
      merges,
      converts,
      downloads,
      uploads,
      activeAdminSessions,
      openErrors,
    ] = await Promise.all([
      this.prisma.verifiedUser.count(),
      this.prisma.verifiedUser.count({
        where: { lastSeenAt: { gte: activeSince } },
      }),
      this.prisma.verifiedUser.count({
        where: { createdAt: { gte: startOfDay } },
      }),
      this.prisma.storedFile.count(),
      this.prisma.storedFile.count({ where: { kind: 'MERGED_PDF' } }),
      this.prisma.storedFile.count({ where: { kind: 'DOCX' } }),
      this.prisma.storedFile.aggregate({
        _sum: { sizeBytes: true },
        where: { status: { not: FileStatus.EXPIRED } },
      }),
      this.prisma.processingLog.count({ where: { status: 'ok' } }),
      this.prisma.processingLog.count({ where: { status: 'failed' } }),
      this.prisma.processingLog.aggregate({
        _avg: { durationMs: true },
        where: { durationMs: { not: null } },
      }),
      this.prisma.httpRequestLog.count({
        where: { createdAt: { gte: since7d } },
      }),
      this.prisma.analyticsEvent.count({ where: { type: 'merge' } }),
      this.prisma.analyticsEvent.count({ where: { type: 'convert' } }),
      this.prisma.analyticsEvent.count({ where: { type: 'download' } }),
      this.prisma.analyticsEvent.count({ where: { type: 'upload_local' } }),
      this.prisma.adminSession.count({
        where: { revokedAt: null, expiresAt: { gt: now } },
      }),
      this.prisma.errorEvent.count({ where: { status: 'OPEN' } }),
    ]);

    const totalOps = processingOk + processingFailed;
    const successRate =
      totalOps === 0 ? 100 : Math.round((processingOk / totalOps) * 1000) / 10;

    let queueStatus = { otp: {}, fileEmail: {} as Record<string, number> };
    try {
      const [otpCounts, fileCounts] = await Promise.all([
        this.otpQueue.getJobCounts(
          'waiting',
          'active',
          'completed',
          'failed',
          'delayed',
        ),
        this.fileEmailQueue.getJobCounts(
          'waiting',
          'active',
          'completed',
          'failed',
          'delayed',
        ),
      ]);
      queueStatus = { otp: otpCounts, fileEmail: fileCounts };
    } catch {
      // queue may be unavailable
    }

    let redisOk = false;
    try {
      redisOk = (await this.redis.client.ping()) === 'PONG';
    } catch {
      redisOk = false;
    }

    const payload = {
      generatedAt: now.toISOString(),
      uptimeSec: Math.floor((Date.now() - BOOT_TIME) / 1000),
      health: {
        database: true,
        redis: redisOk,
        server: 'ok',
      },
      users: {
        total: totalUsers,
        active: activeUsers,
        newToday: newUsersToday,
      },
      files: {
        total: totalFiles,
        pdf: pdfFiles,
        docx: docxFiles,
        storageBytes: storageAgg._sum.sizeBytes ?? 0,
      },
      activity: {
        merges,
        conversions: converts,
        downloads,
        uploads,
        projects: merges,
        images: 0,
      },
      operations: {
        apiRequests7d,
        avgProcessingMs: Math.round(avgProcessing._avg.durationMs ?? 0),
        failed: processingFailed,
        successRate,
      },
      admin: {
        activeSessions: activeAdminSessions,
        openErrors,
      },
      queue: queueStatus,
    };

    await this.redis.client.setex(cacheKey, 45, JSON.stringify(payload));
    return payload;
  }
}
