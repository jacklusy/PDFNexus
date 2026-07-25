'use client';

import React, { useEffect, useState } from 'react';
import { Bell } from 'lucide-react';
import {
  adminMarkAllNotificationsRead,
  adminMarkNotificationRead,
  adminNotifications,
} from '@/features/admin/api';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  SeverityBadge,
} from '@/features/admin/ui';
import { formatDate } from '@/features/admin/utils';

function mapSeverity(s: string): 'info' | 'warning' | 'critical' | 'error' {
  const v = s.toLowerCase();
  if (v === 'critical') return 'critical';
  if (v === 'warning') return 'warning';
  if (v === 'error') return 'error';
  return 'info';
}

export default function AdminNotificationsPage() {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setError(null);
    try {
      setData(await adminNotifications({ pageSize: 50 }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load notifications');
    }
  };

  useEffect(() => {
    void load();
  }, []);

  if (error) return <ErrorState message={error} onRetry={() => void load()} />;
  if (!data) return <LoadingState />;

  return (
    <div>
      <PageHeader
        title="Notifications"
        description={`${data.unread ?? 0} unread alerts`}
        actions={
          <button
            type="button"
            className="rounded-xl border border-[var(--color-border)] px-3 py-2 text-sm font-semibold"
            onClick={async () => {
              await adminMarkAllNotificationsRead();
              void load();
            }}
          >
            Mark all read
          </button>
        }
      />
      {(data.items || []).length === 0 ? (
        <EmptyState
          icon={Bell}
          title="No notifications"
          description="Alerts will appear here for critical errors and security events."
        />
      ) : (
        <ul className="space-y-3">
          {(data.items || []).map((n: any) => (
            <li
              key={n.id}
              className={`rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 ${
                n.readAt ? 'opacity-70' : ''
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="mb-1 flex items-center gap-2">
                    <SeverityBadge severity={mapSeverity(n.severity)} label={n.severity} />
                    <span className="text-xs text-[var(--color-muted)]">{n.type}</span>
                  </div>
                  <h3 className="font-semibold">{n.title}</h3>
                  <p className="mt-1 text-sm text-[var(--color-muted)]">{n.body}</p>
                  <p className="mt-2 text-xs text-[var(--color-muted)]">
                    {formatDate(n.createdAt)}
                  </p>
                </div>
                {!n.readAt ? (
                  <button
                    type="button"
                    className="text-xs font-semibold text-[var(--color-accent)]"
                    onClick={async () => {
                      await adminMarkNotificationRead(n.id);
                      void load();
                    }}
                  >
                    Mark read
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
