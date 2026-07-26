import React from 'react';
import { cn } from '@/lib/utils';

export function Table({
  className,
  children,
  ...props
}: React.TableHTMLAttributes<HTMLTableElement>) {
  return (
    <div className="w-full overflow-x-auto">
      <table
        className={cn('w-full min-w-[640px] border-collapse text-sm', className)}
        {...props}
      >
        {children}
      </table>
    </div>
  );
}

export function THead({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead
      className={cn(
        'sticky top-0 z-10 bg-[var(--color-surface-2)] text-left text-[11px] font-bold uppercase tracking-wide text-[var(--color-muted)]',
        className,
      )}
      {...props}
    >
      {children}
    </thead>
  );
}

export function TBody({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <tbody
      className={cn('divide-y divide-[var(--color-border)]', className)}
      {...props}
    >
      {children}
    </tbody>
  );
}

export function TR({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={cn(
        'transition hover:bg-[var(--color-surface-2)]/60',
        className,
      )}
      {...props}
    >
      {children}
    </tr>
  );
}

export function TH({
  className,
  children,
  sortable,
  sorted,
  onSort,
  ...props
}: React.ThHTMLAttributes<HTMLTableCellElement> & {
  sortable?: boolean;
  sorted?: 'asc' | 'desc' | false;
  onSort?: () => void;
}) {
  const content = (
    <>
      {children}
      {sortable && sorted === 'asc' ? ' ↑' : null}
      {sortable && sorted === 'desc' ? ' ↓' : null}
    </>
  );
  return (
    <th
      className={cn('whitespace-nowrap px-4 py-3', className)}
      aria-sort={
        sorted === 'asc'
          ? 'ascending'
          : sorted === 'desc'
            ? 'descending'
            : sortable
              ? 'none'
              : undefined
      }
      {...props}
    >
      {sortable ? (
        <button
          type="button"
          onClick={onSort}
          className="inline-flex items-center gap-1 font-bold uppercase tracking-wide hover:text-[var(--color-ink)]"
        >
          {content}
        </button>
      ) : (
        content
      )}
    </th>
  );
}

export function TD({
  className,
  children,
  ...props
}: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td
      className={cn('px-4 py-3 align-middle text-[var(--color-ink)]', className)}
      {...props}
    >
      {children}
    </td>
  );
}
