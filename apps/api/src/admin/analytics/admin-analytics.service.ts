import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { AdminAnalyticsQuery } from '@pdfnexus/shared';
import { PrismaService } from '../../prisma/prisma.service';

function rangeFromQuery(from?: string, to?: string, days = 30) {
  const end = to ? new Date(to) : new Date();
  const start = from
    ? new Date(from)
    : new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
  return { start, end };
}

function sqlIn(column: string, values?: string[]) {
  if (!values?.length) return Prisma.empty;
  return Prisma.sql`AND ${Prisma.raw(`"${column}"`)} IN (${Prisma.join(values)})`;
}

function toCountMap(
  rows: Array<{ key: string | null; count: number | bigint }>,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const row of rows) {
    const key = row.key ?? 'unknown';
    out[key] = Number(row.count);
  }
  return out;
}

@Injectable()
export class AdminAnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  private buildWhere(
    query: AdminAnalyticsQuery,
  ): { start: Date; end: Date; where: Prisma.AnalyticsEventWhereInput } {
    const { start, end } = rangeFromQuery(
      query.from,
      query.to,
      Number(query.days) || 30,
    );
    const where: Prisma.AnalyticsEventWhereInput = {
      createdAt: { gte: start, lte: end },
    };
    if (query.type?.length) where.type = { in: query.type };
    if (query.tool?.length) where.tool = { in: query.tool };
    if (query.device?.length) where.device = { in: query.device };
    if (query.browser?.length) where.browser = { in: query.browser };
    if (query.country?.length) where.country = { in: query.country };
    if (query.os?.length) where.os = { in: query.os };
    return { start, end, where };
  }

  async reports(query: AdminAnalyticsQuery = {}) {
    const { start, end, where } = this.buildWhere(query);

    const [
      totalEvents,
      byTypeRows,
      byToolRows,
      byDeviceRows,
      byBrowserRows,
      byCountryRows,
      byOsRows,
      byHourRows,
      activityRows,
      usersByDay,
      processingRows,
      storageTrend,
      apiByDay,
    ] = await Promise.all([
      this.prisma.analyticsEvent.count({ where }),
      this.prisma.analyticsEvent.groupBy({
        by: ['type'],
        where,
        _count: { _all: true },
      }),
      this.prisma.analyticsEvent.groupBy({
        by: ['tool'],
        where: { ...where, tool: { not: null } },
        _count: { _all: true },
      }),
      this.prisma.analyticsEvent.groupBy({
        by: ['device'],
        where,
        _count: { _all: true },
      }),
      this.prisma.analyticsEvent.groupBy({
        by: ['browser'],
        where,
        _count: { _all: true },
      }),
      this.prisma.analyticsEvent.groupBy({
        by: ['country'],
        where,
        _count: { _all: true },
      }),
      this.prisma.analyticsEvent.groupBy({
        by: ['os'],
        where,
        _count: { _all: true },
      }),
      this.prisma.$queryRaw<Array<{ hour: number; count: bigint }>>`
        SELECT EXTRACT(HOUR FROM "createdAt")::int as hour, COUNT(*)::bigint as count
        FROM "AnalyticsEvent"
        WHERE "createdAt" >= ${start} AND "createdAt" <= ${end}
          ${sqlIn('type', query.type)}
          ${sqlIn('tool', query.tool)}
          ${sqlIn('device', query.device)}
          ${sqlIn('browser', query.browser)}
          ${sqlIn('country', query.country)}
          ${sqlIn('os', query.os)}
        GROUP BY 1
        ORDER BY 1
      `,
      this.prisma.$queryRaw<Array<{ day: Date; count: bigint }>>`
        SELECT date_trunc('day', "createdAt") as day, COUNT(*)::bigint as count
        FROM "AnalyticsEvent"
        WHERE "createdAt" >= ${start} AND "createdAt" <= ${end}
          ${sqlIn('type', query.type)}
          ${sqlIn('tool', query.tool)}
          ${sqlIn('device', query.device)}
          ${sqlIn('browser', query.browser)}
          ${sqlIn('country', query.country)}
          ${sqlIn('os', query.os)}
        GROUP BY 1
        ORDER BY 1
      `,
      this.prisma.$queryRaw<Array<{ day: Date; count: bigint }>>`
        SELECT date_trunc('day', "createdAt") as day, COUNT(*)::bigint as count
        FROM "VerifiedUser"
        WHERE "createdAt" >= ${start} AND "createdAt" <= ${end}
        GROUP BY 1
        ORDER BY 1
      `,
      this.prisma.$queryRaw<
        Array<{ day: Date; avg_ms: number | null; count: bigint; failed: bigint }>
      >`
        SELECT date_trunc('day', "createdAt") as day,
               AVG("durationMs")::float as avg_ms,
               COUNT(*)::bigint as count,
               SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END)::bigint as failed
        FROM "ProcessingLog"
        WHERE "createdAt" >= ${start} AND "createdAt" <= ${end}
          AND "durationMs" IS NOT NULL
        GROUP BY 1
        ORDER BY 1
      `,
      this.prisma.$queryRaw<Array<{ day: Date; bytes: bigint }>>`
        SELECT date_trunc('day', "createdAt") as day, SUM("sizeBytes")::bigint as bytes
        FROM "StoredFile"
        WHERE "createdAt" >= ${start} AND "createdAt" <= ${end}
        GROUP BY 1
        ORDER BY 1
      `,
      this.prisma.$queryRaw<
        Array<{ day: Date; count: bigint; errors: bigint }>
      >`
        SELECT date_trunc('day', "createdAt") as day,
               COUNT(*)::bigint as count,
               SUM(CASE WHEN "statusCode" >= 500 THEN 1 ELSE 0 END)::bigint as errors
        FROM "HttpRequestLog"
        WHERE "createdAt" >= ${start} AND "createdAt" <= ${end}
        GROUP BY 1
        ORDER BY 1
      `,
    ]);

    const byType = toCountMap(
      byTypeRows.map((r) => ({ key: r.type, count: r._count._all })),
    );
    const byTool = toCountMap(
      byToolRows.map((r) => ({ key: r.tool, count: r._count._all })),
    );
    const byDevice = toCountMap(
      byDeviceRows.map((r) => ({ key: r.device, count: r._count._all })),
    );
    const byBrowser = toCountMap(
      byBrowserRows.map((r) => ({ key: r.browser, count: r._count._all })),
    );
    const byCountry = toCountMap(
      byCountryRows.map((r) => ({ key: r.country, count: r._count._all })),
    );
    const byOs = toCountMap(
      byOsRows.map((r) => ({ key: r.os, count: r._count._all })),
    );
    const byHour: Record<number, number> = {};
    for (const row of byHourRows) {
      byHour[row.hour] = Number(row.count);
    }

    return {
      from: start.toISOString(),
      to: end.toISOString(),
      filters: {
        type: query.type ?? [],
        tool: query.tool ?? [],
        device: query.device ?? [],
        browser: query.browser ?? [],
        country: query.country ?? [],
        os: query.os ?? [],
      },
      totalEvents,
      byType,
      byTool,
      byDevice,
      byBrowser,
      byCountry,
      byOs,
      byHour,
      activityByDay: activityRows.map((r) => ({
        date: new Date(r.day).toISOString().slice(0, 10),
        count: Number(r.count),
      })),
      userGrowthByDay: usersByDay.map((r) => ({
        date: new Date(r.day).toISOString().slice(0, 10),
        count: Number(r.count),
      })),
      processingByDay: processingRows.map((r) => ({
        date: new Date(r.day).toISOString().slice(0, 10),
        avgMs: Math.round(r.avg_ms ?? 0),
        count: Number(r.count),
        failed: Number(r.failed),
      })),
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

  async exportCsv(query: AdminAnalyticsQuery = {}) {
    const data = await this.reports(query);
    const lines = [
      'metric,key,value',
      ...Object.entries(data.byType).map(([k, v]) => `byType,${k},${v}`),
      ...Object.entries(data.byTool).map(([k, v]) => `byTool,${k},${v}`),
      ...Object.entries(data.byDevice).map(([k, v]) => `byDevice,${k},${v}`),
      ...Object.entries(data.byBrowser).map(([k, v]) => `byBrowser,${k},${v}`),
      ...Object.entries(data.byCountry).map(([k, v]) => `byCountry,${k},${v}`),
      ...Object.entries(data.byOs).map(([k, v]) => `byOs,${k},${v}`),
      ...data.activityByDay.map((d) => `activityByDay,${d.date},${d.count}`),
      ...data.userGrowthByDay.map(
        (d) => `userGrowthByDay,${d.date},${d.count}`,
      ),
      ...data.processingByDay.map(
        (d) => `processingByDay,${d.date},${d.avgMs}`,
      ),
      ...data.storageByDay.map((d) => `storageByDay,${d.date},${d.bytes}`),
      ...data.apiByDay.map((d) => `apiByDay,${d.date},${d.count}`),
    ];
    return lines.join('\n');
  }

  async exportExcel(query: AdminAnalyticsQuery = {}) {
    const ExcelJS = await import('exceljs');
    const data = await this.reports(query);
    const wb = new ExcelJS.Workbook();
    wb.creator = 'PDFNexus';
    wb.created = new Date();

    const summary = wb.addWorksheet('Summary');
    summary.addRow(['PDFNexus Analytics Report']);
    summary.addRow(['From', data.from]);
    summary.addRow(['To', data.to]);
    summary.addRow(['Total events', data.totalEvents]);
    summary.addRow([]);
    summary.addRow(['Active filters']);
    summary.addRow(['type', (data.filters.type || []).join(', ') || '(all)']);
    summary.addRow(['tool', (data.filters.tool || []).join(', ') || '(all)']);
    summary.addRow([
      'device',
      (data.filters.device || []).join(', ') || '(all)',
    ]);
    summary.addRow([
      'browser',
      (data.filters.browser || []).join(', ') || '(all)',
    ]);
    summary.addRow([
      'country',
      (data.filters.country || []).join(', ') || '(all)',
    ]);
    summary.addRow(['os', (data.filters.os || []).join(', ') || '(all)']);

    const addMapSheet = (
      name: string,
      map: Record<string, number>,
      keyHeader: string,
    ) => {
      const sheet = wb.addWorksheet(name);
      sheet.addRow([keyHeader, 'Count']);
      for (const [k, v] of Object.entries(map).sort((a, b) => b[1] - a[1])) {
        sheet.addRow([k, v]);
      }
    };

    addMapSheet('By Type', data.byType, 'Type');
    addMapSheet('By Tool', data.byTool, 'Tool');
    addMapSheet('By Device', data.byDevice, 'Device');
    addMapSheet('By Browser', data.byBrowser, 'Browser');
    addMapSheet('By Country', data.byCountry, 'Country');
    addMapSheet('By OS', data.byOs, 'OS');

    const activity = wb.addWorksheet('Daily Activity');
    activity.addRow(['Date', 'Count']);
    for (const d of data.activityByDay) activity.addRow([d.date, d.count]);

    const growth = wb.addWorksheet('User Growth');
    growth.addRow(['Date', 'New users']);
    for (const d of data.userGrowthByDay) growth.addRow([d.date, d.count]);

    const processing = wb.addWorksheet('Processing');
    processing.addRow(['Date', 'Avg ms', 'Count', 'Failed']);
    for (const d of data.processingByDay) {
      processing.addRow([d.date, d.avgMs, d.count, d.failed]);
    }

    const storage = wb.addWorksheet('Storage');
    storage.addRow(['Date', 'Bytes']);
    for (const d of data.storageByDay) storage.addRow([d.date, d.bytes]);

    const api = wb.addWorksheet('API');
    api.addRow(['Date', 'Requests', '5xx errors']);
    for (const d of data.apiByDay) api.addRow([d.date, d.count, d.errors]);

    const buf = await wb.xlsx.writeBuffer();
    return Buffer.from(buf);
  }

  async exportPdf(query: AdminAnalyticsQuery = {}) {
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
      doc.moveDown();
      doc.fontSize(12).text('By device');
      for (const [k, v] of Object.entries(data.byDevice)) {
        doc.fontSize(10).text(`  ${k}: ${v}`);
      }
      doc.end();
    });
  }
}
