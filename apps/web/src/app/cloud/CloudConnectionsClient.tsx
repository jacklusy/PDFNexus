'use client';

import { Suspense } from 'react';
import { CloudConnectionsPanel } from '@/features/cloud/CloudConnectionsPanel';
import { CloudOAuthBanner } from '@/features/cloud/CloudOAuthBanner';

export function CloudConnectionsClient() {
  return (
    <div>
      <Suspense fallback={null}>
        <CloudOAuthBanner />
      </Suspense>
      <CloudConnectionsPanel />
    </div>
  );
}
