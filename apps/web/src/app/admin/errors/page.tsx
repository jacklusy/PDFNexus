'use client';

import React, { Suspense, useEffect, useMemo, useState } from 'react';
import {
  adminDownload,
  adminErrors,
  adminResolveError,
} from '@/features/admin/api';
import {
  DataTable,
  ErrorState,
  FilterBar,
  LoadingState,
  PageHeader,
  SeverityBadge,
  useUrlFilters,
  type DataColumn,
} from '@/features/admin/ui';
import { formatDate } from '@/features/admin/utils';
import { Badge, Button } from '@/shared/ui';
import { useAdminAuth } from '@/features/admin/AdminAuthProvider';

type ErrorRow = {
  id: string;
  lastSeenAt: string;
  firstSeenAt: string;
  severity: string;
  status: string;
  source: string;
  message: string;
  occurrenceCount: number;
  stack?: string | null;
};

function mapSeverity(s: string): 'low' | 'medium' | 'high' | 'critical' | 'info' {
  const v = s.toLowerCase();
  if (v === 'critical' || v === 'high' || v === 'medium' || v === 'low') return v;
  return 'info';
}

function ErrorsInner() {
  const { hasPermission } = useAdminAuth();
  const { get, setMany } = useUrlFilters();
  const [data, setData] = useState<{
    items: ErrorRow[];
    total: number;
    page: number;
    pageSize: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const page = Math.max(1, Number(get('page') || 1));
  const pageSize = Math.max(10, Number(get('pageSize') || 25));
  const params = useMemo(
    () => ({
      page,
      pageSize,
      status: get('status') || 'OPEN',
      severity: get('severity') || undefined,
      search: get('search') || undefined,
      from: get('from') || undefined,
      to: get('to') || undefined,
    }),
    [get, page, pageSize],
  );

  const load = async (signal?: AbortSignal) => {
    setError(null);
    const res = await adminErrors(params, signal);
    setData(res as typeof data);
  };

  useEffect(() => {
    const ac = new AbortController();
    void load(ac.signal).catch((err) => {
      if (err?.name === 'AbortError') return;
      setError(err instanceof Error ? err.message : 'Failed to load errors');
    });
    return () => ac.abort();
  }, [params]);

  const columns: DataColumn<ErrorRow>[] = [
    {
      id: 'lastSeenAt',
      header: 'Last seen',
      mobilePrimary: true,
      cell: (r) => formatDate(r.lastSeenAt),
    },
    {
      id: 'severity',
      header: 'Severity',
      cell: (r) => <SeverityBadge severity={mapSeverity(r.severity)} />,
    },
    {
      id: 'status',
      header: 'Status',
      cell: (r) => (
        <Badge tone={r.status === 'OPEN' ? 'danger' : 'success'}>
          {r.status}
        </Badge>
      ),
    },
    { id: 'source', header: 'Source', cell: (r) => r.source },
    {
      id: 'message',
      header: 'Message',
      cell: (r) => (
        <span className="line-clamp-2 max-w-md text-xs">{r.message}</span>
      ),
    },
    {
      id: 'count',
      header: 'Count',
      cell: (r) => r.occurrenceCount,
    },
    {
      id: 'actions',
      header: '',
      cell: (r) =>
        r.status === 'OPEN' && hasPermission('errors.write') ? (
          <Button
            size="sm"
            variant="outline"
            onClick={async () => {
              await adminResolveError(r.id);
              await load();
            }}
          >
            Resolve
          </Button>
        ) : null,
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Error tracking"
        description="Deduplicated exceptions with frequency and resolution status."
        actions={
          <Button
            size="sm"
            loading={exporting}
            onClick={async () => {
              setExporting(true);
              try {
                await adminDownload(
                  '/api/admin/errors/export',
                  { ...params, format: 'xlsx' },
                  'errors.xlsx',
                );
              } finally {
                setExporting(false);
              }
            }}
          >
            Export
          </Button>
        }
      />
      <FilterBar
        filters={[
          {
            type: 'select',
            key: 'status',
            label: 'Status',
            options: [
              { value: 'OPEN', label: 'Open' },
              { value: 'RESOLVED', label: 'Resolved' },
            ],
          },
          {
            type: 'select',
            key: 'severity',
            label: 'Severity',
            options: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map((v) => ({
              value: v,
              label: v,
            })),
          },
          { type: 'text', key: 'search', label: 'Search' },
          { type: 'date', key: 'from', label: 'From' },
          { type: 'date', key: 'to', label: 'To' },
        ]}
      />
      {error && !data ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]">
          <DataTable
            columns={columns}
            rows={data?.items ?? []}
            total={data?.total ?? 0}
            page={page}
            pageSize={pageSize}
            loading={!data}
            onPageChange={(p) => setMany({ page: String(p) }, false)}
            onPageSizeChange={(s) =>
              setMany({ pageSize: String(s), page: '1' }, false)
            }
            expandable
            empty="No errors match these filters."
            renderExpanded={(r) => (
              <pre className="max-h-56 overflow-auto whitespace-pre-wrap">
                {r.stack || 'No stack trace'}
              </pre>
            )}
          />
        </div>
      )}
    </div>
  );
}

export default function AdminErrorsPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <ErrorsInner />
    </Suspense>
  );
}
