'use client';

import React, { useEffect, useState } from 'react';
import {
  adminMarkAllNotificationsRead,
  adminMarkNotificationRead,
  adminNotifications,
} from '@/features/admin/api';
import { Bell } from 'lucide-react';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  SeverityBadge,
} from '@/features/admin/ui';
import { formatDate } from '@/features/admin/utils';
import { Button, Card, CardContent } from '@/shared/ui';

function mapSeverity(s: string): 'info' | 'warning' | 'critical' | 'error' {
  const v = s.toLowerCase();
  if (v === 'critical') return 'critical';
  if (v === 'warning') return 'warning';
  if (v === 'error') return 'error';
  return 'info';
}

export default function AdminNotificationsPage() {
  const [data, setData] = useState<{
    items: Array<{
      id: string;
      title: string;
      body: string;
      severity: string;
      createdAt: string;
      readAt?: string | null;
    }>;
    unread: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async (signal?: AbortSignal) => {
    setError(null);
    setData(
          (await adminNotifications(
            { pageSize: 50 },
            signal,
          )) as unknown as {
            items: Array<{
              id: string;
              title: string;
              body: string;
              severity: string;
              createdAt: string;
              readAt?: string | null;
            }>;
            unread: number;
          },
        );
  };

  useEffect(() => {
    const ac = new AbortController();
    void load(ac.signal).catch((err) => {
      if (err?.name === 'AbortError') return;
      setError(err instanceof Error ? err.message : 'Failed to load notifications');
    });
    return () => ac.abort();
  }, []);

  if (error) return <ErrorState message={error} onRetry={() => void load()} />;
  if (!data) return <LoadingState />;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Notifications"
        description={`${data.unread ?? 0} unread alerts for your account`}
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              await adminMarkAllNotificationsRead();
              await load();
            }}
          >
            Mark all read
          </Button>
        }
      />
      {data.items.length === 0 ? (
        <EmptyState
          icon={Bell}
          title="No notifications"
          description="You’re all caught up."
        />
      ) : (
        <ul className="space-y-3">
          {data.items.map((n) => (
            <li key={n.id}>
              <Card
                className={
                  n.readAt ? 'opacity-70' : 'border-[var(--color-accent)]/40'
                }
              >
                <CardContent className="flex items-start justify-between gap-3 pt-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <SeverityBadge severity={mapSeverity(n.severity)} />
                      <h3 className="text-sm font-bold">{n.title}</h3>
                    </div>
                    <p className="mt-1 text-sm text-[var(--color-muted)]">
                      {n.body}
                    </p>
                    <p className="mt-2 text-[11px] text-[var(--color-muted)]">
                      {formatDate(n.createdAt)}
                    </p>
                  </div>
                  {!n.readAt ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={async () => {
                        await adminMarkNotificationRead(n.id);
                        await load();
                      }}
                    >
                      Mark read
                    </Button>
                  ) : null}
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
