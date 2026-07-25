import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

function rangeFromQuery(from?: string, to?: string, days = 30) {
  const end = to ? new Date(to) : new Date();
  const start = from
    ? new Date(from)
    : new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
  return { start, end };
}

@Injectable()
export class AdminAnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async reports(query: { from?: string; to?: string; days?: number }) {
    const { start, end } = rangeFromQuery(
      query.from,
      query.to,
      Number(query.days) || 30,
    );
    const where: Prisma.AnalyticsEventWhereInput = {
      createdAt: { gte: start, lte: end },
    };

    const events = await this.prisma.analyticsEvent.findMany({
      where,
      select: {
        type: true,
        tool: true,
        device: true,
        browser: true,
        country: true,
        createdAt: true,
      },
    });

    const byType: Record<string, number> = {};
    const byTool: Record<string, number> = {};
    const byDevice: Record<string, number> = {};
    const byBrowser: Record<string, number> = {};
    const byCountry: Record<string, number> = {};
    const byHour: Record<number, number> = {};
    const byDay: Record<string, number> = {};

    for (const e of events) {
      byType[e.type] = (byType[e.type] ?? 0) + 1;
      if (e.tool) byTool[e.tool] = (byTool[e.tool] ?? 0) + 1;
      if (e.device) byDevice[e.device] = (byDevice[e.device] ?? 0) + 1;
      if (e.browser) byBrowser[e.browser] = (byBrowser[e.browser] ?? 0) + 1;
      if (e.country) byCountry[e.country] = (byCountry[e.country] ?? 0) + 1;
      const hour = e.createdAt.getUTCHours();
      byHour[hour] = (byHour[hour] ?? 0) + 1;
      const day = e.createdAt.toISOString().slice(0, 10);
      byDay[day] = (byDay[day] ?? 0) + 1;
    }

    const userGrowth = await this.prisma.verifiedUser.groupBy({
      by: ['createdAt'],
      where: { createdAt: { gte: start, lte: end } },
      _count: true,
    });

    // Normalize user growth by day
    const usersByDay: Record<string, number> = {};
    for (const row of await this.prisma.$queryRaw<
      Array<{ day: Date; count: bigint }>
    >`
      SELECT date_trunc('day', "createdAt") as day, COUNT(*)::bigint as count
      FROM "VerifiedUser"
      WHERE "createdAt" >= ${start} AND "createdAt" <= ${end}
      GROUP BY 1
      ORDER BY 1
    `) {
      usersByDay[new Date(row.day).toISOString().slice(0, 10)] = Number(
        row.count,
      );
    }

    const processing = await this.prisma.processingLog.findMany({
      where: { createdAt: { gte: start, lte: end }, durationMs: { not: null } },
      select: { durationMs: true, status: true, createdAt: true },
    });

    const processingByDay: Record<
      string,
      { avgMs: number; count: number; failed: number }
    > = {};
    for (const p of processing) {
      const day = p.createdAt.toISOString().slice(0, 10);
      const bucket = processingByDay[day] ?? {
        avgMs: 0,
        count: 0,
        failed: 0,
      };
      bucket.count += 1;
      bucket.avgMs += p.durationMs ?? 0;
      if (p.status === 'failed') bucket.failed += 1;
      processingByDay[day] = bucket;
    }
    for (const day of Object.keys(processingByDay)) {
      const b = processingByDay[day];
      b.avgMs = b.count ? Math.round(b.avgMs / b.count) : 0;
    }

    const storageTrend = await this.prisma.$queryRaw<
      Array<{ day: Date; bytes: bigint }>
    >`
      SELECT date_trunc('day', "createdAt") as day, SUM("sizeBytes")::bigint as bytes
      FROM "StoredFile"
      WHERE "createdAt" >= ${start} AND "createdAt" <= ${end}
      GROUP BY 1
      ORDER BY 1
    `;

    const apiByDay = await this.prisma.$queryRaw<
      Array<{ day: Date; count: bigint; errors: bigint }>
    >`
      SELECT date_trunc('day', "createdAt") as day,
             COUNT(*)::bigint as count,
             SUM(CASE WHEN "statusCode" >= 500 THEN 1 ELSE 0 END)::bigint as errors
      FROM "HttpRequestLog"
      WHERE "createdAt" >= ${start} AND "createdAt" <= ${end}
      GROUP BY 1
      ORDER BY 1
    `;

    void userGrowth;

    return {
      from: start.toISOString(),
      to: end.toISOString(),
      totalEvents: events.length,
      byType,
      byTool,
      byDevice,
      byBrowser,
      byCountry,
      byHour,
      activityByDay: Object.entries(byDay)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, count]) => ({ date, count })),
      userGrowthByDay: Object.entries(usersByDay)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, count]) => ({ date, count })),
      processingByDay: Object.entries(processingByDay)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, v]) => ({ date, ...v })),
      storageByDay: storageTrend.map((r) => ({
        date: new Date(r.day).toISOString().slice(0, 10),
        bytes: Number(r.bytes),
      })),
      apiByDay: apiByDay.map((r) => ({
        date: new Date(r.day).toISOString().slice(0, 10),
        count: Number(r.count),
        errors: Number(r.errors),
      })),
      mostUsedFeatures: Object.entries(byType)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([name, count]) => ({ name, count })),
      peakHours: Object.entries(byHour)
        .map(([hour, count]) => ({ hour: Number(hour), count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5),
    };
  }

  async exportCsv(query: { from?: string; to?: string; days?: number }) {
    const data = await this.reports(query);
    const lines = [
      'metric,key,value',
      ...Object.entries(data.byType).map(
        ([k, v]) => `byType,${k},${v}`,
      ),
      ...data.activityByDay.map((d) => `activityByDay,${d.date},${d.count}`),
      ...data.userGrowthByDay.map(
        (d) => `userGrowthByDay,${d.date},${d.count}`,
      ),
    ];
    return lines.join('\n');
  }

  async exportExcel(query: { from?: string; to?: string; days?: number }) {
    const ExcelJS = await import('exceljs');
    const data = await this.reports(query);
    const wb = new ExcelJS.Workbook();
    const sheet = wb.addWorksheet('Analytics');
    sheet.addRow(['Metric', 'Key', 'Value']);
    for (const [k, v] of Object.entries(data.byType)) {
      sheet.addRow(['byType', k, v]);
    }
    for (const d of data.activityByDay) {
      sheet.addRow(['activityByDay', d.date, d.count]);
    }
    const buf = await wb.xlsx.writeBuffer();
    return Buffer.from(buf);
  }

  async exportPdf(query: { from?: string; to?: string; days?: number }) {
    const PDFDocument = (await import('pdfkit')).default;
    const data = await this.reports(query);
    return new Promise<Buffer>((resolve, reject) => {
      const doc = new PDFDocument({ margin: 40 });
      const chunks: Buffer[] = [];
      doc.on('data', (c) => chunks.push(c as Buffer));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
      doc.fontSize(18).text('PDFNexus Analytics Report', { underline: true });
      doc.moveDown();
      doc.fontSize(10).text(`From: ${data.from}`);
      doc.text(`To: ${data.to}`);
      doc.text(`Total events: ${data.totalEvents}`);
      doc.moveDown();
      doc.fontSize(12).text('By type');
      for (const [k, v] of Object.entries(data.byType)) {
        doc.fontSize(10).text(`  ${k}: ${v}`);
      }
      doc.end();
    });
  }
}
