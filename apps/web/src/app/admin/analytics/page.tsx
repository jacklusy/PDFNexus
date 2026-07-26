'use client';

import React, { Suspense, useEffect, useMemo, useState } from 'react';
import {
  adminAnalytics,
  adminDownload,
  type AnalyticsReport,
} from '@/features/admin/api';
import {
  AreaSeriesChart,
  BarSeriesChart,
  ChartFrame,
  DonutChart,
  ErrorState,
  FilterBar,
  LineSeriesChart,
  LoadingState,
  PageHeader,
  useUrlFilters,
} from '@/features/admin/ui';
import { Button, Card, CardContent, CardHeader, CardTitle } from '@/shared/ui';
import { useAdminAuth } from '@/features/admin/AdminAuthProvider';

const TYPE_OPTIONS = [
  'pageview',
  'upload_local',
  'merge',
  'convert',
  'verify_start',
  'verify_success',
  'download',
  'feature_use',
].map((v) => ({ value: v, label: v }));

const DEVICE_OPTIONS = ['desktop', 'mobile', 'tablet', 'unknown'].map((v) => ({
  value: v,
  label: v,
}));

function mapToSeries(map: Record<string, number>) {
  return Object.entries(map)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

function AnalyticsInner() {
  const { hasPermission } = useAdminAuth();
  const { get, getMulti, setMany } = useUrlFilters();
  const [data, setData] = useState<AnalyticsReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const params = useMemo(() => {
    const days = get('days') || '30';
    return {
      days,
      from: get('from') || undefined,
      to: get('to') || undefined,
      type: getMulti('type'),
      tool: getMulti('tool'),
      device: getMulti('device'),
      browser: getMulti('browser'),
      country: getMulti('country'),
      os: getMulti('os'),
    };
  }, [get, getMulti]);

  useEffect(() => {
    const ac = new AbortController();
    void (async () => {
      setError(null);
      try {
        setData(await adminAnalytics(params, ac.signal));
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;
        setError(err instanceof Error ? err.message : 'Failed to load analytics');
      }
    })();
    return () => ac.abort();
  }, [params]);

  const exportParams = useMemo(
    () => ({
      ...params,
      format: 'xlsx' as const,
    }),
    [params],
  );

  if (error) {
    return <ErrorState message={error} onRetry={() => window.location.reload()} />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Analytics"
        description="Filtered product analytics. Exports honour the same filters as the charts."
        actions={
          hasPermission('analytics.export') ? (
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                loading={exporting}
                onClick={async () => {
                  setExporting(true);
                  try {
                    await adminDownload(
                      '/api/admin/analytics/export',
                      { ...params, format: 'csv' },
                      'analytics.csv',
                    );
                  } finally {
                    setExporting(false);
                  }
                }}
              >
                Export CSV
              </Button>
              <Button
                size="sm"
                loading={exporting}
                onClick={async () => {
                  setExporting(true);
                  try {
                    await adminDownload(
                      '/api/admin/analytics/export',
                      exportParams,
                      'analytics.xlsx',
                    );
                  } finally {
                    setExporting(false);
                  }
                }}
              >
                Export Excel
              </Button>
            </div>
          ) : null
        }
      />

      <Card>
        <CardContent className="pt-4">
          <FilterBar
            filters={[
              {
                type: 'select',
                key: 'days',
                label: 'Range',
                options: [
                  { value: '7', label: 'Last 7 days' },
                  { value: '14', label: 'Last 14 days' },
                  { value: '30', label: 'Last 30 days' },
                  { value: '90', label: 'Last 90 days' },
                ],
              },
              { type: 'date', key: 'from', label: 'From' },
              { type: 'date', key: 'to', label: 'To' },
              {
                type: 'multiselect',
                key: 'type',
                label: 'Event type',
                options: TYPE_OPTIONS,
              },
              {
                type: 'multiselect',
                key: 'device',
                label: 'Device',
                options: DEVICE_OPTIONS,
              },
              {
                type: 'text',
                key: 'browser',
                label: 'Browser',
                placeholder: 'chrome,firefox…',
              },
              {
                type: 'text',
                key: 'country',
                label: 'Country',
                placeholder: 'US,GB…',
              },
              {
                type: 'text',
                key: 'os',
                label: 'OS',
                placeholder: 'windows,macos…',
              },
              {
                type: 'text',
                key: 'tool',
                label: 'Tool / path',
                placeholder: 'merge,/guide…',
              },
            ]}
            trailing={
              <div className="flex gap-1 pb-0.5">
                {[7, 14, 30, 90].map((d) => (
                  <Button
                    key={d}
                    size="sm"
                    variant={get('days') === String(d) ? 'primary' : 'outline'}
                    onClick={() => setMany({ days: String(d), from: null, to: null })}
                  >
                    {d}d
                  </Button>
                ))}
              </div>
            }
          />
          <p className="mt-2 text-[11px] text-[var(--color-muted)]">
            Note: analytics has no user/role/status fields. OS is only present on
            events ingested after the OS field was added (older rows show as
            unknown).
          </p>
        </CardContent>
      </Card>

      {!data ? (
        <LoadingState />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Card>
              <CardHeader>
                <CardTitle>Total events</CardTitle>
              </CardHeader>
              <CardContent className="text-2xl font-bold">
                {data.totalEvents.toLocaleString()}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Top feature</CardTitle>
              </CardHeader>
              <CardContent className="text-sm font-semibold">
                {data.mostUsedFeatures[0]?.name ?? '—'}{' '}
                <span className="text-[var(--color-muted)]">
                  ({data.mostUsedFeatures[0]?.count ?? 0})
                </span>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Peak hour</CardTitle>
              </CardHeader>
              <CardContent className="text-sm font-semibold">
                {data.peakHours[0]
                  ? `${String(data.peakHours[0].hour).padStart(2, '0')}:00 (${data.peakHours[0].count})`
                  : '—'}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Window</CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-[var(--color-muted)]">
                {data.from.slice(0, 10)} → {data.to.slice(0, 10)}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <ChartFrame
              title="Daily activity"
              subtitle="How many analytics events per day?"
            >
              <AreaSeriesChart
                data={data.activityByDay}
                xKey="date"
                yKey="count"
              />
            </ChartFrame>
            <ChartFrame
              title="Feature usage"
              subtitle="Which event types dominate?"
            >
              <BarSeriesChart
                data={mapToSeries(data.byType)}
                xKey="name"
                yKey="value"
              />
            </ChartFrame>
            <ChartFrame title="Devices" subtitle="Desktop vs mobile vs tablet">
              <DonutChart data={mapToSeries(data.byDevice)} />
            </ChartFrame>
            <ChartFrame title="Browsers" subtitle="Client browser mix">
              <DonutChart data={mapToSeries(data.byBrowser)} />
            </ChartFrame>
            <ChartFrame
              title="Countries"
              subtitle="Top geo origins (ranked)"
            >
              <BarSeriesChart
                data={mapToSeries(data.byCountry).slice(0, 12)}
                xKey="name"
                yKey="value"
                layout="vertical"
              />
            </ChartFrame>
            <ChartFrame title="Operating systems" subtitle="Including unknown historical">
              <DonutChart data={mapToSeries(data.byOs)} />
            </ChartFrame>
            <ChartFrame
              title="Processing duration"
              subtitle="Avg ms with failed overlay"
              className="lg:col-span-2"
            >
              <LineSeriesChart
                data={data.processingByDay.map((d) => ({
                  date: d.date,
                  avgMs: d.avgMs,
                  failed: d.failed,
                }))}
                xKey="date"
                lines={[
                  { key: 'avgMs' },
                  { key: 'failed', color: 'var(--color-danger)' },
                ]}
              />
            </ChartFrame>
            <ChartFrame title="Storage growth" subtitle="Bytes uploaded per day">
              <AreaSeriesChart
                data={data.storageByDay}
                xKey="date"
                yKey="bytes"
              />
            </ChartFrame>
            <ChartFrame
              title="API volume vs 5xx"
              subtitle="Request count with server errors"
            >
              <AreaSeriesChart
                data={data.apiByDay}
                xKey="date"
                yKey="count"
                yKey2="errors"
              />
            </ChartFrame>
            <ChartFrame
              title="User growth"
              subtitle="New verified users per day"
              className="lg:col-span-2"
            >
              <AreaSeriesChart
                data={data.userGrowthByDay}
                xKey="date"
                yKey="count"
                color="var(--color-chart-2)"
              />
            </ChartFrame>
          </div>
        </>
      )}
    </div>
  );
}

export default function AdminAnalyticsPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <AnalyticsInner />
    </Suspense>
  );
}
