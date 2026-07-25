import { ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

type DataTableProps = {
  children: ReactNode;
  pagination?: {
    page: number;
    totalPages: number;
    total: number;
    onPageChange: (page: number) => void;
  };
};

export function DataTable({ children, pagination }: DataTableProps) {
  return (
    <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          {children}
        </table>
      </div>
      {pagination && (
        <div className="px-6 py-4 border-t border-[var(--color-border)] flex items-center justify-between">
          <div className="text-sm text-[var(--color-muted)]">
            Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => pagination.onPageChange(pagination.page - 1)}
              disabled={pagination.page === 1}
              className="px-3 py-1.5 border border-[var(--color-border)] rounded-md text-sm font-medium text-[var(--color-ink)] hover:bg-[var(--color-surface-2)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => pagination.onPageChange(pagination.page + 1)}
              disabled={pagination.page === pagination.totalPages}
              className="px-3 py-1.5 border border-[var(--color-border)] rounded-md text-sm font-medium text-[var(--color-ink)] hover:bg-[var(--color-surface-2)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
