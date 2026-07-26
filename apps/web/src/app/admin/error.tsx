'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/shared/ui';

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 p-8 text-center">
      <h2 className="text-lg font-bold text-[var(--color-ink)]">
        Something went wrong
      </h2>
      <p className="max-w-md text-sm text-[var(--color-muted)]">
        {error.message || 'An unexpected error occurred in the admin console.'}
      </p>
      <div className="flex gap-2">
        <Button onClick={reset}>Try again</Button>
        <Link
          href="/admin"
          className="inline-flex h-9 items-center justify-center rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-4 text-sm font-semibold"
        >
          Back to overview
        </Link>
      </div>
    </div>
  );
}
