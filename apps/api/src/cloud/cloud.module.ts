import { Module } from '@nestjs/common';
import { RedisModule } from '../redis/redis.module';
import { SameOriginGuard } from '../ocr/same-origin.guard';
import { CloudController } from './cloud.controller';
import { CloudTokenStore } from './cloud-token-store';
import { DriveService } from './drive.service';
import { GoogleOAuthService } from './google-oauth.service';
import { DropboxOAuthService, DropboxService } from './dropbox.service';
import { OneDriveOAuthService, OneDriveService } from './onedrive.service';

@Module({
  imports: [RedisModule],
  controllers: [CloudController],
  providers: [
    CloudTokenStore,
    GoogleOAuthService,
    DriveService,
    DropboxOAuthService,
    DropboxService,
    OneDriveOAuthService,
    OneDriveService,
    SameOriginGuard,
  ],
  exports: [
    DriveService,
    GoogleOAuthService,
    DropboxService,
    OneDriveService,
  ],
})
export class CloudModule {}
