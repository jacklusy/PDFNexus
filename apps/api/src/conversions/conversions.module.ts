import { Module } from '@nestjs/common';
import { SameOriginGuard } from '../ocr/same-origin.guard';
import { ConversionsController } from './conversions.controller';
import { ConversionsService } from './conversions.service';

@Module({
  controllers: [ConversionsController],
  providers: [ConversionsService, SameOriginGuard],
})
export class ConversionsModule {}
