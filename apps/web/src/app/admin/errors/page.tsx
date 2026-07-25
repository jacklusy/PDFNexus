'use client';

import React, { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { adminErrors, adminResolveError } from '@/features/admin/api';
import {
  DataTable,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  SeverityBadge,
} from '@/features/admin/ui';
import { formatDate } from '@/features/admin/utils';

function mapSeverity(s: string): 'low' | 'medium' | 'high' | 'critical' | 'info' {
  const v = s.toLowerCase();
  if (v === 'critical' || v === 'high' || v === 'medium' || v === 'low') return v;
  return 'info';
}

export default function AdminErrorsPage() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('OPEN');
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setError(null);
    try {
      setData(
        await adminErrors({
          page,
          pageSize: 25,
          status: status || undefined,
        }),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load errors');
    }
  };

  useEffect(() => {
    void load();
  }, [page, status]);

  if (error) return <ErrorState message={error} onRetry={() => void load()} />;
  if (!data) return <LoadingState />;

  const totalPages = Math.max(1, Math.ceil(data.total / data.pageSize));

  return (
    <div>
      <PageHeader
        title="Error tracking"
        description="Deduplicated exceptions with frequency and resolution status."
      />
      <div className="mb-4">
        <select
          value={status}
          onChange={(e) => {
            setPage(1);
            setStatus(e.target.value);
          }}
          className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm"
        >
          <option value="">All</option>
          <option value="OPEN">Open</option>
          <option value="RESOLVED">Resolved</option>
        </select>
      </div>
      {data.items.length === 0 ? (
        <EmptyState
          icon={AlertTriangle}
          title="No errors"
          description="Nothing matches this filter."
        />
      ) : (
        <DataTable
          pagination={{
            page: data.page,
            totalPages,
            total: data.total,
            onPageChange: setPage,
          }}
        >
          <thead className="bg-[var(--color-surface-2)]">
            <tr>
              {['Severity', 'Source', 'Message', 'Count', 'Last seen', ''].map((h) => (
                <th
                  key={h || 'a'}
                  className="px-4 py-3 text-left text-xs font-semibold uppercase text-[var(--color-muted)]"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]">
            {data.items.map((r: any) => (
              <tr key={r.id}>
                <td className="px-4 py-3">
                  <SeverityBadge severity={mapSeverity(r.severity)} label={r.severity} />
                </td>
                <td className="px-4 py-3 text-sm">{r.source}</td>
                <td className="max-w-md truncate px-4 py-3 text-sm">{r.message}</td>
                <td className="px-4 py-3 text-sm tabular-nums">{r.occurrenceCount}</td>
                <td className="px-4 py-3 text-sm">{formatDate(r.lastSeenAt)}</td>
                <td className="px-4 py-3 text-sm">
                  {r.status === 'OPEN' ? (
                    <button
                      type="button"
                      className="font-semibold text-[var(--color-accent)]"
                      onClick={async () => {
                        await adminResolveError(r.id);
                        void load();
                      }}
                    >
                      Resolve
                    </button>
                  ) : (
                    r.status
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </DataTable>
      )}
    </div>
  );
}
