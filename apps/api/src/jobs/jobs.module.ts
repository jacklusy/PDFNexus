import { Module, OnModuleInit, Logger } from '@nestjs/common';
import { BullModule, InjectQueue } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import { SendOtpProcessor } from './send-otp.processor';
import { SendFileEmailProcessor } from './send-file-email.processor';
import { LogRetentionProcessor } from './log-retention.processor';
import {
  SEND_FILE_EMAIL_QUEUE,
  SEND_OTP_QUEUE,
  LOG_RETENTION_QUEUE,
} from './job.constants';

@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          url: config.get<string>('REDIS_URL') ?? 'redis://localhost:6379',
        },
      }),
    }),
    BullModule.registerQueue(
      { name: SEND_OTP_QUEUE },
      { name: SEND_FILE_EMAIL_QUEUE },
      { name: LOG_RETENTION_QUEUE },
    ),
  ],
  providers: [SendOtpProcessor, SendFileEmailProcessor, LogRetentionProcessor],
  exports: [BullModule],
})
export class JobsModule implements OnModuleInit {
  private readonly logger = new Logger(JobsModule.name);

  constructor(
    @InjectQueue(LOG_RETENTION_QUEUE) private readonly retentionQueue: Queue,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      await this.retentionQueue.add(
        'purge',
        {},
        {
          repeat: { every: 24 * 60 * 60 * 1000 },
          removeOnComplete: 10,
          removeOnFail: 20,
        },
      );
      this.logger.log('Scheduled daily log retention job');
    } catch (err) {
      this.logger.warn(
        `Could not schedule log retention: ${err instanceof Error ? err.message : err}`,
      );
    }
  }
}
