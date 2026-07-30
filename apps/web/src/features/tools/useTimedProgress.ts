'use client';

import { useEffect, useState } from 'react';

export function formatElapsed(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const mm = Math.floor(totalSec / 60);
  const ss = totalSec % 60;
  return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
}

/**
 * Starts an elapsed timer while `active` is true. Resets when inactive.
 */
export function useTimedProgress(active: boolean): {
  elapsedMs: number;
  elapsedLabel: string;
} {
  const [elapsedMs, setElapsedMs] = useState(0);

  useEffect(() => {
    if (!active) {
      setElapsedMs(0);
      return;
    }
    const started = Date.now();
    setElapsedMs(0);
    const id = window.setInterval(() => {
      setElapsedMs(Date.now() - started);
    }, 250);
    return () => window.clearInterval(id);
  }, [active]);

  return {
    elapsedMs,
    elapsedLabel: formatElapsed(elapsedMs),
  };
}
