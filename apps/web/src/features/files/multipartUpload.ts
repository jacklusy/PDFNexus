'use client';

import { apiFetch } from '@/lib/api';
import {
  UPLOAD_PART_SIZE_BYTES,
  type CompleteUploadResponse,
  type InitiateUploadResponse,
  type UploadPartUrl,
  type UploadSessionStatusResponse,
} from '@pdfnexus/shared';

const CONCURRENCY = 3;
const MAX_PART_ATTEMPTS = 5;
const MAX_SESSION_RESUMES = 2;
const BASE_BACKOFF_MS = 1000;
const MAX_BACKOFF_MS = 30_000;
/** EWMA time constant for speed smoothing. */
const SPEED_TAU_MS = 3000;

const UPLOAD_TOKEN_HEADER = 'X-Upload-Token';

export interface UploadProgress {
  percent: number;
  bytesSent: number;
  totalBytes: number;
  /** EWMA-smoothed bytes/second. */
  speedBps: number;
  /** Estimated seconds remaining; null until a stable speed exists. */
  etaSeconds: number | null;
}

export interface DirectUploadOptions {
  fileName: string;
  mimeType?: string;
  /** First-time flow: owner email (server sends a claim link). */
  email?: string;
  sendEmail?: boolean;
  onProgress?: (progress: UploadProgress) => void;
}

export class UploadCancelledError extends Error {
  constructor() {
    super('Upload cancelled');
    this.name = 'UploadCancelledError';
  }
}

export interface DirectUploadHandle {
  promise: Promise<CompleteUploadResponse>;
  abort: () => void;
}

/** Full-jitter exponential backoff: random(0, min(max, base * 2^attempt)). */
function backoffWithJitter(attempt: number): number {
  const target = Math.min(MAX_BACKOFF_MS, BASE_BACKOFF_MS * 2 ** attempt);
  return Math.random() * target;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Aggregates per-part progress into smoothed speed / ETA updates. */
class ProgressTracker {
  private readonly partLoaded = new Map<number, number>();
  private lastEmitAt = 0;
  private lastBytes = 0;
  private speedBps = 0;

  constructor(
    private readonly totalBytes: number,
    private readonly onProgress?: (progress: UploadProgress) => void,
  ) {}

  setPartLoaded(partNumber: number, loaded: number): void {
    this.partLoaded.set(partNumber, loaded);
    this.emit();
  }

  private bytesSent(): number {
    let sum = 0;
    for (const value of this.partLoaded.values()) sum += value;
    return Math.min(sum, this.totalBytes);
  }

  private emit(force = false): void {
    if (!this.onProgress) return;
    const now = Date.now();
    const dt = now - this.lastEmitAt;
    if (!force && dt < 200) return;

    const bytes = this.bytesSent();
    if (this.lastEmitAt > 0 && dt > 0) {
      const instant = ((bytes - this.lastBytes) / dt) * 1000;
      const alpha = 1 - Math.exp(-dt / SPEED_TAU_MS);
      this.speedBps = Math.max(
        0,
        alpha * instant + (1 - alpha) * this.speedBps,
      );
    }
    this.lastEmitAt = now;
    this.lastBytes = bytes;

    const remaining = this.totalBytes - bytes;
    this.onProgress({
      percent: this.totalBytes
        ? Math.min(100, Math.round((bytes / this.totalBytes) * 100))
        : 100,
      bytesSent: bytes,
      totalBytes: this.totalBytes,
      speedBps: this.speedBps,
      etaSeconds:
        this.speedBps > 1 ? Math.round(remaining / this.speedBps) : null,
    });
  }

  finish(): void {
    this.emit(true);
  }
}

interface SessionContext {
  sessionId: string;
  token: string;
  totalParts: number;
  partSize: number;
}

function sessionHeaders(ctx: SessionContext): Record<string, string> {
  return { [UPLOAD_TOKEN_HEADER]: ctx.token };
}

async function requestPartUrl(
  ctx: SessionContext,
  partNumber: number,
): Promise<string> {
  const res = await apiFetch<{ urls: UploadPartUrl[] }>(
    `/api/files/uploads/${ctx.sessionId}/part-urls`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...sessionHeaders(ctx),
      },
      body: JSON.stringify({ partNumbers: [partNumber] }),
    },
  );
  const entry = res.urls.find((u) => u.partNumber === partNumber);
  if (!entry) throw new Error(`No presigned URL for part ${partNumber}`);
  return entry.url;
}

function putPart(
  url: string,
  body: Blob,
  partNumber: number,
  tracker: ProgressTracker,
  inflight: Set<XMLHttpRequest>,
): Promise<string | null> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    inflight.add(xhr);
    xhr.open('PUT', url);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        tracker.setPartLoaded(partNumber, event.loaded);
      }
    };
    xhr.onload = () => {
      inflight.delete(xhr);
      if (xhr.status >= 200 && xhr.status < 300) {
        tracker.setPartLoaded(partNumber, body.size);
        // Requires ExposeHeaders: ["ETag"] in bucket CORS; the server
        // falls back to ListParts, so a missing header is not fatal.
        resolve(xhr.getResponseHeader('ETag'));
      } else {
        reject(new Error(`Part ${partNumber} upload failed (HTTP ${xhr.status})`));
      }
    };
    xhr.onerror = () => {
      inflight.delete(xhr);
      reject(new Error(`Part ${partNumber} upload failed (network error)`));
    };
    xhr.onabort = () => {
      inflight.delete(xhr);
      reject(new UploadCancelledError());
    };
    xhr.send(body);
  });
}

