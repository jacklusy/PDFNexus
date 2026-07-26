'use client';

import React, { Suspense, useEffect, useMemo, useState } from 'react';
import {
  adminDownload,
  adminLogs,
  type HttpLogRow,
} from '@/features/admin/api';
import {
  CopyValue,
  DataTable,
  ErrorState,
  FilterBar,
  LoadingState,
  PageHeader,
  SeverityBadge,
  useUrlFilters,
  type DataColumn,
} from '@/features/admin/ui';
import { formatDate, formatDuration } from '@/features/admin/utils';
import { Badge, Button } from '@/shared/ui';

function statusTone(status: number): 'success' | 'warning' | 'danger' | 'info' {
  if (status < 300) return 'success';
  if (status < 400) return 'info';
  if (status < 500) return 'warning';
  return 'danger';
}

function LogsInner() {
  const { get, setMany } = useUrlFilters();
  const [data, setData] = useState<{
    items: HttpLogRow[];
    page: number;
    pageSize: number;
    total: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);

  const page = Math.max(1, Number(get('page') || 1));
  const pageSize = Math.max(10, Number(get('pageSize') || 25));
  const sortBy = (get('sortBy') || 'createdAt') as
    | 'createdAt'
    | 'statusCode'
    | 'durationMs';
  const sort = (get('sort') || 'desc') as 'asc' | 'desc';

  const params = useMemo(
    () => ({
      page,
      pageSize,
      search: get('search') || undefined,
      method: get('method') || undefined,
      path: get('path') || undefined,
      statusMin: get('statusMin') || undefined,
      statusMax: get('statusMax') || undefined,
      from: get('from') || undefined,
      to: get('to') || undefined,
      os: get('os') || undefined,
      browser: get('browser') || undefined,
      deviceType: get('deviceType') || undefined,
      authStatus: get('authStatus') || undefined,
      ip: get('ip') || undefined,
      userEmail: get('userEmail') || undefined,
      sortBy,
      sort,
    }),
    [get, page, pageSize, sort, sortBy],
  );

  useEffect(() => {
    const ac = new AbortController();
    void (async () => {
      setLoading(true);
      setError('');
      try {
        const logs = await adminLogs(params, ac.signal);
        setData(logs);
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;
        setError(err instanceof Error ? err.message : 'Failed to load logs');
      } finally {
        setLoading(false);
      }
    })();
    return () => ac.abort();
  }, [params]);

  const columns: DataColumn<HttpLogRow>[] = [
    {
      id: 'createdAt',
      header: 'Time',
      sortable: true,
      mobilePrimary: true,
      cell: (r) => formatDate(r.createdAt),
    },
    {
      id: 'method',
      header: 'Method',
      cell: (r) => <Badge tone="neutral">{r.method}</Badge>,
    },
    {
      id: 'path',
      header: 'Path',
      cell: (r) => (
        <span className="font-mono text-xs">{r.path}</span>
      ),
    },
    {
      id: 'statusCode',
      header: 'Status',
      sortable: true,
      cell: (r) => (
        <Badge tone={statusTone(r.statusCode)}>{r.statusCode}</Badge>
      ),
    },
    {
      id: 'durationMs',
      header: 'Duration',
      sortable: true,
      cell: (r) => formatDuration(r.durationMs),
    },
    {
      id: 'ip',
      header: 'IP',
      cell: (r) => r.ip || '—',
    },
    {
      id: 'userEmail',
      header: 'User',
      cell: (r) => r.userEmail || '—',
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Request logs"
        description="Filterable HTTP request history with expandable detail."
        actions={
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              loading={exporting}
              onClick={async () => {
                setExporting(true);
                try {
                  await adminDownload(
                    '/api/admin/logs/export',
                    { ...params, format: 'csv' },
                    'request-logs.csv',
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
                    '/api/admin/logs/export',
                    { ...params, format: 'xlsx' },
                    'request-logs.xlsx',
                  );
                } finally {
                  setExporting(false);
                }
              }}
            >
              Export Excel
            </Button>
          </div>
        }
      />

      <FilterBar
        filters={[
          { type: 'text', key: 'search', label: 'Search', placeholder: 'path, IP, email…' },
          {
            type: 'select',
            key: 'method',
            label: 'Method',
            options: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map((v) => ({
              value: v,
              label: v,
            })),
          },
          { type: 'text', key: 'path', label: 'Path' },
          { type: 'text', key: 'statusMin', label: 'Status ≥' },
          { type: 'text', key: 'statusMax', label: 'Status ≤' },
          { type: 'date', key: 'from', label: 'From' },
          { type: 'date', key: 'to', label: 'To' },
          { type: 'text', key: 'os', label: 'OS' },
          { type: 'text', key: 'browser', label: 'Browser' },
          { type: 'text', key: 'deviceType', label: 'Device' },
          { type: 'text', key: 'authStatus', label: 'Auth' },
          { type: 'text', key: 'ip', label: 'IP' },
          { type: 'text', key: 'userEmail', label: 'User email' },
        ]}
      />

      {error && !data ? (
        <ErrorState message={error} onRetry={() => window.location.reload()} />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]">
          <DataTable
            columns={columns}
            rows={data?.items ?? []}
            total={data?.total ?? 0}
            page={page}
            pageSize={pageSize}
            loading={loading && !data}
            sortBy={sortBy}
            sortDir={sort}
            onSort={(id) => {
              if (sortBy === id) {
                setMany({ sort: sort === 'asc' ? 'desc' : 'asc' }, false);
              } else {
                setMany({ sortBy: id, sort: 'desc' }, false);
              }
            }}
            onPageChange={(p) => setMany({ page: String(p) }, false)}
            onPageSizeChange={(s) =>
              setMany({ pageSize: String(s), page: '1' }, false)
            }
            expandable
            empty="No request logs match these filters."
            renderExpanded={(r) => (
              <div className="grid gap-2 sm:grid-cols-2">
                <div>
                  <div className="font-semibold text-[var(--color-ink)]">
                    Request ID
                  </div>
                  <CopyValue value={r.requestId} />
                </div>
                <div>
                  <div className="font-semibold text-[var(--color-ink)]">
                    User agent
                  </div>
                  <p className="break-all">{r.userAgent || '—'}</p>
                </div>
                <div>
                  <div className="font-semibold text-[var(--color-ink)]">
                    Referrer
                  </div>
                  <p className="break-all">{r.referrer || '—'}</p>
                </div>
                <div>
                  <div className="font-semibold text-[var(--color-ink)]">
                    Client
                  </div>
                  <p>
                    {[r.os, r.browser, r.deviceType, r.authStatus]
                      .filter(Boolean)
                      .join(' · ') || '—'}
                  </p>
                </div>
                {r.errorMessage ? (
                  <div className="sm:col-span-2">
                    <div className="font-semibold text-[var(--color-danger)]">
                      Error
                    </div>
                    <p>{r.errorMessage}</p>
                  </div>
                ) : null}
                {r.queryJson ? (
                  <div className="sm:col-span-2">
                    <div className="font-semibold">Query</div>
                    <pre className="mt-1 overflow-x-auto rounded-lg bg-[var(--color-canvas)] p-2">
                      {r.queryJson}
                    </pre>
                  </div>
                ) : null}
                {r.bodyJson ? (
                  <div className="sm:col-span-2">
                    <div className="font-semibold">Body</div>
                    <pre className="mt-1 max-h-40 overflow-auto rounded-lg bg-[var(--color-canvas)] p-2">
                      {r.bodyJson}
                    </pre>
                  </div>
                ) : null}
                <SeverityBadge
                  severity={
                    r.statusCode >= 500
                      ? 'error'
                      : r.statusCode >= 400
                        ? 'warning'
                        : 'info'
                  }
                />
              </div>
            )}
          />
        </div>
      )}
    </div>
  );
}

export default function LogsPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <LogsInner />
    </Suspense>
  );
}
