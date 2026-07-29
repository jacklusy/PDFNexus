'use client';

/**
 * Run a module worker with progress + cancel via terminate.
 */
export function runWorkerTask<TRequest, TResult>(options: {
  workerUrl: URL;
  request: TRequest;
  transfer?: Transferable[];
  timeoutMs?: number;
  onProgress?: (current: number, total: number, message?: string) => void;
}): { promise: Promise<TResult>; cancel: () => void } {
  let worker: Worker | null = null;
  let settled = false;

  const cancel = () => {
    if (worker) {
      worker.terminate();
      worker = null;
    }
  };

  const promise = new Promise<TResult>((resolve, reject) => {
    worker = new Worker(options.workerUrl, { type: 'module' });
    const timeout = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      cancel();
      reject(new Error('Worker timed out'));
    }, options.timeoutMs ?? 180_000);

    worker.onmessage = (event: MessageEvent) => {
      const data = event.data;
      if (data?.type === 'progress') {
        options.onProgress?.(data.current, data.total, data.message);
        return;
      }
      clearTimeout(timeout);
      settled = true;
      cancel();
      if (data?.ok) resolve(data.result as TResult);
      else reject(new Error(data?.error || 'Worker failed'));
    };

    worker.onerror = (err) => {
      clearTimeout(timeout);
      if (settled) return;
      settled = true;
      cancel();
      reject(err.error ?? new Error(err.message || 'Worker error'));
    };

    worker.postMessage(options.request, options.transfer ?? []);
  });

  return { promise, cancel };
}
