'use client';

import { Suspense } from 'react';
import dynamic from 'next/dynamic';
import AppErrorBoundary from '@/components/AppErrorBoundary';
import { CloudOAuthBanner } from '@/features/cloud/CloudOAuthBanner';

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
      <div className="min-h-screen">
        <div className="mx-auto max-w-6xl px-4 pt-4">
          <Suspense fallback={null}>
            <CloudOAuthBanner />
          </Suspense>
        </div>
        <WorkspaceApp />
      </div>
    </AppErrorBoundary>
  );
}
