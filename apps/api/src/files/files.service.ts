import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  PayloadTooLargeException,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { createHmac, timingSafeEqual } from 'crypto';
import { FileKind, FileStatus, DownloadChannel } from '@prisma/client';
import { randomUUID } from 'crypto';
import { ErrorCodes } from '@pdfnexus/shared';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { SEND_FILE_EMAIL_QUEUE } from '../jobs/job.constants';

const PDF_MIME = new Set(['application/pdf']);
const DOCX_MIME = new Set([
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/docx',
]);

@Injectable()
export class FilesService {
  private readonly logger = new Logger(FilesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly config: ConfigService,
    @InjectQueue(SEND_FILE_EMAIL_QUEUE)
    private readonly fileEmailQueue: Queue,
  ) {}

  private maxBytes(): number {
    return this.config.get<number>('MAX_UPLOAD_BYTES') ?? 52_428_800;
  }

  private ttlDays(): number {
    return this.config.get<number>('FILE_TTL_DAYS') ?? 7;
  }

  private detectKind(
    mime: string,
    originalName: string,
  ): { kind: FileKind; contentType: string } {
    const lower = (mime || '').toLowerCase();
    const name = originalName.toLowerCase();

    if (PDF_MIME.has(lower) || name.endsWith('.pdf')) {
      return { kind: FileKind.MERGED_PDF, contentType: 'application/pdf' };
    }
    if (
      DOCX_MIME.has(lower) ||
      name.endsWith('.docx') ||
      lower.includes('wordprocessingml')
    ) {
      return {
        kind: FileKind.DOCX,
        contentType:
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      };
    }
    throw new BadRequestException({
      error: 'Only PDF and DOCX uploads are allowed',
      code: ErrorCodes.FILE_INVALID,
    });
  }

  async upload(
    ownerEmail: string,
    file: Express.Multer.File,
    sendEmail = false,
  ) {
    if (!file) {
      throw new BadRequestException({
        error: 'File is required',
        code: ErrorCodes.FILE_INVALID,
      });
    }

    if (file.size > this.maxBytes()) {
      throw new PayloadTooLargeException({
        error: 'File exceeds 50MB limit',
        code: ErrorCodes.FILE_TOO_LARGE,
      });
    }

    const { kind, contentType } = this.detectKind(
      file.mimetype,
      file.originalname,
    );
    const id = randomUUID();
    const storageKey = `files/${ownerEmail}/${id}/${file.originalname}`;
    const expiresAt = new Date(
      Date.now() + this.ttlDays() * 24 * 60 * 60 * 1000,
    );
    const started = Date.now();

    const record = await this.prisma.storedFile.create({
      data: {
        id,
        ownerEmail,
        kind,
        originalName: file.originalname,
        storageKey,
        sizeBytes: file.size,
        status: FileStatus.PENDING,
        expiresAt,
      },
    });

    try {
      await this.storage.putObject(storageKey, file.buffer, contentType);
      const processingMs = Date.now() - started;
      const updated = await this.prisma.storedFile.update({
        where: { id: record.id },
        data: { status: FileStatus.READY, processingMs },
      });

      await this.prisma.processingLog.create({
        data: {
          fileId: record.id,
          stage: 'upload',
          status: 'ok',
          durationMs: processingMs,
        },
      });

      if (sendEmail) {
        await this.fileEmailQueue.add(
          'send-file-email',
          { fileId: record.id, email: ownerEmail },
          {
            attempts: 3,
            backoff: { type: 'exponential', delay: 2000 },
            removeOnComplete: 100,
            removeOnFail: 50,
          },
        );
      }

      return {
        id: updated.id,
        kind: updated.kind,
        originalName: updated.originalName,
        sizeBytes: updated.sizeBytes,
        status: updated.status,
        expiresAt: updated.expiresAt.toISOString(),
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'upload failed';
      this.logger.error(`Upload failed for ${record.id}: ${message}`);
      await this.prisma.storedFile.update({
        where: { id: record.id },
        data: { status: FileStatus.FAILED },
      });
      await this.prisma.processingLog.create({
        data: {
          fileId: record.id,
          stage: 'upload',
          status: 'failed',
          errorCode: 'UPLOAD_FAILED',
          durationMs: Date.now() - started,
        },
      });
      throw err;
    }
  }

  async getDownload(
    fileId: string,
    requesterEmail: string | null,
    signedToken?: string,
  ) {
    const file = await this.prisma.storedFile.findUnique({
      where: { id: fileId },
    });
    if (!file || file.status === FileStatus.EXPIRED) {
      throw new NotFoundException({
        error: 'File not found',
        code: ErrorCodes.FILE_NOT_FOUND,
      });
    }
    if (file.status !== FileStatus.READY) {
      throw new NotFoundException({
        error: 'File not ready',
        code: ErrorCodes.FILE_NOT_FOUND,
      });
    }
    if (file.expiresAt.getTime() < Date.now()) {
      await this.prisma.storedFile.update({
        where: { id: file.id },
        data: { status: FileStatus.EXPIRED },
      });
      throw new NotFoundException({
        error: 'File expired',
        code: ErrorCodes.FILE_NOT_FOUND,
      });
    }

    const authorized =
      (requesterEmail && requesterEmail === file.ownerEmail) ||
      (signedToken && this.verifyDownloadToken(fileId, signedToken));

    if (!authorized) {
      throw new ForbiddenException({
        error: 'Not allowed to download this file',
        code: ErrorCodes.AUTH_REQUIRED,
      });
    }

    const url = await this.storage.presignGet(file.storageKey, 900);

    await this.prisma.$transaction([
      this.prisma.storedFile.update({
        where: { id: file.id },
        data: { downloadCount: { increment: 1 } },
      }),
      this.prisma.download.create({
        data: {
          fileId: file.id,
          email: requesterEmail ?? file.ownerEmail,
          channel: DownloadChannel.BROWSER,
        },
      }),
    ]);

    return {
      url,
      originalName: file.originalName,
      sizeBytes: file.sizeBytes,
      kind: file.kind,
    };
  }

  createDownloadToken(fileId: string): string {
    const secret = this.config.getOrThrow<string>('COOKIE_SECRET');
    return createHmac('sha256', secret)
      .update(`download:${fileId}`)
      .digest('hex')
      .slice(0, 32);
  }

  verifyDownloadToken(fileId: string, token: string): boolean {
    const expected = this.createDownloadToken(fileId);
    try {
      const a = Buffer.from(expected);
      const b = Buffer.from(token);
      if (a.length !== b.length) return false;
      return timingSafeEqual(a, b);
    } catch {
      return false;
    }
  }
}
