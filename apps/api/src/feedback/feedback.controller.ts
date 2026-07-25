import { Body, Controller, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { FeedbackService } from './feedback.service';

@Controller('feedback')
export class FeedbackController {
  constructor(private readonly feedback: FeedbackService) {}

  @Post()
  create(@Body() body: unknown, @Req() req: Request) {
    return this.feedback.create(body, req.headers['user-agent'] ?? null);
  }
}
