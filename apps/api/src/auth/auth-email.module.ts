import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { AuthEmailController } from './auth-email.controller';
import { AuthEmailService } from './auth-email.service';
import { CookieService } from './cookie.service';
import { VerifiedEmailGuard } from '../common/guards/verified-email.guard';
import { SEND_OTP_QUEUE } from '../jobs/job.constants';

@Module({
  imports: [BullModule.registerQueue({ name: SEND_OTP_QUEUE })],
  controllers: [AuthEmailController],
  providers: [AuthEmailService, CookieService, VerifiedEmailGuard],
  exports: [CookieService, VerifiedEmailGuard, AuthEmailService],
})
export class AuthEmailModule {}
