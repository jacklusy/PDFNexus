import { Module } from '@nestjs/common';
import { AuthEmailModule } from '../auth/auth-email.module';
import { RedisModule } from '../redis/redis.module';
import { SameOriginGuard } from '../ocr/same-origin.guard';
import { CloudController } from './cloud.controller';
import { DriveService } from './drive.service';
import { GoogleOAuthService } from './google-oauth.service';

@Module({
  imports: [RedisModule, AuthEmailModule],
  controllers: [CloudController],
  providers: [GoogleOAuthService, DriveService, SameOriginGuard],
  exports: [DriveService, GoogleOAuthService],
})
export class CloudModule {}
