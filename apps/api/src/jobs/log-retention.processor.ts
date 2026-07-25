import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { LOG_RETENTION_QUEUE } from './job.constants';

@Processor(LOG_RETENTION_QUEUE)
export class LogRetentionProcessor extends WorkerHost {
  private readonly logger = new Logger(LogRetentionProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    super();
  }

  async process(_job: Job): Promise<{ deleted: number }> {
    const days = this.config.get<number>('LOG_RETENTION_DAYS') ?? 30;
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const result = await this.prisma.httpRequestLog.deleteMany({
      where: { createdAt: { lt: cutoff } },
    });
    this.logger.log(
      `Log retention: deleted ${result.count} rows older than ${days}d`,
    );
    return { deleted: result.count };
  }
}
