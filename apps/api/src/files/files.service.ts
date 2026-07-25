import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  PayloadTooLargeException,
  ForbiddenException,
  HttpException,
  HttpStatus,
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
import { RedisService } from '../redis/redis.service';
import { AuthEmailService } from '../auth/auth-email.service';
import { SEND_FILE_EMAIL_QUEUE } from '../jobs/job.constants';
import { DEFAULT_MAX_UPLOAD_BYTES } from './upload-multer.options';

const PDF_MIME = new Set(['application/pdf']);
const DOCX_MIME = new Set([
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/docx',
]);

const EMAIL_DELIVERY_LIMIT = 8;
const EMAIL_DELIVERY_WINDOW_MS = 15 * 60 * 1000;

@Injectable()
export class FilesService {
  private readonly logger = new Logger(FilesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly config: ConfigService,
    private readonly redis: RedisService,
    private readonly auth: AuthEmailService,
    @InjectQueue(SEND_FILE_EMAIL_QUEUE)
    private readonly fileEmailQueue: Queue,
  ) {}

  private maxBytes(): number {
    return this.config.get<number>('MAX_UPLOAD_BYTES') ?? DEFAULT_MAX_UPLOAD_BYTES;
  }

  private maxLabel(): string {
    return `${Math.round(this.maxBytes() / (1024 * 1024))}MB`;
  }

  private async persistUpload(
    storageKey: string,
    file: Express.Multer.File,
    contentType: string,
  ): Promise<void> {
    if (file.path) {
      await this.storage.putObjectFromFile(
        storageKey,
        file.path,
        contentType,
        file.size,
      );
      return;
    }
    if (file.buffer?.length) {
      await this.storage.putObject(
        storageKey,
        file.buffer,
        contentType,
        file.size,
      );
      return;
    }
    throw new BadRequestException({
      error: 'File is required',
      code: ErrorCodes.FILE_INVALID,
    });
  }

  private async cleanupTempUpload(file: Express.Multer.File): Promise<void> {
    if (!file?.path) return;
    const { unlink } = await import('fs/promises');
    await unlink(file.path).catch(() => {
      // already removed by putObjectFromFile, or never written
    });
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
      await this.cleanupTempUpload(file);
      throw new PayloadTooLargeException({
        error: `File exceeds ${this.maxLabel()} limit`,
        code: ErrorCodes.FILE_TOO_LARGE,
      });
    }

    let kind: FileKind;
    let contentType: string;
    try {
      ({ kind, contentType } = this.detectKind(
        file.mimetype,
        file.originalname,
      ));
    } catch (err) {
      await this.cleanupTempUpload(file);
      throw err;
    }

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
      await this.persistUpload(storageKey, file, contentType);
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
        const claimToken = await this.auth.createClaimToken(
          ownerEmail,
          record.id,
        );
        const apiUrl = this.config.get<string>('API_URL') ?? 'http://localhost:4000';
        const downloadUrl = `${apiUrl}/api/files/claim-download?token=${claimToken}`;
        await this.fileEmailQueue.add(
          'send-file-email',
          { fileId: record.id, email: ownerEmail, downloadUrl },
          {
            attempts: 3,
            backoff: { type: 'exponential', delay: 2000 },
            removeOnComplete: 100,
            removeOnFail: 50,
          },
        );
      }

      const downloadToken = this.createDownloadToken(updated.id);
      const apiUrl = this.config.get<string>('API_URL') ?? 'http://localhost:4000';

      return {
        id: updated.id,
        kind: updated.kind,
        originalName: updated.originalName,
        sizeBytes: updated.sizeBytes,
        status: updated.status,
        expiresAt: updated.expiresAt.toISOString(),
        downloadUrl: `${apiUrl}/api/files/${updated.id}/download?token=${downloadToken}`,
        emailQueued: Boolean(sendEmail),
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'upload failed';
      this.logger.error(`Upload failed for ${record.id}: ${message}`);
      await this.cleanupTempUpload(file);
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

  /**
   * First-time download: accept email without cookie, upload file, email a
   * one-click claim link that verifies the address and starts the download.
   */
  async uploadForEmailDelivery(
    email: string,
    file: Express.Multer.File,
    clientIp: string,
  ) {
    const normalized = email.trim().toLowerCase();
    if (!normalized || !normalized.includes('@')) {
      throw new BadRequestException({
        error: 'Valid email is required',
        code: ErrorCodes.VALIDATION_ERROR,
      });
    }

    const rateKey = `files:email-delivery:${clientIp}:${normalized}`;
    const limit = await this.redis.rateLimit(
      rateKey,
      EMAIL_DELIVERY_LIMIT,
      EMAIL_DELIVERY_WINDOW_MS,
    );
    if (!limit.allowed) {
      throw new HttpException(
        {
          error: 'Too many download emails. Please wait and try again.',
          code: ErrorCodes.RATE_LIMITED,
          retryAfterSec: limit.retryAfterSec,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return this.upload(normalized, file, true);
  }

  async claimDownloadAndRedirect(
    token: string,
  ): Promise<{ email: string; redirectUrl: string }> {
    const payload = await this.auth.consumeClaimToken(token);
    if (!payload) {
      throw new ForbiddenException({
        error: 'Download link is invalid or has expired',
        code: ErrorCodes.AUTH_EXPIRED,
      });
    }

    const result = await this.getDownload(payload.fileId, payload.email);
    return { email: payload.email, redirectUrl: result.url };
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
