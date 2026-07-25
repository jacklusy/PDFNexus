import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MulterModule } from '@nestjs/platform-express';
import { FilesController } from './files.controller';
import { FilesService } from './files.service';
import { FilesCleanupService } from './files.cleanup.service';
import { AuthEmailModule } from '../auth/auth-email.module';
import { SEND_FILE_EMAIL_QUEUE } from '../jobs/job.constants';
import {
  buildUploadMulterOptions,
  DEFAULT_MAX_UPLOAD_BYTES,
} from './upload-multer.options';

@Module({
  imports: [
    AuthEmailModule,
    BullModule.registerQueue({ name: SEND_FILE_EMAIL_QUEUE }),
    MulterModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        buildUploadMulterOptions(
          config.get<number>('MAX_UPLOAD_BYTES') ?? DEFAULT_MAX_UPLOAD_BYTES,
        ),
    }),
  ],
  controllers: [FilesController],
  providers: [FilesService, FilesCleanupService],
  exports: [FilesService],
})
export class FilesModule {}
