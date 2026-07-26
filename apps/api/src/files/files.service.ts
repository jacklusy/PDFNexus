import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';
import { FileStatus, DownloadChannel } from '@prisma/client';
import { ErrorCodes } from '@pdfnexus/shared';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { AuthEmailService } from '../auth/auth-email.service';

const DEFAULT_DOWNLOAD_TOKEN_TTL_HOURS = 24;

@Injectable()
export class FilesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly config: ConfigService,
    private readonly auth: AuthEmailService,
  ) {}

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

    const contentType =
      file.kind === 'DOCX'
        ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        : 'application/pdf';
    const url = await this.storage.presignGet(file.storageKey, 900, {
      fileName: file.originalName,
      contentType,
      disposition: 'attachment',
    });

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

  private downloadTokenTtlMs(): number {
    const hours =
      this.config.get<number>('DOWNLOAD_TOKEN_TTL_HOURS') ??
      DEFAULT_DOWNLOAD_TOKEN_TTL_HOURS;
    return hours * 60 * 60 * 1000;
  }

  private signDownloadToken(fileId: string, expiresAtSec: number): string {
    const secret = this.config.getOrThrow<string>('COOKIE_SECRET');
    return createHmac('sha256', secret)
      .update(`download:${fileId}:${expiresAtSec}`)
      .digest('hex')
      .slice(0, 32);
  }

  /** Expiring HMAC token: "<expiresAtSec>.<signature>". */
  createDownloadToken(fileId: string): string {
    const expiresAtSec = Math.floor(
      (Date.now() + this.downloadTokenTtlMs()) / 1000,
    );
    return `${expiresAtSec}.${this.signDownloadToken(fileId, expiresAtSec)}`;
  }

  verifyDownloadToken(fileId: string, token: string): boolean {
    const dotIndex = token.indexOf('.');
    if (dotIndex <= 0) return false;
    const expiresAtSec = Number.parseInt(token.slice(0, dotIndex), 10);
    const signature = token.slice(dotIndex + 1);
    if (!Number.isInteger(expiresAtSec) || !signature) return false;
    if (expiresAtSec * 1000 < Date.now()) return false;
    const expected = this.signDownloadToken(fileId, expiresAtSec);
    try {
      const a = Buffer.from(expected);
      const b = Buffer.from(signature);
      if (a.length !== b.length) return false;
      return timingSafeEqual(a, b);
    } catch {
      return false;
    }
  }
}
