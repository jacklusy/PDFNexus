'use client';

import dynamic from 'next/dynamic';
import React, { useMemo } from 'react';
import { Skeleton } from '@/shared/ui';

const ResponsiveContainer = dynamic(
  () => import('recharts').then((m) => m.ResponsiveContainer),
  { ssr: false, loading: () => <Skeleton className="h-full w-full" /> },
);
const AreaChart = dynamic(() => import('recharts').then((m) => m.AreaChart), {
  ssr: false,
});
const Area = dynamic(() => import('recharts').then((m) => m.Area), {
  ssr: false,
});
const BarChart = dynamic(() => import('recharts').then((m) => m.BarChart), {
  ssr: false,
});
const Bar = dynamic(() => import('recharts').then((m) => m.Bar), { ssr: false });
const LineChart = dynamic(() => import('recharts').then((m) => m.LineChart), {
  ssr: false,
});
const Line = dynamic(() => import('recharts').then((m) => m.Line), {
  ssr: false,
});
const PieChart = dynamic(() => import('recharts').then((m) => m.PieChart), {
  ssr: false,
});
const Pie = dynamic(() => import('recharts').then((m) => m.Pie), { ssr: false });
const Cell = dynamic(() => import('recharts').then((m) => m.Cell), {
  ssr: false,
});
const XAxis = dynamic(() => import('recharts').then((m) => m.XAxis), {
  ssr: false,
});
const YAxis = dynamic(() => import('recharts').then((m) => m.YAxis), {
  ssr: false,
});
const Tooltip = dynamic(() => import('recharts').then((m) => m.Tooltip), {
  ssr: false,
});
const CartesianGrid = dynamic(
  () => import('recharts').then((m) => m.CartesianGrid),
  { ssr: false },
);
const Legend = dynamic(() => import('recharts').then((m) => m.Legend), {
  ssr: false,
});

const CHART_COLORS = [
  'var(--color-chart-1)',
  'var(--color-chart-2)',
  'var(--color-chart-3)',
  'var(--color-chart-4)',
  'var(--color-chart-5)',
  'var(--color-chart-6)',
];

function useChartTheme() {
  return useMemo(
    () => ({
      tick: { fill: 'var(--color-muted)', fontSize: 11 },
      grid: 'var(--color-border)',
      tooltip: {
        backgroundColor: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 8,
        color: 'var(--color-ink)',
      },
    }),
    [],
  );
}

export function ChartFrame({
  title,
  subtitle,
  children,
  className,
  height = 260,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
  height?: number;
}) {
  return (
    <div
      className={`rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm ${className || ''}`}
    >
      <div className="mb-3">
        <h3 className="text-sm font-bold text-[var(--color-ink)]">{title}</h3>
        {subtitle ? (
          <p className="text-xs text-[var(--color-muted)]">{subtitle}</p>
        ) : null}
      </div>
      <div style={{ height }}>{children}</div>
    </div>
  );
}

export function AreaSeriesChart({
  data,
  xKey,
  yKey,
  yKey2,
  color = CHART_COLORS[0],
  color2 = CHART_COLORS[3],
}: {
  data: Array<Record<string, string | number>>;
  xKey: string;
  yKey: string;
  yKey2?: string;
  color?: string;
  color2?: string;
}) {
  const theme = useChartTheme();
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data}>
        <CartesianGrid stroke={theme.grid} strokeDasharray="3 3" />
        <XAxis dataKey={xKey} tick={theme.tick} />
        <YAxis tick={theme.tick} />
        <Tooltip contentStyle={theme.tooltip} />
        <Area
          type="monotone"
          dataKey={yKey}
          stroke={color}
          fill={color}
          fillOpacity={0.2}
        />
        {yKey2 ? (
          <Area
            type="monotone"
            dataKey={yKey2}
            stroke={color2}
            fill={color2}
            fillOpacity={0.15}
          />
        ) : null}
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function BarSeriesChart({
  data,
  xKey,
  yKey,
  layout = 'horizontal',
}: {
  data: Array<Record<string, string | number>>;
  xKey: string;
  yKey: string;
  layout?: 'horizontal' | 'vertical';
}) {
  const theme = useChartTheme();
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} layout={layout === 'vertical' ? 'vertical' : 'horizontal'}>
        <CartesianGrid stroke={theme.grid} strokeDasharray="3 3" />
        {layout === 'vertical' ? (
          <>
            <XAxis type="number" tick={theme.tick} />
            <YAxis type="category" dataKey={xKey} tick={theme.tick} width={80} />
          </>
        ) : (
          <>
            <XAxis dataKey={xKey} tick={theme.tick} />
            <YAxis tick={theme.tick} />
          </>
        )}
        <Tooltip contentStyle={theme.tooltip} />
        <Bar dataKey={yKey} fill={CHART_COLORS[0]} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function LineSeriesChart({
  data,
  xKey,
  lines,
}: {
  data: Array<Record<string, string | number>>;
  xKey: string;
  lines: Array<{ key: string; color?: string }>;
}) {
  const theme = useChartTheme();
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data}>
        <CartesianGrid stroke={theme.grid} strokeDasharray="3 3" />
        <XAxis dataKey={xKey} tick={theme.tick} />
        <YAxis tick={theme.tick} />
        <Tooltip contentStyle={theme.tooltip} />
        <Legend />
        {lines.map((l, i) => (
          <Line
            key={l.key}
            type="monotone"
            dataKey={l.key}
            stroke={l.color || CHART_COLORS[i % CHART_COLORS.length]}
            strokeWidth={2}
            dot={false}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

export function DonutChart({
  data,
}: {
  data: Array<{ name: string; value: number }>;
}) {
  const theme = useChartTheme();
  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          innerRadius="55%"
          outerRadius="80%"
          paddingAngle={2}
        >
          {data.map((_, i) => (
            <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
          ))}
        </Pie>
        <Tooltip contentStyle={theme.tooltip} />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
}

export { CHART_COLORS };
