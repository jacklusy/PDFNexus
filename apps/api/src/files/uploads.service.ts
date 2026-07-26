import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
  PayloadTooLargeException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { createHmac, randomUUID, timingSafeEqual } from 'crypto';
import {
  FileStatus,
  UploadSession,
  UploadSessionStatus,
} from '@prisma/client';
import {
  ErrorCodes,
  UPLOAD_PART_SIZE_BYTES,
  type CompleteUploadResponse,
  type InitiateUploadResponse,
  type UploadPartUrl,
  type UploadSessionStatusResponse,
} from '@pdfnexus/shared';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { RedisService } from '../redis/redis.service';
import { AuthEmailService } from '../auth/auth-email.service';
import { SEND_FILE_EMAIL_QUEUE } from '../jobs/job.constants';
import { FilesService } from './files.service';
import {
  detectFileKind,
  matchesMagicBytes,
  sanitizeFileBaseName,
} from './file-kind.util';
import { DEFAULT_MAX_UPLOAD_BYTES } from './upload.constants';

const SESSION_TTL_MS = 24 * 60 * 60 * 1000;
const PART_URL_EXPIRY_SEC = 900;

const INITIATE_LIMIT = 30;
const INITIATE_WINDOW_MS = 15 * 60 * 1000;
const EMAIL_DELIVERY_LIMIT = 8;
const EMAIL_DELIVERY_WINDOW_MS = 15 * 60 * 1000;
const PART_URL_LIMIT = 600;
const PART_URL_WINDOW_MS = 15 * 60 * 1000;

const ACTIVE_STATUSES: UploadSessionStatus[] = [
  UploadSessionStatus.PENDING,
  UploadSessionStatus.UPLOADING,
];

@Injectable()
export class UploadsService {
  private readonly logger = new Logger(UploadsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly config: ConfigService,
    private readonly redis: RedisService,
    private readonly auth: AuthEmailService,
    private readonly files: FilesService,
    @InjectQueue(SEND_FILE_EMAIL_QUEUE)
    private readonly fileEmailQueue: Queue,
  ) {}

  private maxBytes(): number {
    return (
      this.config.get<number>('MAX_UPLOAD_BYTES') ?? DEFAULT_MAX_UPLOAD_BYTES
    );
  }

  private ttlDays(): number {
    return this.config.get<number>('FILE_TTL_DAYS') ?? 7;
  }

  createSessionToken(sessionId: string): string {
    const secret = this.config.getOrThrow<string>('COOKIE_SECRET');
    return createHmac('sha256', secret)
      .update(`upload-session:${sessionId}`)
      .digest('hex');
  }

  private verifySessionToken(sessionId: string, token: string): boolean {
    const expected = this.createSessionToken(sessionId);
    try {
      const a = Buffer.from(expected);
      const b = Buffer.from(token);
      if (a.length !== b.length) return false;
      return timingSafeEqual(a, b);
    } catch {
      return false;
    }
  }

  private async authorizeSession(
    sessionId: string,
    token: string | undefined,
    opts: { requireActive?: boolean } = {},
  ): Promise<UploadSession> {
    if (!token || !this.verifySessionToken(sessionId, token)) {
      throw new ForbiddenException({
        error: 'Invalid upload session token',
        code: ErrorCodes.UPLOAD_SESSION_INVALID,
      });
    }
    const session = await this.prisma.uploadSession.findUnique({
      where: { id: sessionId },
    });
    if (!session) {
      throw new NotFoundException({
        error: 'Upload session not found',
        code: ErrorCodes.UPLOAD_SESSION_INVALID,
      });
    }
    if (opts.requireActive !== false) {
      if (!ACTIVE_STATUSES.includes(session.status)) {
        throw new BadRequestException({
          error: `Upload session is ${session.status.toLowerCase()}`,
          code: ErrorCodes.UPLOAD_SESSION_INVALID,
        });
      }
      if (session.expiresAt.getTime() < Date.now()) {
        throw new BadRequestException({
          error: 'Upload session has expired',
          code: ErrorCodes.UPLOAD_SESSION_INVALID,
        });
      }
    }
    return session;
  }

