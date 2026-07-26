import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { FilesController } from './files.controller';
import { FilesService } from './files.service';
import { FilesCleanupService } from './files.cleanup.service';
import { UploadsController } from './uploads.controller';
import { UploadsService } from './uploads.service';
import { AuthEmailModule } from '../auth/auth-email.module';
import { SEND_FILE_EMAIL_QUEUE } from '../jobs/job.constants';

@Module({
  imports: [
    AuthEmailModule,
    BullModule.registerQueue({ name: SEND_FILE_EMAIL_QUEUE }),
  ],
  // UploadsController must register before FilesController so that
  // "files/uploads/*" routes are not swallowed by "files/:id/*".
  controllers: [UploadsController, FilesController],
  providers: [FilesService, UploadsService, FilesCleanupService],
  exports: [FilesService],
})
export class FilesModule {}