/**
 * Direct-to-storage upload engine: initiates a session, streams parts to
 * object storage via just-in-time presigned URLs with a small worker pool,
 * retries with full-jitter backoff, resumes missing parts after transient
 * failures, and completes server-side.
 */
export function uploadFileDirect(
  blob: Blob,
  options: DirectUploadOptions,
): DirectUploadHandle {
  const inflight = new Set<XMLHttpRequest>();
  let aborted = false;
  let sessionCtx: SessionContext | null = null;

  const abort = () => {
    if (aborted) return;
    aborted = true;
    for (const xhr of inflight) xhr.abort();
    if (sessionCtx) {
      void apiFetch(`/api/files/uploads/${sessionCtx.sessionId}`, {
        method: 'DELETE',
        headers: sessionHeaders(sessionCtx),
      }).catch(() => {
        // stale sessions are aborted server-side by the cleanup job
      });
    }
  };

  const throwIfAborted = () => {
    if (aborted) throw new UploadCancelledError();
  };

  const promise = (async (): Promise<CompleteUploadResponse> => {
    const init = await apiFetch<InitiateUploadResponse>(
      '/api/files/uploads/initiate',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: options.fileName,
          sizeBytes: blob.size,
          mimeType: options.mimeType || blob.type || '',
          ...(options.email ? { email: options.email } : {}),
          sendEmail: Boolean(options.sendEmail),
        }),
      },
    );
    throwIfAborted();

    const ctx: SessionContext = {
      sessionId: init.sessionId,
      token: init.sessionToken,
      totalParts: init.totalParts,
      partSize: init.partSize || UPLOAD_PART_SIZE_BYTES,
    };
    sessionCtx = ctx;

    const tracker = new ProgressTracker(blob.size, options.onProgress);
    const completed = new Set<number>();

    const uploadPart = async (partNumber: number): Promise<void> => {
      const start = (partNumber - 1) * ctx.partSize;
      const chunk = blob.slice(start, Math.min(blob.size, start + ctx.partSize));

      let lastError: unknown = null;
      for (let attempt = 0; attempt < MAX_PART_ATTEMPTS; attempt++) {
        throwIfAborted();
        try {
          // Presigned just-in-time so URLs cannot expire mid-session.
          const url = await requestPartUrl(ctx, partNumber);
          throwIfAborted();
          const etag = await putPart(url, chunk, partNumber, tracker, inflight);
          completed.add(partNumber);
          await apiFetch(`/api/files/uploads/${ctx.sessionId}/parts/${partNumber}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...sessionHeaders(ctx),
            },
            body: JSON.stringify(etag ? { etag } : {}),
          }).catch(() => {
            // informational only — completion verifies via ListParts
          });
          return;
        } catch (err) {
          if (err instanceof UploadCancelledError) throw err;
          lastError = err;
          await sleep(backoffWithJitter(attempt));
        }
      }
      throw lastError instanceof Error
        ? lastError
        : new Error(`Part ${partNumber} failed`);
    };

    /** Drains the queue with a worker pool; returns parts that failed. */
    const runWorkers = async (queue: number[]): Promise<number[]> => {
      const pending = [...queue];
      const failed: number[] = [];
      let cancelled = false;
      const worker = async () => {
        while (pending.length > 0 && !cancelled) {
          const partNumber = pending.shift();
          if (partNumber === undefined) break;
          try {
            await uploadPart(partNumber);
          } catch (err) {
            if (err instanceof UploadCancelledError) {
              cancelled = true;
              return;
            }
            failed.push(partNumber);
          }
        }
      };
      await Promise.all(
        Array.from(
          { length: Math.min(CONCURRENCY, queue.length) },
          () => worker(),
        ),
      );
      if (cancelled) throw new UploadCancelledError();
      return failed;
    };

    const allParts = Array.from({ length: ctx.totalParts }, (_, i) => i + 1);
    let queue = allParts;
    for (let round = 0; queue.length > 0; round++) {
      const failed = await runWorkers(queue);
      if (failed.length === 0) break;
      if (round >= MAX_SESSION_RESUMES) {
        throw new Error(
          `Upload failed: ${failed.length} part(s) could not be transferred. Please try again.`,
        );
      }
      // Transient failure: ask the server which parts survived and
      // re-queue only the missing ones.
      const status = await apiFetch<UploadSessionStatusResponse>(
        `/api/files/uploads/${ctx.sessionId}`,
        { headers: sessionHeaders(ctx) },
      );
      throwIfAborted();
      const done = new Set([...status.completedParts, ...completed]);
      queue = allParts.filter((n) => !done.has(n));
      await sleep(backoffWithJitter(round));
    }

    throwIfAborted();
    const result = await apiFetch<CompleteUploadResponse>(
      `/api/files/uploads/${ctx.sessionId}/complete`,
      { method: 'POST', headers: sessionHeaders(ctx) },
    );
    tracker.finish();
    return result;
  })();

  return { promise, abort };
}
