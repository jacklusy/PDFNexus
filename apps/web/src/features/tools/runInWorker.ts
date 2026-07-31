'use client';

/**
 * Run a module worker with progress + cancel via terminate.
 * Cancel must settle the promise immediately (WorkerCancelledError), not wait for timeout.
 */
export class WorkerCancelledError extends Error {
  constructor(message = 'Cancelled') {
    super(message);
    this.name = 'WorkerCancelledError';
  }
}

export function runWorkerTask<TRequest, TResult>(options: {
  workerUrl: URL;
  request: TRequest;
  transfer?: Transferable[];
  timeoutMs?: number;
  onProgress?: (current: number, total: number, message?: string) => void;
}): { promise: Promise<TResult>; cancel: () => void } {
  let worker: Worker | null = null;
  let settled = false;
  let cancelled = false;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let rejectFn: ((err: Error) => void) | null = null;

  const cleanupWorker = () => {
    if (worker) {
      worker.terminate();
      worker = null;
    }
  };

  const clearTimer = () => {
    if (timeoutId != null) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  };

  const cancel = () => {
    cancelled = true;
    cleanupWorker();
    if (settled) return;
    settled = true;
    clearTimer();
    rejectFn?.(new WorkerCancelledError());
  };

  const promise = new Promise<TResult>((resolve, reject) => {
    rejectFn = reject;
    worker = new Worker(options.workerUrl, { type: 'module' });
    timeoutId = setTimeout(() => {
      if (settled) return;
      settled = true;
      cleanupWorker();
      reject(new Error('Worker timed out'));
    }, options.timeoutMs ?? 180_000);

    const settleReject = (err: Error) => {
      clearTimer();
      if (settled) return;
      settled = true;
      cleanupWorker();
      reject(cancelled ? new WorkerCancelledError() : err);
    };

    worker.onmessage = (event: MessageEvent) => {
      const data = event.data;
      if (data?.type === 'progress') {
        if (!cancelled) {
          options.onProgress?.(data.current, data.total, data.message);
        }
        return;
      }
      clearTimer();
      if (settled) return;
      settled = true;
      cleanupWorker();
      if (cancelled) {
        reject(new WorkerCancelledError());
        return;
      }
      if (data?.ok) resolve(data.result as TResult);
      else reject(new Error(data?.error || 'Worker failed'));
    };

    worker.onerror = (err) => {
      settleReject(err.error ?? new Error(err.message || 'Worker error'));
    };

    // If cancel raced before postMessage, don't start work.
    if (cancelled) {
      settleReject(new WorkerCancelledError());
      return;
    }

    worker.postMessage(options.request, options.transfer ?? []);
  });

  return { promise, cancel };
}

/**
 * Cancel a worker task and await settlement so the rejection is not orphaned.
 * Rejects with WorkerCancelledError on cancel; rethrows unexpected errors as-is.
 */
export async function cancelAndAwait<T>(
  cancel: () => void,
  promise: Promise<T>
): Promise<never> {
  cancel();
  try {
    await promise;
  } catch (e) {
    if (e instanceof WorkerCancelledError) throw e;
    throw e;
  }
  throw new WorkerCancelledError();
}

