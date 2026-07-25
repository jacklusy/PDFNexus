import type { ReactNode } from 'react';
import { Activity, type LucideIcon } from 'lucide-react';

type StatCardProps = {
  title?: string;
  label?: string;
  value: ReactNode;
  icon?: LucideIcon | ReactNode;
  trend?: number;
  description?: string;
  hint?: string;
};

export function StatCard({
  title,
  label,
  value,
  icon,
  trend,
  description,
  hint,
}: StatCardProps) {
  const heading = title || label || '';
  const sub = description || hint;

  let iconNode: ReactNode;
  if (typeof icon === 'function') {
    const Icon = icon as LucideIcon;
    iconNode = <Icon className="h-6 w-6 text-[var(--color-accent)]" />;
  } else if (icon) {
    iconNode = icon;
  } else {
    iconNode = <Activity className="h-6 w-6 text-[var(--color-accent)]" />;
  }

  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-6 transition-colors">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-[var(--color-muted)]">{heading}</p>
          <p className="mt-2 text-3xl font-semibold text-[var(--color-ink)]">{value}</p>
          {sub ? (
            <p className="mt-1 text-sm text-[var(--color-muted)]">{sub}</p>
          ) : null}
          {trend !== undefined ? (
            <p
              className={`mt-2 text-sm font-medium ${
                trend >= 0
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-red-600 dark:text-red-400'
              }`}
            >
              {trend >= 0 ? '+' : ''}
              {trend.toFixed(1)}%
            </p>
          ) : null}
        </div>
        <div className="rounded-lg bg-[var(--color-accent-soft)] p-3">{iconNode}</div>
      </div>
    </div>
  );
}
