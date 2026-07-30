'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

const PROVIDERS = ['drive', 'dropbox', 'onedrive'] as const;
type Provider = (typeof PROVIDERS)[number];

const LABELS: Record<Provider, string> = {
  drive: 'Google Drive',
  dropbox: 'Dropbox',
  onedrive: 'OneDrive',
};

const REASON_COPY: Record<string, string> = {
  oauth_denied: 'You cancelled or denied access.',
  missing_code: 'The provider did not return an authorization code.',
  invalid_state: 'The sign-in session expired. Try connecting again.',
  session_mismatch:
    'Your browser session did not match the sign-in request. Start connect again from this browser.',
  exchange_failed: 'Token exchange failed. Check app credentials and try again.',
};

function reasonMessage(reason: string | null): string {
  if (!reason) return 'Connection failed. Try again.';
  return REASON_COPY[reason] ?? `Connection failed (${reason}). Try again.`;
}

/**
 * Surfaces OAuth callback query params (?drive|dropbox|onedrive=error|connected&reason=).
 */
export function CloudOAuthBanner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [dismissed, setDismissed] = useState(false);

  const notice = useMemo(() => {
    for (const p of PROVIDERS) {
      const status = searchParams.get(p);
      if (!status) continue;
      const reason = searchParams.get('reason');
      return { provider: p, status, reason };
    }
    return null;
  }, [searchParams]);

  const clearQuery = useCallback(() => {
    const next = new URLSearchParams(searchParams.toString());
    for (const p of PROVIDERS) next.delete(p);
    next.delete('reason');
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [pathname, router, searchParams]);

  useEffect(() => {
    setDismissed(false);
  }, [notice?.provider, notice?.status, notice?.reason]);

  if (!notice || dismissed) return null;

  const label = LABELS[notice.provider];
  const isError = notice.status === 'error';
  const isConnected = notice.status === 'connected';
  if (!isError && !isConnected) return null;

  const message = isConnected
    ? `${label} connected. You can import or export PDFs when needed.`
    : `${label}: ${reasonMessage(notice.reason)}`;

  return (
    <div
      className={
        isError
          ? 'mb-4 rounded-xl border border-[var(--color-danger)]/40 bg-[var(--color-danger)]/5 px-4 py-3 text-sm text-[var(--color-danger)]'
          : 'mb-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-sm text-[var(--color-ink)]'
      }
      role={isError ? 'alert' : 'status'}
    >
      <div className="flex items-start justify-between gap-3">
        <p>{message}</p>
        <button
          type="button"
          className="shrink-0 text-xs font-medium text-[var(--color-muted)] underline-offset-2 hover:underline"
          onClick={() => {
            setDismissed(true);
            clearQuery();
          }}
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
