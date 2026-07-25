'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Users } from 'lucide-react';
import { adminUsers } from '@/features/admin/api';
import {
  DataTable,
  ErrorState,
  LoadingState,
  PageHeader,
  EmptyState,
} from '@/features/admin/ui';
import { formatBytes, formatDate } from '@/features/admin/utils';

export default function AdminUsersPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setError(null);
    try {
      setData(
        await adminUsers({
          page,
          pageSize: 25,
          search: search || undefined,
          status: status || undefined,
        }),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load users');
    }
  };

  useEffect(() => {
    void load();
  }, [page, status]);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div>
      <PageHeader
        title="Users"
        description="Product users verified via email download gate (not admin staff)."
      />
      <div className="mb-4 flex flex-wrap gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search email…"
          className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm"
        />
        <select
          value={status}
          onChange={(e) => {
            setPage(1);
            setStatus(e.target.value);
          }}
          className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm"
        >
          <option value="">All statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="SUSPENDED">Suspended</option>
        </select>
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
      {error ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : !data ? (
        <LoadingState />
      ) : data.items.length === 0 ? (
        <EmptyState icon={Users} title="No users" description="No verified users match." />
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
              {['Email', 'Status', 'Registered', 'Last active', 'Storage', 'Files'].map(
                (h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left text-xs font-semibold uppercase text-[var(--color-muted)]"
                  >
                    {h}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]">
            {data.items.map((r: any) => (
              <tr key={r.id}>
                <td className="px-4 py-3">
                  <Link
                    className="font-medium text-[var(--color-accent)]"
                    href={`/admin/users/${r.id}`}
                  >
                    {r.email}
                  </Link>
                </td>
                <td className="px-4 py-3 text-sm">{r.status}</td>
                <td className="px-4 py-3 text-sm">{formatDate(r.createdAt)}</td>
                <td className="px-4 py-3 text-sm">{formatDate(r.lastSeenAt)}</td>
                <td className="px-4 py-3 text-sm">{formatBytes(r.storageBytes || 0)}</td>
                <td className="px-4 py-3 text-sm">{r.fileCount}</td>
              </tr>
            ))}
          </tbody>
        </DataTable>
      )}
    </div>
  );
}
