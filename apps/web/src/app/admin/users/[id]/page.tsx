'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { adminUpdateUserStatus, adminUserDetail } from '@/features/admin/api';
import { ErrorState, LoadingState, PageHeader } from '@/features/admin/ui';
import { formatBytes, formatDate } from '@/features/admin/utils';

export default function AdminUserDetailPage() {
  const params = useParams<{ id: string }>();
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setError(null);
    try {
      setData(await adminUserDetail(params.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load user');
    }
  };

  useEffect(() => {
    void load();
  }, [params.id]);

  if (error) return <ErrorState message={error} onRetry={() => void load()} />;
  if (!data) return <LoadingState />;

  const user = data.user;

  return (
    <div>
      <PageHeader
        title={user.email}
        description={`Registered ${formatDate(user.createdAt)} · last active ${formatDate(user.lastSeenAt)}`}
        actions={
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                const next = user.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
                await adminUpdateUserStatus(user.id, next);
                await load();
              } finally {
                setBusy(false);
              }
            }}
            className="rounded-xl border border-[var(--color-border)] px-3 py-2 text-sm font-semibold"
          >
            {user.status === 'ACTIVE' ? 'Suspend' : 'Reactivate'}
          </button>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        {[
          ['Status', user.status],
          ['Files', String(data.fileCount)],
          ['Storage', formatBytes(data.storageBytes || 0)],
        ].map(([label, value]) => (
          <div
            key={label}
            className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4"
          >
            <div className="text-xs uppercase tracking-wide text-[var(--color-muted)]">
              {label}
            </div>
            <div className="mt-1 font-semibold">{value}</div>
          </div>
        ))}
      </div>

      <Section title="Uploaded files">
        <List
          items={(data.files || []).map((f: any) => ({
            id: f.id,
            primary: f.originalName,
            secondary: `${f.kind} · ${formatBytes(f.sizeBytes)} · ${f.status}`,
          }))}
        />
      </Section>
      <Section title="Downloads">
        <List
          items={(data.downloads || []).map((d: any) => ({
            id: d.id,
            primary: d.channel,
            secondary: formatDate(d.createdAt),
          }))}
        />
      </Section>
      <Section title="IP / device history">
        <p className="mb-2 text-xs text-[var(--color-muted)]">
          IPs: {(data.ipHistory || []).join(', ') || '—'}
        </p>
        <List
          items={(data.loginHistory || []).map((r: any) => ({
            id: r.id,
            primary: `${r.method} ${r.path}`,
            secondary: `${r.ip || '—'} · ${r.browser || '?'} / ${r.os || '?'} · ${formatDate(r.createdAt)}`,
          }))}
        />
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-6">
      <h2 className="mb-3 text-sm font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function List({
  items,
}: {
  items: Array<{ id: string; primary: string; secondary: string }>;
}) {
  if (!items.length) {
    return (
      <div className="rounded-2xl border border-dashed border-[var(--color-border)] p-6 text-sm text-[var(--color-muted)]">
        No records
      </div>
    );
  }
  return (
    <ul className="divide-y divide-[var(--color-border)] overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]">
      {items.map((item) => (
        <li key={item.id} className="px-4 py-3">
          <div className="text-sm font-medium">{item.primary}</div>
          <div className="text-xs text-[var(--color-muted)]">{item.secondary}</div>
        </li>
      ))}
    </ul>
  );
}
