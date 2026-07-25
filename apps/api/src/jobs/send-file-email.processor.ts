import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import { DownloadChannel } from '@prisma/client';
import { SEND_FILE_EMAIL_QUEUE } from './job.constants';

export interface SendFileEmailJobData {
  fileId: string;
  email: string;
  /** Claim / download URL embedded in the branded email CTA */
  downloadUrl: string;
}

@Processor(SEND_FILE_EMAIL_QUEUE)
export class SendFileEmailProcessor extends WorkerHost {
  private readonly logger = new Logger(SendFileEmailProcessor.name);

  constructor(
    private readonly mail: MailService,
    private readonly prisma: PrismaService,
  ) {
    super();
  }

  async process(job: Job<SendFileEmailJobData>): Promise<void> {
    const { fileId, email, downloadUrl } = job.data;
    this.logger.log(`Sending file email job=${job.id} fileId=${fileId}`);

    const file = await this.prisma.storedFile.findUnique({
      where: { id: fileId },
    });
    if (!file || file.status !== 'READY') {
      throw new Error(`File ${fileId} not ready for email delivery`);
    }

    await this.mail.sendFileEmail(email, file.originalName, downloadUrl);

    await this.prisma.download.create({
      data: {
        fileId: file.id,
        email,
        channel: DownloadChannel.EMAIL,
      },
    });
  }
}
