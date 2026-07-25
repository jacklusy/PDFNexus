import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { MailService } from '../mail/mail.service';
import { SEND_OTP_QUEUE } from './job.constants';

export interface SendOtpJobData {
  email: string;
  code: string;
}

@Processor(SEND_OTP_QUEUE)
export class SendOtpProcessor extends WorkerHost {
  private readonly logger = new Logger(SendOtpProcessor.name);

  constructor(private readonly mail: MailService) {
    super();
  }

  async process(job: Job<SendOtpJobData>): Promise<void> {
    this.logger.log(`Sending OTP email job=${job.id}`);
    await this.mail.sendOtp(job.data.email, job.data.code);
  }
}
