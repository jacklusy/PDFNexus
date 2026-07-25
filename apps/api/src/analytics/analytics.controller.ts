import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { AnalyticsService } from './analytics.service';
import { AdminSessionGuard } from '../admin/auth/admin-session.guard';
import { RequirePermission } from '../admin/auth/require-permission.decorator';

@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Post('events')
  track(@Body() body: unknown, @Req() req: Request) {
    const countryHeader =
      (req.headers['cf-ipcountry'] as string | undefined) ||
      (req.headers['x-vercel-ip-country'] as string | undefined) ||
      null;
    return this.analytics.track(body, countryHeader);
  }

  /** Protected — use admin dashboard or /api/admin/analytics */
  @Get('summary')
  @UseGuards(AdminSessionGuard)
  @RequirePermission('analytics.read')
  summary(@Query('days') days?: string) {
    const n = days ? Number.parseInt(days, 10) : 7;
    return this.analytics.summary(
      Number.isFinite(n) && n > 0 ? Math.min(n, 90) : 7,
    );
  }
}
