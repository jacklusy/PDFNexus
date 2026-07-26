'use client';

import React, { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { adminUsers } from '@/features/admin/api';
import {
  DataTable,
  ErrorState,
  FilterBar,
  LoadingState,
  PageHeader,
  useUrlFilters,
  type DataColumn,
} from '@/features/admin/ui';
import { formatBytes, formatDate } from '@/features/admin/utils';
import { Badge } from '@/shared/ui';

type UserRow = {
  id: string;
  email: string;
  status: string;
  createdAt: string;
  lastSeenAt?: string | null;
  fileCount?: number;
  storageBytes?: number;
};

function UsersInner() {
  const { get, setMany } = useUrlFilters();
  const [data, setData] = useState<{
    items: UserRow[];
    total: number;
    page: number;
    pageSize: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const page = Math.max(1, Number(get('page') || 1));
  const pageSize = Math.max(10, Number(get('pageSize') || 25));
  const params = useMemo(
    () => ({
      page,
      pageSize,
      search: get('search') || undefined,
      status: get('status') || undefined,
      from: get('from') || undefined,
      to: get('to') || undefined,
    }),
    [get, page, pageSize],
  );

  useEffect(() => {
    const ac = new AbortController();
    void (async () => {
      setError(null);
      try {
        const res = await adminUsers(params, ac.signal);
        setData(res as typeof data);
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;
        setError(err instanceof Error ? err.message : 'Failed to load users');
      }
    })();
    return () => ac.abort();
  }, [params]);

  const columns: DataColumn<UserRow>[] = [
    {
      id: 'email',
      header: 'Email',
      mobilePrimary: true,
      cell: (r) => (
        <Link
          href={`/admin/users/${r.id}`}
          className="font-semibold text-[var(--color-accent)] hover:underline"
        >
          {r.email}
        </Link>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      cell: (r) => (
        <Badge tone={r.status === 'ACTIVE' ? 'success' : 'warning'}>
          {r.status}
        </Badge>
      ),
    },
    {
      id: 'createdAt',
      header: 'Created',
      cell: (r) => formatDate(r.createdAt),
    },
    {
      id: 'lastSeenAt',
      header: 'Last seen',
      cell: (r) => (r.lastSeenAt ? formatDate(r.lastSeenAt) : '—'),
    },
    {
      id: 'files',
      header: 'Files',
      cell: (r) => r.fileCount ?? 0,
    },
    {
      id: 'storage',
      header: 'Storage',
      cell: (r) => formatBytes(r.storageBytes ?? 0),
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Users"
        description="Product users verified via email download gate (not admin staff)."
      />
      <FilterBar
        filters={[
          { type: 'text', key: 'search', label: 'Search email' },
          {
            type: 'select',
            key: 'status',
            label: 'Status',
            options: [
              { value: 'ACTIVE', label: 'Active' },
              { value: 'SUSPENDED', label: 'Suspended' },
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
            empty="No users match these filters."
          />
        </div>
      )}
    </div>
  );
}

export default function AdminUsersPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <UsersInner />
    </Suspense>
  );
}
