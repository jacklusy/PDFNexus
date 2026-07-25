import { BadRequestException, Injectable } from '@nestjs/common';
import { analyticsEventSchema, ErrorCodes } from '@pdfnexus/shared';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async track(body: unknown, country?: string | null) {
    const parsed = analyticsEventSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        error: 'Invalid analytics event',
        code: ErrorCodes.VALIDATION_ERROR,
      });
    }

    const data = parsed.data;
    const event = await this.prisma.analyticsEvent.create({
      data: {
        type: data.type,
        tool: data.tool,
        device: data.device,
        browser: data.browser,
        country: country ?? null,
        sessionId: data.sessionId,
      },
    });

    return { ok: true, id: event.id };
  }

  async summary(days = 7) {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const events = await this.prisma.analyticsEvent.findMany({
      where: { createdAt: { gte: since } },
      select: { type: true, tool: true, device: true, createdAt: true },
    });

    const byType: Record<string, number> = {};
    const byTool: Record<string, number> = {};
    const byDevice: Record<string, number> = {};

    for (const e of events) {
      byType[e.type] = (byType[e.type] ?? 0) + 1;
      if (e.tool) byTool[e.tool] = (byTool[e.tool] ?? 0) + 1;
      if (e.device) byDevice[e.device] = (byDevice[e.device] ?? 0) + 1;
    }

    return {
      since: since.toISOString(),
      total: events.length,
      byType,
      byTool,
      byDevice,
    };
  }
}
