'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  Files,
  HardDrive,
  Percent,
  Server,
  Users,
  Workflow,
} from 'lucide-react';
import {
  adminOverview,
  type AdminOverview,
} from '@/features/admin/api';
import {
  AreaSeriesChart,
  ChartFrame,
  ErrorState,
  LoadingState,
  PageHeader,
  StatCard,
} from '@/features/admin/ui';
import { formatBytes } from '@/features/admin/utils';
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from '@/shared/ui';
import { useAdminAuth } from '@/features/admin/AdminAuthProvider';

export default function AdminOverviewPage() {
  const { hasPermission } = useAdminAuth();
  const [data, setData] = useState<AdminOverview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const ac = new AbortController();
    void (async () => {
      setError(null);
      try {
        setData(await adminOverview(ac.signal));
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;
        setError(err instanceof Error ? err.message : 'Failed to load overview');
      }
    })();
    return () => ac.abort();
  }, []);

  if (error) return <ErrorState message={error} onRetry={() => window.location.reload()} />;
  if (!data) return <LoadingState />;

  const chartData = [
    { name: 'Uploads', count: data.activity?.uploads ?? 0 },
    { name: 'Merges', count: data.activity?.merges ?? 0 },
    { name: 'Converts', count: data.activity?.conversions ?? 0 },
    { name: 'Downloads', count: data.activity?.downloads ?? 0 },
  ];

  const alerts: Array<{ tone: 'danger' | 'warning' | 'info'; text: string; href?: string }> = [];
  if ((data.health?.openErrors ?? 0) > 0) {
    alerts.push({
      tone: 'danger',
      text: `${data.health.openErrors} open error event(s)`,
      href: '/admin/errors',
    });
  }
  if ((data.operations?.failed ?? 0) > 0) {
    alerts.push({
      tone: 'warning',
      text: `${data.operations.failed} failed processing job(s)`,
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Overview"
        description="Live operational KPIs across users, files, processing, and API traffic."
      />

      {alerts.length > 0 ? (
        <Card className="border-[var(--color-warning)]/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-[var(--color-warning)]" />
              Alerts
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {alerts.map((a) =>
              a.href ? (
                <Link key={a.text} href={a.href}>
                  <Badge tone={a.tone}>{a.text}</Badge>
                </Link>
              ) : (
                <Badge key={a.text} tone={a.tone}>
                  {a.text}
                </Badge>
              ),
            )}
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total users"
          value={data.users?.total ?? 0}
          hint={`${data.users?.newToday ?? 0} new today · ${data.users?.active ?? 0} active`}
          icon={<Users className="h-4 w-4" />}
        />
        <StatCard
          label="Files"
          value={data.files?.total ?? 0}
          hint={`${data.files?.pdf ?? 0} PDF · ${data.files?.docx ?? 0} DOCX`}
          icon={<Files className="h-4 w-4" />}
        />
        <StatCard
          label="Storage used"
          value={formatBytes(data.files?.storageBytes ?? 0)}
          icon={<HardDrive className="h-4 w-4" />}
        />
        <StatCard
          label="Success rate"
          value={`${data.operations?.successRate ?? 0}%`}
          hint={`${data.operations?.failed ?? 0} failed · avg ${data.operations?.avgProcessingMs ?? 0}ms`}
          icon={<Percent className="h-4 w-4" />}
        />
        <StatCard
          label="API requests (7d)"
          value={(data.operations?.apiRequests7d ?? 0).toLocaleString()}
          icon={<Workflow className="h-4 w-4" />}
        />
        <StatCard
          label="Merges"
          value={data.activity?.merges ?? 0}
          hint={`${data.activity?.conversions ?? 0} conversions`}
          icon={<Workflow className="h-4 w-4" />}
        />
        <StatCard
          label="Admin sessions"
          value={data.admin?.activeSessions ?? 0}
          icon={<Server className="h-4 w-4" />}
        />
        <StatCard
          label="Open errors"
          value={data.health?.openErrors ?? 0}
          icon={<AlertTriangle className="h-4 w-4" />}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <ChartFrame
          title="Feature activity"
          subtitle="Lifetime event counts by product action"
          className="lg:col-span-2"
        >
          <AreaSeriesChart data={chartData} xKey="name" yKey="count" />
        </ChartFrame>

        <Card>
          <CardHeader>
            <CardTitle>Quick actions</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {hasPermission('analytics.read') ? (
              <Link href="/admin/analytics">
                <Button variant="outline" className="w-full justify-start">
                  Open analytics
                </Button>
              </Link>
            ) : null}
            {hasPermission('logs.read') ? (
              <Link href="/admin/logs">
                <Button variant="outline" className="w-full justify-start">
                  Inspect request logs
                </Button>
              </Link>
            ) : null}
            {hasPermission('errors.read') ? (
              <Link href="/admin/errors">
                <Button variant="outline" className="w-full justify-start">
                  Triage errors
                </Button>
              </Link>
            ) : null}
            {hasPermission('users.read') ? (
              <Link href="/admin/users">
                <Button variant="outline" className="w-full justify-start">
                  Manage users
                </Button>
              </Link>
            ) : null}
            {hasPermission('monitoring.read') ? (
              <Link href="/admin/monitoring">
                <Button variant="outline" className="w-full justify-start">
                  System monitoring
                </Button>
              </Link>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
