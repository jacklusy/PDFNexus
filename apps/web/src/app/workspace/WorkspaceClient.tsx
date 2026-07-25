'use client';

import dynamic from 'next/dynamic';
import AppErrorBoundary from '@/components/AppErrorBoundary';

const WorkspaceApp = dynamic(
  () => import('@/features/workspace/WorkspaceApp').then((m) => m.default),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-screen items-center justify-center bg-[color:var(--color-canvas)] text-sm text-[color:var(--color-muted)]">
        Loading workspace…
      </div>
    ),
  }
);

export default function WorkspaceClient() {
  return (
    <AppErrorBoundary>
      <WorkspaceApp />
    </AppErrorBoundary>
  );
}
