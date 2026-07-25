'use client';

import { useEffect, useState } from 'react';
import { Search, Download, FileText } from 'lucide-react';
import { adminDownload, adminLogs } from '@/features/admin/api';
import {
  PageHeader,
  DataTable,
  LoadingState,
  ErrorState,
  EmptyState,
  SeverityBadge,
} from '@/features/admin/ui';
import { formatDate, formatDuration } from '@/features/admin/utils';

export default function LogsPage() {
  const [data, setData] = useState<{
    items: any[];
    page: number;
    pageSize: number;
    total: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [method, setMethod] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      const logs = await adminLogs({
        page,
        pageSize: 50,
        search: debouncedSearch || undefined,
        method: method || undefined,
      });
      setData(logs);
    } catch (err: any) {
      setError(err.message || 'Failed to load logs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchData();
  }, [page, debouncedSearch, method]);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  const statusSeverity = (status: number) => {
    if (status < 300) return 'info';
    if (status < 400) return 'warning';
    return 'error';
  };

  if (loading && !data) return <LoadingState />;
  if (error && !data) return <ErrorState message={error} onRetry={fetchData} />;

  return (
    <div>
      <PageHeader
        title="Request Logs"
        description="HTTP request logs and API activity"
        actions={
          <button
            type="button"
            onClick={() =>
              void adminDownload(
                '/api/admin/logs/export',
                {
                  search: debouncedSearch || undefined,
                  method: method || undefined,
                },
                'request-logs.csv',
              )
            }
            className="flex items-center gap-2 rounded-lg bg-[var(--color-accent)] px-4 py-2 font-medium text-white"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </button>
        }
      />

      <div className="mb-6 flex flex-col gap-4 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-[var(--color-muted)]" />
          <input
            type="text"
            placeholder="Search logs..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] py-2 pl-10 pr-4"
          />
        </div>
        <select
          value={method}
          onChange={(e) => {
            setMethod(e.target.value);
            setPage(1);
          }}
          className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2"
        >
          <option value="">All Methods</option>
          {['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </div>

      {data && data.items.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No logs found"
          description="No logs match your search criteria"
        />
      ) : data ? (
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
              {['Timestamp', 'Method', 'Path', 'Status', 'Duration', 'User', 'IP'].map(
                (h) => (
                  <th
                    key={h}
                    className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--color-muted)]"
                  >
                    {h}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]">
            {data.items.map((log) => (
              <tr key={log.id} className="hover:bg-[var(--color-surface-2)]">
                <td className="whitespace-nowrap px-6 py-4 text-xs text-[var(--color-muted)]">
                  {formatDate(log.createdAt)}
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-xs font-semibold">
                  {log.method}
                </td>
                <td className="max-w-md truncate px-6 py-4 text-xs font-mono">
                  {log.path}
                </td>
                <td className="whitespace-nowrap px-6 py-4">
                  <SeverityBadge
                    severity={statusSeverity(log.statusCode)}
                    label={String(log.statusCode)}
                  />
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-xs">
                  {formatDuration(log.durationMs)}
                </td>
                <td className="max-w-[150px] truncate px-6 py-4 text-xs text-[var(--color-muted)]">
                  {log.userEmail || '—'}
                </td>
                <td className="whitespace-nowrap px-6 py-4 font-mono text-xs text-[var(--color-muted)]">
                  {log.ip || '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </DataTable>
      ) : null}
    </div>
  );
}
