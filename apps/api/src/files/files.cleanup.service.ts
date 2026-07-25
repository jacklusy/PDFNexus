import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { FileStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';

@Injectable()
export class FilesCleanupService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(FilesCleanupService.name);
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  onModuleInit(): void {
    void this.cleanupExpired();
    this.timer = setInterval(() => {
      void this.cleanupExpired();
    }, 60 * 60 * 1000);
    this.timer.unref?.();
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
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
}
