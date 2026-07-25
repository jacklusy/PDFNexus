'use client';

import React, { useEffect, useState } from 'react';
import { Shield } from 'lucide-react';
import { adminAudit } from '@/features/admin/api';
import {
  DataTable,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
} from '@/features/admin/ui';
import { formatDate } from '@/features/admin/utils';

export default function AdminAuditPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<any>(null);

  const load = async () => {
    setError(null);
    try {
      setData(await adminAudit({ page, pageSize: 25, search: search || undefined }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load audit log');
    }
  };

  useEffect(() => {
    void load();
  }, [page]);

  if (error) return <ErrorState message={error} onRetry={() => void load()} />;
  if (!data) return <LoadingState />;

  const totalPages = Math.max(1, Math.ceil(data.total / data.pageSize));

  return (
    <div>
      <PageHeader
        title="Audit trail"
        description="Administrative actions with before/after snapshots."
      />
      <div className="mb-4 flex gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search action, email, IP…"
          className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm"
        />
        <button
          type="button"
          onClick={() => {
            setPage(1);
            void load();
          }}
          className="rounded-xl bg-[var(--color-accent)] px-3 py-2 text-sm font-semibold text-white"
        >
          Search
        </button>
      </div>
      {data.items.length === 0 ? (
        <EmptyState icon={Shield} title="No audit events" description="Nothing recorded yet." />
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
              {['Time', 'Actor', 'Action', 'Resource', 'Result', 'IP'].map((h) => (
                <th
                  key={h}
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
                <td className="px-4 py-3 text-sm">
                  <button
                    type="button"
                    className="text-[var(--color-accent)]"
                    onClick={() => setSelected(r)}
                  >
                    {formatDate(r.createdAt)}
                  </button>
                </td>
                <td className="px-4 py-3 text-sm">{r.actorEmail || '—'}</td>
                <td className="px-4 py-3 text-sm">{r.action}</td>
                <td className="px-4 py-3 text-sm">{r.resourceType || '—'}</td>
                <td className="px-4 py-3 text-sm">{r.success ? 'OK' : 'Failed'}</td>
                <td className="px-4 py-3 font-mono text-xs">{r.ip || '—'}</td>
              </tr>
            ))}
          </tbody>
        </DataTable>
      )}

      {selected ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[80vh] w-full max-w-2xl overflow-auto rounded-2xl bg-[var(--color-surface)] p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-semibold">{selected.action}</h3>
              <button type="button" onClick={() => setSelected(null)}>
                Close
              </button>
            </div>
            <pre className="whitespace-pre-wrap text-xs text-[var(--color-muted)]">
              {JSON.stringify(
                {
                  before: selected.beforeJson
                    ? JSON.parse(selected.beforeJson)
                    : null,
                  after: selected.afterJson ? JSON.parse(selected.afterJson) : null,
                },
                null,
                2,
              )}
            </pre>
          </div>
        </div>
      ) : null}
    </div>
  );
}
