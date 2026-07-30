import { clearAllPdfCaches } from '@/lib/pdf';

export type BatchTool =
  | 'crop'
  | 'resize'
  | 'flatten'
  | 'compress'
  | 'watermark'
  | 'pageNumbers'
  | 'protect'
  | 'pdfToJpg'
  | 'bates';

export type BatchJobStatus = 'pending' | 'running' | 'done' | 'failed';

export interface BatchJob {
  id: string;
  tool: BatchTool;
  status: BatchJobStatus;
  error?: string;
  resultBlob?: Blob;
  fileName: string;
  /** Input bytes for processing; kept off snapshot when large if desired. */
  inputBlob?: Blob;
}

export interface BatchQueue {
  jobs: BatchJob[];
}

export type BatchRunner = (job: BatchJob) => Promise<Blob>;

export function createQueue(): BatchQueue {
  return { jobs: [] };
}

export function createJobId(): string {
  return `job-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function enqueue(
  queue: BatchQueue,
  job: Omit<BatchJob, 'status'> & { status?: BatchJobStatus }
): BatchQueue {
  const next: BatchJob = {
    ...job,
    status: job.status ?? 'pending',
  };
  return { jobs: [...queue.jobs, next] };
}

export function getSnapshot(queue: BatchQueue): BatchJob[] {
  return queue.jobs.map((j) => ({
    id: j.id,
    tool: j.tool,
    status: j.status,
    error: j.error,
    resultBlob: j.resultBlob,
    fileName: j.fileName,
    // omit inputBlob from lightweight views — still present on queue
    inputBlob: j.inputBlob,
  }));
}

export function retry(queue: BatchQueue, jobId: string): BatchQueue {
  return {
    jobs: queue.jobs.map((j) =>
      j.id === jobId
        ? {
            ...j,
            status: 'pending' as const,
            error: undefined,
            resultBlob: undefined,
          }
        : j
    ),
  };
}

/**
 * Run the next pending job. Clears PDF caches after each job finishes (success or fail).
 */
export async function runNext(
  queue: BatchQueue,
  runners: Partial<Record<BatchTool, BatchRunner>>,
  signal?: AbortSignal
): Promise<BatchQueue> {
  if (signal?.aborted) {
    throw new DOMException('Batch cancelled', 'AbortError');
  }

  const idx = queue.jobs.findIndex((j) => j.status === 'pending');
  if (idx < 0) return queue;

  const job = queue.jobs[idx];
  const runner = runners[job.tool];
  let running: BatchQueue = {
    jobs: queue.jobs.map((j, i) =>
      i === idx ? { ...j, status: 'running' as const, error: undefined } : j
    ),
  };

  try {
    if (!runner) {
      throw new Error(`No runner registered for tool "${job.tool}".`);
    }
    if (signal?.aborted) {
      throw new DOMException('Batch cancelled', 'AbortError');
    }
    const resultBlob = await runner(running.jobs[idx]);
    if (signal?.aborted) {
      throw new DOMException('Batch cancelled', 'AbortError');
    }
    running = {
      jobs: running.jobs.map((j, i) =>
        i === idx
          ? { ...j, status: 'done' as const, resultBlob, error: undefined }
          : j
      ),
    };
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') {
      running = {
        jobs: running.jobs.map((j, i) =>
          i === idx
            ? {
                ...j,
                status: 'pending' as const,
                error: undefined,
                resultBlob: undefined,
              }
            : j
        ),
      };
      clearAllPdfCaches();
      throw e;
    }
    const message = e instanceof Error ? e.message : String(e);
    running = {
      jobs: running.jobs.map((j, i) =>
        i === idx ? { ...j, status: 'failed' as const, error: message } : j
      ),
    };
    clearAllPdfCaches();
  }

  return running;
}

/** Drain all pending jobs sequentially. */
export async function runAll(
  queue: BatchQueue,
  runners: Partial<Record<BatchTool, BatchRunner>>,
  onUpdate?: (queue: BatchQueue) => void,
  signal?: AbortSignal
): Promise<BatchQueue> {
  let current = queue;
  while (current.jobs.some((j) => j.status === 'pending')) {
    if (signal?.aborted) {
      throw new DOMException('Batch cancelled', 'AbortError');
    }
    current = await runNext(current, runners, signal);
    onUpdate?.(current);
  }
  return current;
}
