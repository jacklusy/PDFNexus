import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import * as os from 'os';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import {
  SEND_FILE_EMAIL_QUEUE,
  SEND_OTP_QUEUE,
} from '../../jobs/job.constants';

const BOOT_TIME = Date.now();

@Injectable()
export class AdminMonitoringService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    @InjectQueue(SEND_OTP_QUEUE) private readonly otpQueue: Queue,
    @InjectQueue(SEND_FILE_EMAIL_QUEUE) private readonly fileEmailQueue: Queue,
  ) {}

  async snapshot() {
    const mem = process.memoryUsage();
    const freeMem = os.freemem();
    const totalMem = os.totalmem();

    const dbStart = Date.now();
    let dbOk = false;
    let dbLatencyMs = 0;
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      dbOk = true;
      dbLatencyMs = Date.now() - dbStart;
    } catch {
      dbOk = false;
      dbLatencyMs = Date.now() - dbStart;
    }

    let redisOk = false;
    let redisLatencyMs = 0;
    try {
      const t = Date.now();
      redisOk = (await this.redis.client.ping()) === 'PONG';
      redisLatencyMs = Date.now() - t;
    } catch {
      redisOk = false;
    }

    let queues = {
      otp: {} as Record<string, number>,
      fileEmail: {} as Record<string, number>,
    };
    try {
      queues = {
        otp: await this.otpQueue.getJobCounts(
          'waiting',
          'active',
          'completed',
          'failed',
          'delayed',
        ),
        fileEmail: await this.fileEmailQueue.getJobCounts(
          'waiting',
          'active',
          'completed',
          'failed',
          'delayed',
        ),
      };
    } catch {
      // ignore
    }

    const since = new Date(Date.now() - 60 * 60 * 1000);
    const recent = await this.prisma.httpRequestLog.findMany({
      where: { createdAt: { gte: since } },
      select: { durationMs: true, statusCode: true, path: true, method: true, createdAt: true },
      orderBy: { durationMs: 'desc' },
      take: 2000,
    });

    const durations = recent.map((r) => r.durationMs).sort((a, b) => a - b);
    const pct = (p: number) =>
      durations.length
        ? durations[Math.min(durations.length - 1, Math.floor(durations.length * p))]
        : 0;

    const slowRequests = recent.slice(0, 20).map((r) => ({
      path: r.path,
      method: r.method,
      durationMs: r.durationMs,
      statusCode: r.statusCode,
      createdAt: r.createdAt.toISOString(),
    }));

    const failedJobs =
      (queues.otp.failed ?? 0) + (queues.fileEmail.failed ?? 0);

    let loadavg: number[] | null = null;
    try {
      loadavg = os.loadavg();
    } catch {
      loadavg = null;
    }

    return {
      generatedAt: new Date().toISOString(),
      uptimeSec: Math.floor((Date.now() - BOOT_TIME) / 1000),
      process: {
        rss: mem.rss,
        heapUsed: mem.heapUsed,
        heapTotal: mem.heapTotal,
        external: mem.external,
        pid: process.pid,
        node: process.version,
      },
      host: {
        platform: os.platform(),
        arch: os.arch(),
        cpus: os.cpus().length,
        loadavg,
        freeMem,
        totalMem,
        memUsedRatio: totalMem ? 1 - freeMem / totalMem : null,
      },
      database: { ok: dbOk, latencyMs: dbLatencyMs },
      redis: { ok: redisOk, latencyMs: redisLatencyMs },
      queues,
      failedJobs,
      api: {
        sampleSize: durations.length,
        p50: pct(0.5),
        p95: pct(0.95),
        p99: pct(0.99),
        errorRate:
          recent.length === 0
            ? 0
            : Math.round(
                (recent.filter((r) => r.statusCode >= 500).length /
                  recent.length) *
                  1000,
              ) / 10,
      },
      slowRequests,
    };
  }
}
