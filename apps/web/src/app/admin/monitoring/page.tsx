'use client';

import React, { useEffect, useState } from 'react';
import { adminMonitoring } from '@/features/admin/api';
import {
  ErrorState,
  LoadingState,
  PageHeader,
  StatCard,
} from '@/features/admin/ui';
import { formatBytes, formatDate } from '@/features/admin/utils';
import { Badge, Card, CardContent, CardHeader, CardTitle } from '@/shared/ui';

type QueueCounts = Record<string, number>;

export default function AdminMonitoringPage() {
  const [data, setData] = useState<Record<string, any> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async (signal?: AbortSignal) => {
    try {
      setData(await adminMonitoring(signal));
      setError(null);
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      setError(err instanceof Error ? err.message : 'Failed to load monitoring');
    }
  };

  useEffect(() => {
    const ac = new AbortController();
    void load(ac.signal);
    const id = window.setInterval(() => void load(), 12000);
    return () => {
      ac.abort();
      window.clearInterval(id);
    };
  }, []);

  if (error && !data) {
    return <ErrorState message={error} onRetry={() => void load()} />;
  }
  if (!data) return <LoadingState />;

  const memRatio = data.host?.memUsedRatio as number | undefined;
  const queues = (data.queues || {}) as Record<string, QueueCounts>;

  return (
    <div className="space-y-6">
      <PageHeader
        title="System monitoring"
        description="Live process, host, database, Redis, queues, and API latency. Auto-refreshes every 12s."
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Uptime"
          value={`${Math.floor((data.uptimeSec || 0) / 3600)}h`}
        />
        <StatCard
          label="Heap used"
          value={formatBytes(data.process?.heapUsed || 0)}
        />
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

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Queues</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {Object.keys(queues).length === 0 ? (
              <p className="text-sm text-[var(--color-muted)]">
                No queue data available
              </p>
            ) : (
              Object.entries(queues).map(([name, counts]) => (
                <div key={name}>
                  <div className="mb-2 text-xs font-bold uppercase tracking-wide text-[var(--color-muted)]">
                    {name}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(counts || {}).map(([k, v]) => (
                      <Badge
                        key={k}
                        tone={
                          k === 'failed' && Number(v) > 0 ? 'danger' : 'neutral'
                        }
                      >
                        {k}: {v}
                      </Badge>
                    ))}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Slow requests (1h)</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {(data.slowRequests || []).length === 0 ? (
                <li className="text-[var(--color-muted)]">None</li>
              ) : (
                (data.slowRequests || []).slice(0, 12).map(
                  (
                    r: {
                      method: string;
                      path: string;
                      durationMs: number;
                      createdAt: string;
                    },
                    i: number,
                  ) => (
                    <li key={i} className="flex justify-between gap-3">
                      <span className="truncate">
                        {r.method} {r.path}
                      </span>
                      <span className="shrink-0 tabular-nums text-[var(--color-muted)]">
                        {r.durationMs}ms · {formatDate(r.createdAt)}
                      </span>
                    </li>
                  ),
                )
              )}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
