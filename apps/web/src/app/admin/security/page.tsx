'use client';

import React, { useEffect, useState } from 'react';
import { adminSecurity } from '@/features/admin/api';
import { ErrorState, LoadingState, PageHeader, StatCard } from '@/features/admin/ui';
import { formatDate } from '@/features/admin/utils';

export default function AdminSecurityPage() {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setError(null);
    try {
      setData(await adminSecurity());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load security');
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
        title="Security monitoring"
        description="Failed logins, unauthorized access, rate limits, and suspicious IPs."
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Failed logins (24h)" value={data.failedLogins24h} />
        <StatCard label="Lockouts (7d)" value={data.lockouts7d} />
        <StatCard label="401/403 (24h)" value={data.unauthorized24h} />
        <StatCard label="Rate limited (24h)" value={data.rateLimited24h} />
        <StatCard label="Claim downloads (24h)" value={data.claimDownloads24h} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <h2 className="mb-3 text-sm font-semibold">Suspicious IPs</h2>
          <ul className="space-y-2 text-sm">
            {(data.suspiciousIps || []).length === 0 ? (
              <li className="text-[var(--color-muted)]">None flagged</li>
            ) : (
              data.suspiciousIps.map((row: any) => (
                <li key={row.ip} className="flex justify-between">
                  <span>{row.ip}</span>
                  <span className="tabular-nums text-[var(--color-muted)]">
                    {row.failures} failures
                  </span>
                </li>
              ))
            )}
          </ul>
        </div>
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <h2 className="mb-3 text-sm font-semibold">Recent failed audits</h2>
          <ul className="space-y-2 text-sm">
            {(data.recentFailedAudits || []).slice(0, 15).map((row: any) => (
              <li key={row.id}>
                <div className="font-medium">{row.action}</div>
                <div className="text-xs text-[var(--color-muted)]">
                  {row.actorEmail || '—'} · {row.ip || '—'} · {formatDate(row.createdAt)}
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
