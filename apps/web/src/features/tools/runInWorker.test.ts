import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runWorkerTask, WorkerCancelledError } from './runInWorker';

type Handler = ((event: MessageEvent) => void) | null;

class FakeWorker {
  onmessage: Handler = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  terminated = false;
  static last: FakeWorker | null = null;

  constructor(_url: URL | string, _opts?: { type?: string }) {
    FakeWorker.last = this;
  }

  postMessage(_data: unknown, _transfer?: Transferable[]) {
    // no-op; tests drive onmessage / cancel
  }

  terminate() {
    this.terminated = true;
  }
}

describe('runWorkerTask cancel', () => {
  const OriginalWorker = globalThis.Worker;

  beforeEach(() => {
    FakeWorker.last = null;
    // @ts-expect-error test stub
    globalThis.Worker = FakeWorker;
  });

  afterEach(() => {
    globalThis.Worker = OriginalWorker;
  });

  it('rejects promptly with WorkerCancelledError on cancel', async () => {
    const { promise, cancel } = runWorkerTask<{ id: string }, { ok: true }>({
      workerUrl: new URL('https://example.test/worker.js'),
      request: { id: 't' },
      timeoutMs: 60_000,
    });

    expect(FakeWorker.last).toBeTruthy();
    cancel();
    expect(FakeWorker.last?.terminated).toBe(true);

    await expect(promise).rejects.toBeInstanceOf(WorkerCancelledError);
  });

  it('does not leave a hanging promise after cancel', async () => {
    const { promise, cancel } = runWorkerTask<{ id: string }, { ok: true }>({
      workerUrl: new URL('https://example.test/worker.js'),
      request: { id: 't' },
      timeoutMs: 60_000,
    });
    cancel();
    const started = Date.now();
    await expect(promise).rejects.toBeInstanceOf(WorkerCancelledError);
    expect(Date.now() - started).toBeLessThan(2_000);
  });
});
