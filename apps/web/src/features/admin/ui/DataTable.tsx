'use client';

import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Copy, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Pagination, Skeleton } from '@/shared/ui';

export type DataColumn<T> = {
  id: string;
  header: string;
  sortable?: boolean;
  className?: string;
  cell: (row: T) => React.ReactNode;
  /** Compact value for mobile card subtitle */
  mobilePrimary?: boolean;
};

export function DataTable<T extends { id?: string }>({
  columns,
  rows,
  total,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  sortBy,
  sortDir,
  onSort,
  loading,
  empty,
  expandable,
  renderExpanded,
  getRowId,
}: {
  columns: DataColumn<T>[];
  rows: T[];
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (p: number) => void;
  onPageSizeChange?: (s: number) => void;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
  onSort?: (id: string) => void;
  loading?: boolean;
  empty?: React.ReactNode;
  expandable?: boolean;
  renderExpanded?: (row: T) => React.ReactNode;
  getRowId?: (row: T, index: number) => string;
}) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const idOf = (row: T, i: number) =>
    getRowId?.(row, i) ?? (row.id != null ? String(row.id) : String(i));

  const primaryCol = useMemo(
    () => columns.find((c) => c.mobilePrimary) || columns[0],
    [columns],
  );

  if (loading) {
    return (
      <div className="space-y-2 p-4" aria-busy>
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  if (!rows.length) {
    return (
      <div className="px-4 py-12 text-center text-sm text-[var(--color-muted)]">
        {empty || 'No results'}
      </div>
    );
  }

  return (
    <div>
      {/* Mobile cards */}
      <div className="space-y-3 p-3 md:hidden">
        {rows.map((row, i) => {
          const id = idOf(row, i);
          const open = expanded[id];
          return (
            <div
              key={id}
              className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 font-semibold text-[var(--color-ink)]">
                  {primaryCol?.cell(row)}
                </div>
                {expandable ? (
                  <button
                    type="button"
                    className="rounded-md p-1 text-[var(--color-muted)]"
                    aria-expanded={open}
                    onClick={() =>
                      setExpanded((s) => ({ ...s, [id]: !s[id] }))
                    }
                  >
                    {open ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </button>
                ) : null}
              </div>
              <dl className="mt-2 space-y-1.5 text-xs">
                {columns
                  .filter((c) => c !== primaryCol)
                  .map((c) => (
                    <div key={c.id} className="flex justify-between gap-3">
                      <dt className="text-[var(--color-muted)]">{c.header}</dt>
                      <dd className="text-right text-[var(--color-ink)]">
                        {c.cell(row)}
                      </dd>
                    </div>
                  ))}
              </dl>
              {expandable && open && renderExpanded ? (
                <div className="mt-3 border-t border-[var(--color-border)] pt-3 text-xs">
                  {renderExpanded(row)}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      {/* Desktop table */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[720px] border-collapse text-sm">
          <thead className="sticky top-0 z-10 bg-[var(--color-surface-2)] text-left text-[11px] font-bold uppercase tracking-wide text-[var(--color-muted)]">
            <tr>
              {expandable ? <th className="w-10 px-3 py-3" /> : null}
              {columns.map((c) => (
                <th key={c.id} className={cn('whitespace-nowrap px-4 py-3', c.className)}>
                  {c.sortable && onSort ? (
                    <button
                      type="button"
                      onClick={() => onSort(c.id)}
                      className="inline-flex items-center gap-1 hover:text-[var(--color-ink)]"
                      aria-sort={
                        sortBy === c.id
                          ? sortDir === 'asc'
                            ? 'ascending'
                            : 'descending'
                          : 'none'
                      }
                    >
                      {c.header}
                      {sortBy === c.id ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}
                    </button>
                  ) : (
                    c.header
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]">
            {rows.map((row, i) => {
              const id = idOf(row, i);
              const open = expanded[id];
              return (
                <React.Fragment key={id}>
                  <tr className="transition hover:bg-[var(--color-surface-2)]/60">
                    {expandable ? (
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          className="rounded-md p-1 text-[var(--color-muted)]"
                          aria-expanded={open}
                          aria-label="Toggle row details"
                          onClick={() =>
                            setExpanded((s) => ({ ...s, [id]: !s[id] }))
                          }
                        >
                          {open ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </button>
                      </td>
                    ) : null}
                    {columns.map((c) => (
                      <td
                        key={c.id}
                        className={cn(
                          'px-4 py-3 align-middle text-[var(--color-ink)]',
                          c.className,
                        )}
                      >
                        {c.cell(row)}
                      </td>
                    ))}
                  </tr>
                  {expandable && open && renderExpanded ? (
                    <tr className="bg-[var(--color-surface-2)]/40">
                      <td
                        colSpan={columns.length + 1}
                        className="px-4 py-3 text-xs text-[var(--color-muted)]"
                      >
                        {renderExpanded(row)}
                      </td>
                    </tr>
                  ) : null}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      <Pagination
        page={page}
        pageSize={pageSize}
        total={total}
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange}
      />
    </div>
  );
}

export function CopyValue({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      title="Copy"
      className="inline-flex max-w-full items-center gap-1 rounded-md px-1 py-0.5 font-mono text-[11px] text-[var(--color-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-ink)]"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1200);
        } catch {
          // ignore
        }
      }}
    >
      <span className="truncate">{value}</span>
      {copied ? (
        <Check className="h-3 w-3 shrink-0 text-[var(--color-success)]" />
      ) : (
        <Copy className="h-3 w-3 shrink-0" />
      )}
    </button>
  );
}
