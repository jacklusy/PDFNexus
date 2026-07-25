import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { SendOtpProcessor } from './send-otp.processor';
import { SendFileEmailProcessor } from './send-file-email.processor';
import { SEND_FILE_EMAIL_QUEUE, SEND_OTP_QUEUE } from './job.constants';

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
    ),
  ],
  providers: [SendOtpProcessor, SendFileEmailProcessor],
  exports: [BullModule],
})
export class JobsModule {}
