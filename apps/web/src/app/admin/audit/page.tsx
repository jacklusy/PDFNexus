'use client';

import React, { Suspense, useEffect, useMemo, useState } from 'react';
import { adminAudit } from '@/features/admin/api';
import {
  DataTable,
  ErrorState,
  FilterBar,
  LoadingState,
  PageHeader,
  useAdminExport,
  useUrlFilters,
  type DataColumn,
} from '@/features/admin/ui';
import { formatDate } from '@/features/admin/utils';
import { Badge, Button, Dialog } from '@/shared/ui';

type AuditRow = {
  id: string;
  createdAt: string;
  actorEmail?: string | null;
  action: string;
  resourceType?: string | null;
  resourceId?: string | null;
  success: boolean;
  ip?: string | null;
  beforeJson?: string | null;
  afterJson?: string | null;
};

function AuditInner() {
  const { get, setMany } = useUrlFilters();
  const [data, setData] = useState<{
    items: AuditRow[];
    total: number;
    page: number;
    pageSize: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<AuditRow | null>(null);
  const exporter = useAdminExport();

  const page = Math.max(1, Number(get('page') || 1));
  const pageSize = Math.max(10, Number(get('pageSize') || 25));
  const params = useMemo(
    () => ({
      page,
      pageSize,
      search: get('search') || undefined,
      action: get('action') || undefined,
      from: get('from') || undefined,
      to: get('to') || undefined,
      actorEmail: get('actorEmail') || undefined,
      resourceType: get('resourceType') || undefined,
      success: get('success') || undefined,
    }),
    [get, page, pageSize],
  );

  useEffect(() => {
    const ac = new AbortController();
    void (async () => {
      setError(null);
      try {
        const res = await adminAudit(params, ac.signal);
        setData(res as typeof data);
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;
        setError(err instanceof Error ? err.message : 'Failed to load audit');
      }
    })();
    return () => ac.abort();
  }, [params]);

  const columns: DataColumn<AuditRow>[] = [
    {
      id: 'createdAt',
      header: 'Time',
      mobilePrimary: true,
      cell: (r) => formatDate(r.createdAt),
    },
    { id: 'actor', header: 'Actor', cell: (r) => r.actorEmail || '—' },
    { id: 'action', header: 'Action', cell: (r) => r.action },
    {
      id: 'resource',
      header: 'Resource',
      cell: (r) =>
        [r.resourceType, r.resourceId].filter(Boolean).join(' · ') || '—',
    },
    {
      id: 'success',
      header: 'Result',
      cell: (r) => (
        <Badge tone={r.success ? 'success' : 'danger'}>
          {r.success ? 'ok' : 'fail'}
        </Badge>
      ),
    },
    {
      id: 'detail',
      header: '',
      cell: (r) => (
        <Button size="sm" variant="ghost" onClick={() => setSelected(r)}>
          Details
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Audit trail"
        description="Administrative actions with before/after snapshots."
        actions={
          <Button
            size="sm"
            loading={exporter.busyKey === 'xlsx'}
            disabled={exporter.isExporting}
            onClick={() =>
              void exporter.run({
                key: 'xlsx',
                path: '/api/admin/audit/export',
                params: { ...params, format: 'xlsx' },
                filename: 'audit.xlsx',
                label: 'Audit log (Excel)',
              })
            }
          >
            Export
          </Button>
        }
      />
      <FilterBar
        filters={[
          { type: 'text', key: 'search', label: 'Search' },
          { type: 'text', key: 'action', label: 'Action' },
          { type: 'text', key: 'actorEmail', label: 'Actor email' },
          { type: 'text', key: 'resourceType', label: 'Resource type' },
          {
            type: 'select',
            key: 'success',
            label: 'Result',
            options: [
              { value: 'true', label: 'Success' },
              { value: 'false', label: 'Failure' },
            ],
          },
          { type: 'date', key: 'from', label: 'From' },
          { type: 'date', key: 'to', label: 'To' },
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
            loading={!data}
            onPageChange={(p) => setMany({ page: String(p) }, false)}
            onPageSizeChange={(s) =>
              setMany({ pageSize: String(s), page: '1' }, false)
            }
            empty="No audit events match these filters."
          />
        </div>
      )}
      <Dialog
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title="Audit detail"
        size="lg"
      >
        {selected ? (
          <div className="space-y-3 text-xs">
            <p>
              <strong>{selected.action}</strong> by{' '}
              {selected.actorEmail || 'system'} at{' '}
              {formatDate(selected.createdAt)}
            </p>
            {selected.beforeJson ? (
              <div>
                <div className="mb-1 font-semibold">Before</div>
                <pre className="max-h-48 overflow-auto rounded-lg bg-[var(--color-canvas)] p-2">
                  {selected.beforeJson}
                </pre>
              </div>
            ) : null}
            {selected.afterJson ? (
              <div>
                <div className="mb-1 font-semibold">After</div>
                <pre className="max-h-48 overflow-auto rounded-lg bg-[var(--color-canvas)] p-2">
                  {selected.afterJson}
                </pre>
              </div>
            ) : null}
          </div>
        ) : null}
      </Dialog>
      {exporter.modal}
    </div>
  );
}

export default function AdminAuditPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <AuditInner />
    </Suspense>
  );
}