  private async enforceRateLimit(
    key: string,
    max: number,
    windowMs: number,
    message: string,
  ): Promise<void> {
    const limit = await this.redis.rateLimit(key, max, windowMs);
    if (!limit.allowed) {
      throw new HttpException(
        {
          error: message,
          code: ErrorCodes.RATE_LIMITED,
          retryAfterSec: limit.retryAfterSec,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  async initiate(params: {
    ownerEmail: string;
    isFirstTimeEmailFlow: boolean;
    fileName: string;
    sizeBytes: number;
    mimeType: string;
    sendEmail: boolean;
    clientIp: string;
  }): Promise<InitiateUploadResponse> {
    const {
      ownerEmail,
      isFirstTimeEmailFlow,
      fileName,
      sizeBytes,
      mimeType,
      sendEmail,
      clientIp,
    } = params;

    await this.enforceRateLimit(
      `files:upload-init:${clientIp}`,
      INITIATE_LIMIT,
      INITIATE_WINDOW_MS,
      'Too many upload attempts. Please wait and try again.',
    );
    if (isFirstTimeEmailFlow) {
      await this.enforceRateLimit(
        `files:email-delivery:${clientIp}:${ownerEmail}`,
        EMAIL_DELIVERY_LIMIT,
        EMAIL_DELIVERY_WINDOW_MS,
        'Too many download emails. Please wait and try again.',
      );
    }

    if (sizeBytes > this.maxBytes()) {
      throw new PayloadTooLargeException({
        error: `File exceeds ${Math.round(this.maxBytes() / (1024 * 1024))}MB limit`,
        code: ErrorCodes.FILE_TOO_LARGE,
      });
    }

    const { kind, contentType, extension } = detectFileKind(
      mimeType,
      fileName,
    );

    const fileId = randomUUID();
    const storageKey = `files/${fileId}/${sanitizeFileBaseName(fileName)}.${extension}`;
    const totalParts = Math.max(
      1,
      Math.ceil(sizeBytes / UPLOAD_PART_SIZE_BYTES),
    );
    const mode = totalParts === 1 ? 'single' : 'multipart';

    const s3UploadId =
      mode === 'multipart'
        ? await this.storage.createMultipartUpload(storageKey, contentType)
        : null;

    const session = await this.prisma.$transaction(async (tx) => {
      await tx.storedFile.create({
        data: {
          id: fileId,
          ownerEmail,
          kind,
          originalName: fileName,
          storageKey,
          sizeBytes,
          status: FileStatus.PENDING,
          expiresAt: new Date(
            Date.now() + this.ttlDays() * 24 * 60 * 60 * 1000,
          ),
        },
      });
      return tx.uploadSession.create({
        data: {
          ownerEmail,
          fileName,
          sizeBytes,
          kind,
          storageKey,
          s3UploadId,
          partSize: UPLOAD_PART_SIZE_BYTES,
          totalParts,
          sendEmail,
          storedFileId: fileId,
          expiresAt: new Date(Date.now() + SESSION_TTL_MS),
        },
      });
    });

    return {
      sessionId: session.id,
      sessionToken: this.createSessionToken(session.id),
      fileId,
      mode,
      partSize: UPLOAD_PART_SIZE_BYTES,
      totalParts,
    };
  }

  async getPartUrls(
    sessionId: string,
    token: string | undefined,
    partNumbers: number[],
    clientIp: string,
  ): Promise<{ urls: UploadPartUrl[]; expiresInSec: number }> {
    const session = await this.authorizeSession(sessionId, token);

    await this.enforceRateLimit(
      `files:part-urls:${clientIp}:${sessionId}`,
      PART_URL_LIMIT,
      PART_URL_WINDOW_MS,
      'Too many part URL requests. Please slow down.',
    );

    const invalid = partNumbers.find(
      (n) => n < 1 || n > session.totalParts,
    );
    if (invalid !== undefined) {
      throw new BadRequestException({
        error: `Part number ${invalid} is out of range (1-${session.totalParts})`,
        code: ErrorCodes.VALIDATION_ERROR,
      });
    }

    if (session.status === UploadSessionStatus.PENDING) {
      await this.prisma.uploadSession.update({
        where: { id: session.id },
        data: { status: UploadSessionStatus.UPLOADING },
      });
    }

    const { contentType } = detectFileKind(
      '',
      session.fileName,
    );

    const urls = await Promise.all(
      partNumbers.map(async (partNumber): Promise<UploadPartUrl> => {
        const url = session.s3UploadId
          ? await this.storage.presignUploadPart(
              session.storageKey,
              session.s3UploadId,
              partNumber,
              PART_URL_EXPIRY_SEC,
            )
          : await this.storage.presignPut(
              session.storageKey,
              contentType,
              PART_URL_EXPIRY_SEC,
            );
        return { partNumber, url };
      }),
    );

    return { urls, expiresInSec: PART_URL_EXPIRY_SEC };
  }

  async reportPart(
    sessionId: string,
    token: string | undefined,
    partNumber: number,
    etag: string | undefined,
  ): Promise<{ completedParts: number }> {
    const session = await this.authorizeSession(sessionId, token);

    if (partNumber < 1 || partNumber > session.totalParts) {
      throw new BadRequestException({
        error: `Part number ${partNumber} is out of range (1-${session.totalParts})`,
        code: ErrorCodes.VALIDATION_ERROR,
      });
    }

    const lastPartSize =
      session.sizeBytes - (session.totalParts - 1) * session.partSize;
    const sizeBytes =
      partNumber === session.totalParts ? lastPartSize : session.partSize;

    await this.prisma.uploadPart.upsert({
      where: {
        sessionId_partNumber: { sessionId: session.id, partNumber },
      },
      update: { etag: etag ?? '', completedAt: new Date() },
      create: {
        sessionId: session.id,
        partNumber,
        sizeBytes,
        etag: etag ?? '',
      },
    });

    const completedParts = await this.prisma.uploadPart.count({
      where: { sessionId: session.id },
    });
    await this.prisma.uploadSession.update({
      where: { id: session.id },
      data: { completedParts },
    });

    return { completedParts };
  }

  async getStatus(
    sessionId: string,
    token: string | undefined,
  ): Promise<UploadSessionStatusResponse> {
    const session = await this.authorizeSession(sessionId, token, {
      requireActive: false,
    });
    const parts = await this.prisma.uploadPart.findMany({
      where: { sessionId: session.id },
      select: { partNumber: true },
      orderBy: { partNumber: 'asc' },
    });
    return {
      status: session.status,
      totalParts: session.totalParts,
      completedParts: parts.map((p) => p.partNumber),
    };
  }

  async complete(
    sessionId: string,
    token: string | undefined,
  ): Promise<CompleteUploadResponse> {
    const session = await this.authorizeSession(sessionId, token);
    const started = Date.now();

    if (session.s3UploadId) {
      await this.completeMultipart(session);
    } else {
      await this.verifySingleUpload(session);
    }

    await this.validateMagicBytes(session);

    const [file] = await this.prisma.$transaction([
      this.prisma.storedFile.update({
        where: { id: session.storedFileId! },
        data: {
          status: FileStatus.READY,
          processingMs: Date.now() - session.createdAt.getTime(),
        },
      }),
      this.prisma.uploadSession.update({
        where: { id: session.id },
        data: {
          status: UploadSessionStatus.COMPLETED,
          completedParts: session.totalParts,
        },
      }),
      this.prisma.processingLog.create({
        data: {
          fileId: session.storedFileId!,
          stage: 'upload',
          status: 'ok',
          durationMs: Date.now() - started,
        },
      }),
    ]);

    let emailQueued = false;
    if (session.sendEmail) {
      const claimToken = await this.auth.createClaimToken(
        session.ownerEmail,
        file.id,
      );
      const apiUrl =
        this.config.get<string>('API_URL') ?? 'http://localhost:4000';
      const downloadUrl = `${apiUrl}/api/files/claim-download?token=${claimToken}`;
      await this.fileEmailQueue.add(
        'send-file-email',
        { fileId: file.id, email: session.ownerEmail, downloadUrl },
        {
          attempts: 3,
          backoff: { type: 'exponential', delay: 2000 },
          removeOnComplete: 100,
          removeOnFail: 50,
        },
      );
      emailQueued = true;
    }

    const apiUrl =
      this.config.get<string>('API_URL') ?? 'http://localhost:4000';
    const downloadToken = this.files.createDownloadToken(file.id);

    return {
      id: file.id,
      kind: file.kind,
      originalName: file.originalName,
      sizeBytes: file.sizeBytes,
      status: file.status,
      expiresAt: file.expiresAt.toISOString(),
      downloadUrl: `${apiUrl}/api/files/${file.id}/download?token=${downloadToken}`,
      emailQueued,
    };
  }

  private async completeMultipart(session: UploadSession): Promise<void> {
    const parts = await this.storage.listParts(
      session.storageKey,
      session.s3UploadId!,
    );

    const totalSize = parts.reduce((sum, p) => sum + p.sizeBytes, 0);
    const partNumbers = new Set(parts.map((p) => p.partNumber));
    const allPresent =
      parts.length === session.totalParts &&
      partNumbers.size === session.totalParts;

    if (!allPresent || totalSize !== session.sizeBytes) {
      throw new BadRequestException({
        error: `Upload incomplete: ${parts.length}/${session.totalParts} parts, ${totalSize}/${session.sizeBytes} bytes`,
        code: ErrorCodes.UPLOAD_INCOMPLETE,
      });
    }

    await this.storage.completeMultipartUpload(
      session.storageKey,
      session.s3UploadId!,
      parts.map((p) => ({ partNumber: p.partNumber, etag: p.etag })),
    );
  }

  private async verifySingleUpload(session: UploadSession): Promise<void> {
    const head = await this.storage.headObject(session.storageKey);
    if (!head || head.contentLength !== session.sizeBytes) {
      throw new BadRequestException({
        error: `Upload incomplete: expected ${session.sizeBytes} bytes, found ${head?.contentLength ?? 0}`,
        code: ErrorCodes.UPLOAD_INCOMPLETE,
      });
    }
  }

  private async validateMagicBytes(session: UploadSession): Promise<void> {
    let header: Buffer;
    try {
      header = await this.storage.getObjectRange(session.storageKey, 0, 7);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `Magic-byte read failed for session ${session.id}: ${msg}`,
      );
      await this.failSession(session, 'MAGIC_BYTES_UNREADABLE');
      throw new BadRequestException({
        error: 'Uploaded file could not be validated',
        code: ErrorCodes.FILE_INVALID,
      });
    }

    if (!matchesMagicBytes(session.kind, header)) {
      await this.storage.deleteObject(session.storageKey).catch(() => {
        // best effort — cleanup service will retry via FAILED status
      });
      await this.failSession(session, 'MAGIC_BYTES_MISMATCH');
      throw new BadRequestException({
        error: 'File content does not match the declared type',
        code: ErrorCodes.FILE_INVALID,
      });
    }
  }

  private async failSession(
    session: UploadSession,
    errorCode: string,
  ): Promise<void> {
    await this.prisma
      .$transaction([
        this.prisma.uploadSession.update({
          where: { id: session.id },
          data: { status: UploadSessionStatus.FAILED },
        }),
        this.prisma.storedFile.update({
          where: { id: session.storedFileId! },
          data: { status: FileStatus.FAILED },
        }),
        this.prisma.processingLog.create({
          data: {
            fileId: session.storedFileId!,
            stage: 'upload',
            status: 'failed',
            errorCode,
          },
        }),
      ])
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.error(`Failed to mark session ${session.id}: ${msg}`);
      });
  }

  async abort(sessionId: string, token: string | undefined): Promise<void> {
    const session = await this.authorizeSession(sessionId, token, {
      requireActive: false,
    });
    if (session.status === UploadSessionStatus.COMPLETED) {
      throw new BadRequestException({
        error: 'Upload already completed',
        code: ErrorCodes.UPLOAD_SESSION_INVALID,
      });
    }
    await this.abortSessionStorage(session);
    await this.prisma.$transaction([
      this.prisma.uploadSession.update({
        where: { id: session.id },
        data: { status: UploadSessionStatus.ABORTED },
      }),
      this.prisma.storedFile.update({
        where: { id: session.storedFileId! },
        data: { status: FileStatus.FAILED },
      }),
    ]);
  }

  /** Best-effort storage cleanup for an unfinished session. */
  async abortSessionStorage(
    session: Pick<UploadSession, 'id' | 's3UploadId' | 'storageKey'>,
  ): Promise<void> {
    try {
      if (session.s3UploadId) {
        await this.storage.abortMultipartUpload(
          session.storageKey,
          session.s3UploadId,
        );
      } else {
        await this.storage.deleteObject(session.storageKey);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `Storage cleanup failed for upload session ${session.id}: ${msg}`,
      );
    }
  }
}
