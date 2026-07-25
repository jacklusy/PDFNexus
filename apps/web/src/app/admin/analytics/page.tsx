'use client';

import React, { useEffect, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { adminAnalytics, adminDownload } from '@/features/admin/api';
import {
  DateRangePicker,
  ErrorState,
  LoadingState,
  PageHeader,
  StatCard,
} from '@/features/admin/ui';

export default function AdminAnalyticsPage() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setError(null);
    try {
      setData(await adminAnalytics({ days }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load analytics');
    }
  };

  useEffect(() => {
    void load();
  }, [days]);

  if (error) return <ErrorState message={error} onRetry={() => void load()} />;
  if (!data) return <LoadingState />;

  return (
    <div>
      <PageHeader
        title="Analytics & reports"
        description="Activity, growth, devices, geography, and API trends."
        actions={
          <>
            <DateRangePicker
              value={days}
              onChange={setDays}
              options={[1, 7, 30, 90, 365]}
            />
            <button
              type="button"
              className="rounded-xl border border-[var(--color-border)] px-3 py-2 text-sm font-medium"
              onClick={() =>
                void adminDownload(
                  '/api/admin/analytics/export',
                  { days, format: 'csv' },
                  'analytics.csv',
                )
              }
            >
              CSV
            </button>
            <button
              type="button"
              className="rounded-xl border border-[var(--color-border)] px-3 py-2 text-sm font-medium"
              onClick={() =>
                void adminDownload(
                  '/api/admin/analytics/export',
                  { days, format: 'xlsx' },
                  'analytics.xlsx',
                )
              }
            >
              Excel
            </button>
            <button
              type="button"
              className="rounded-xl border border-[var(--color-border)] px-3 py-2 text-sm font-medium"
              onClick={() =>
                void adminDownload(
                  '/api/admin/analytics/export',
                  { days, format: 'pdf' },
                  'analytics.pdf',
                )
              }
            >
              PDF
            </button>
          </>
        }
      />

      <div className="mb-4 grid gap-4 sm:grid-cols-3">
        <StatCard label="Events" value={data.totalEvents} />
        <StatCard
          label="Top feature"
          value={data.mostUsedFeatures?.[0]?.name ?? '—'}
          hint={
            data.mostUsedFeatures?.[0]
              ? `${data.mostUsedFeatures[0].count} events`
              : undefined
          }
        />
        <StatCard
          label="Peak hour (UTC)"
          value={
            data.peakHours?.[0]
              ? `${String(data.peakHours[0].hour).padStart(2, '0')}:00`
              : '—'
          }
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Daily activity" data={data.activityByDay} x="date" y="count" />
        <ChartCard title="User growth" data={data.userGrowthByDay} x="date" y="count" />
        <ChartCard title="API requests" data={data.apiByDay} x="date" y="count" />
        <ChartCard title="API errors" data={data.apiByDay} x="date" y="errors" />
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <Breakdown title="By type" map={data.byType} />
        <Breakdown title="By device" map={data.byDevice} />
        <Breakdown title="By country" map={data.byCountry} />
        <Breakdown title="By browser" map={data.byBrowser} />
        <Breakdown title="By tool" map={data.byTool} />
      </div>
    </div>
  );
}

function ChartCard({
  title,
  data,
  x,
  y,
}: {
  title: string;
  data: any[];
  x: string;
  y: string;
}) {
  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <h2 className="mb-3 text-sm font-semibold">{title}</h2>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data || []}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
            <XAxis dataKey={x} hide={(data?.length || 0) > 20} />
            <YAxis allowDecimals={false} />
            <Tooltip />
            <Bar dataKey={y} fill="#0f766e" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function Breakdown({ title, map }: { title: string; map: Record<string, number> }) {
  const entries = Object.entries(map || {}).sort((a, b) => b[1] - a[1]).slice(0, 8);
  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <h3 className="mb-3 text-sm font-semibold">{title}</h3>
      <ul className="space-y-2 text-sm">
        {entries.length === 0 ? (
          <li className="text-[var(--color-muted)]">No data</li>
        ) : (
          entries.map(([k, v]) => (
            <li key={k} className="flex justify-between gap-3">
              <span className="truncate text-[var(--color-muted)]">{k}</span>
              <span className="font-medium tabular-nums">{v}</span>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
