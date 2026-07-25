'use client';

import React, { useEffect, useState } from 'react';
import { adminMonitoring } from '@/features/admin/api';
import { ErrorState, LoadingState, PageHeader, StatCard } from '@/features/admin/ui';
import { formatBytes, formatDate } from '@/features/admin/utils';

export default function AdminMonitoringPage() {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      setData(await adminMonitoring());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load monitoring');
    }
  };

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), 12000);
    return () => window.clearInterval(id);
  }, []);

  if (error && !data) return <ErrorState message={error} onRetry={() => void load()} />;
  if (!data) return <LoadingState />;

  const memRatio = data.host?.memUsedRatio;
  return (
    <div>
      <PageHeader
        title="System monitoring"
        description="Live process, host, database, Redis, queues, and API latency. Auto-refreshes every 12s."
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Uptime" value={`${Math.floor(data.uptimeSec / 3600)}h`} />
        <StatCard label="Heap used" value={formatBytes(data.process?.heapUsed || 0)} />
        <StatCard
          label="Host memory"
          value={memRatio != null ? `${Math.round(memRatio * 100)}%` : 'n/a'}
          hint={`${formatBytes(data.host?.freeMem || 0)} free`}
        />
        <StatCard
          label="DB latency"
          value={`${data.database?.latencyMs ?? '—'} ms`}
          hint={data.database?.ok ? 'healthy' : 'down'}
        />
        <StatCard
          label="Redis"
          value={data.redis?.ok ? 'OK' : 'DOWN'}
          hint={`${data.redis?.latencyMs ?? '—'} ms`}
        />
        <StatCard label="API p50" value={`${data.api?.p50 ?? 0} ms`} />
        <StatCard label="API p95" value={`${data.api?.p95 ?? 0} ms`} />
        <StatCard
          label="Failed jobs"
          value={data.failedJobs ?? 0}
          hint={`error rate ${data.api?.errorRate ?? 0}%`}
        />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <h2 className="mb-3 text-sm font-semibold">Queues</h2>
          <pre className="overflow-auto text-xs text-[var(--color-muted)]">
            {JSON.stringify(data.queues, null, 2)}
          </pre>
        </div>
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <h2 className="mb-3 text-sm font-semibold">Slow requests (1h)</h2>
          <ul className="space-y-2 text-sm">
            {(data.slowRequests || []).slice(0, 12).map((r: any, i: number) => (
              <li key={i} className="flex justify-between gap-3">
                <span className="truncate">
                  {r.method} {r.path}
                </span>
                <span className="tabular-nums text-[var(--color-muted)]">
                  {r.durationMs}ms · {formatDate(r.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
