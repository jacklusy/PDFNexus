import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { FileStatus, UploadSessionStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { UploadsService } from './uploads.service';

@Injectable()
export class FilesCleanupService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(FilesCleanupService.name);
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly uploads: UploadsService,
  ) {}

  onModuleInit(): void {
    void this.runCleanup();
    this.timer = setInterval(() => {
      void this.runCleanup();
    }, 60 * 60 * 1000);
    this.timer.unref?.();
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private async runCleanup(): Promise<void> {
    await this.cleanupExpired();
    await this.cleanupStaleUploadSessions();
  }

  async cleanupExpired(): Promise<void> {
    const now = new Date();
    const expired = await this.prisma.storedFile.findMany({
      where: {
        OR: [
          { expiresAt: { lt: now }, status: { not: FileStatus.EXPIRED } },
          { status: FileStatus.EXPIRED },
        ],
      },
      take: 100,
    });

    for (const file of expired) {
      try {
        await this.storage.deleteObject(file.storageKey);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.warn(`Failed to delete storage key ${file.id}: ${msg}`);
      }

      if (file.status !== FileStatus.EXPIRED) {
        await this.prisma.storedFile.update({
          where: { id: file.id },
          data: { status: FileStatus.EXPIRED },
        });
      }
    }

    if (expired.length > 0) {
      this.logger.log(`Cleaned up ${expired.length} expired file(s)`);
    }
  }

  /** Abort direct-to-storage sessions that were never completed. */
  async cleanupStaleUploadSessions(): Promise<void> {
    const now = new Date();
    const stale = await this.prisma.uploadSession.findMany({
      where: {
        status: {
          in: [UploadSessionStatus.PENDING, UploadSessionStatus.UPLOADING],
        },
        expiresAt: { lt: now },
      },
      take: 100,
    });

    for (const session of stale) {
      await this.uploads.abortSessionStorage(session);
      await this.prisma.$transaction([
        this.prisma.uploadSession.update({
          where: { id: session.id },
          data: { status: UploadSessionStatus.ABORTED },
        }),
        ...(session.storedFileId
          ? [
              this.prisma.storedFile.updateMany({
                where: {
                  id: session.storedFileId,
                  status: FileStatus.PENDING,
                },
                data: { status: FileStatus.FAILED },
              }),
            ]
          : []),
      ]);
    }

    if (stale.length > 0) {
      this.logger.log(`Aborted ${stale.length} stale upload session(s)`);
    }
  }
}
