import { Module } from '@nestjs/common';
import { OcrController } from './ocr.controller';
import { OcrService } from './ocr.service';
import { SameOriginGuard } from './same-origin.guard';

@Module({
  controllers: [OcrController],
  providers: [OcrService, SameOriginGuard],
})
export class OcrModule {}
