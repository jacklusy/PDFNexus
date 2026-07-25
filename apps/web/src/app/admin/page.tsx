'use client';

import React, { useEffect, useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Files,
  HardDrive,
  Percent,
  Server,
  Users,
  Workflow,
} from 'lucide-react';
import { adminOverview } from '@/features/admin/api';
import {
  ErrorState,
  LoadingState,
  PageHeader,
  StatCard,
} from '@/features/admin/ui';
import { formatBytes } from '@/features/admin/utils';

export default function AdminOverviewPage() {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setError(null);
    try {
      setData(await adminOverview());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load overview');
    }
  };

  useEffect(() => {
    void load();
  }, []);

  if (error) return <ErrorState message={error} onRetry={() => void load()} />;
  if (!data) return <LoadingState />;

  const chartData = [
    { name: 'Uploads', value: data.activity?.uploads ?? 0 },
    { name: 'Merges', value: data.activity?.merges ?? 0 },
    { name: 'Converts', value: data.activity?.conversions ?? 0 },
    { name: 'Downloads', value: data.activity?.downloads ?? 0 },
  ];

  return (
    <div>
      <PageHeader
        title="Overview"
        description="System-wide KPIs refreshed from live operational data."
      />
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
          label="Merges / projects"
          value={data.activity?.merges ?? 0}
          hint={`${data.activity?.conversions ?? 0} conversions`}
          icon={<Workflow className="h-4 w-4" />}
        />
        <StatCard
          label="Admin sessions"
          value={data.admin?.activeSessions ?? 0}
          hint={`${data.admin?.openErrors ?? 0} open errors`}
          icon={<Server className="h-4 w-4" />}
        />
        <StatCard
          label="Uptime"
          value={`${Math.floor((data.uptimeSec ?? 0) / 3600)}h`}
          hint={`Redis ${data.health?.redis ? 'ok' : 'down'} · DB ok`}
          icon={<Server className="h-4 w-4" />}
        />
      </div>

      <div className="mt-6 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
        <h2 className="mb-4 text-sm font-semibold">Feature activity</h2>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="name" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Area
                type="monotone"
                dataKey="value"
                stroke="#0f766e"
                fill="#99f6e4"
                fillOpacity={0.5}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
