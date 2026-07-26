import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { adminDownload, type AdminDownloadProgress } from '@/features/admin/api';

type FakeResponseInit = {
  chunks: Uint8Array[];
  headers: Record<string, string>;
  ok?: boolean;
  status?: number;
};

function makeResponse({ chunks, headers, ok = true, status = 200 }: FakeResponseInit) {
  const map = new Map(Object.entries(headers));
  let index = 0;
  return {
    ok,
    status,
    statusText: 'OK',
    headers: { get: (key: string) => map.get(key) ?? null },
    body: {
      getReader() {
        return {
          read: async () => {
            if (index < chunks.length) {
              return { done: false, value: chunks[index++] };
            }
            return { done: true, value: undefined };
          },
        };
      },
    },
    async blob() {
      return new Blob(chunks as BlobPart[]);
    },
    async json() {
      return {};
    },
  };
}

const clickSpy = vi.fn();

beforeEach(() => {
  clickSpy.mockReset();
  (URL as unknown as { createObjectURL: () => string }).createObjectURL = () =>
    'blob:mock';
  (URL as unknown as { revokeObjectURL: () => void }).revokeObjectURL = () => {};
  vi.stubGlobal('document', {
    createElement: () => ({ click: clickSpy, rel: '', href: '', download: '' }),
    body: { appendChild: () => {}, removeChild: () => {} },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('adminDownload', () => {
  it('streams determinate progress and reports truncation metadata', async () => {
    const chunks = [new Uint8Array(50), new Uint8Array(50)];
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        makeResponse({
          chunks,
          headers: {
            'Content-Length': '100',
            'X-Export-Truncated': 'true',
            'X-Export-Total': '5000',
            'X-Export-Count': '2000',
          },
        })
      )
    );

    const progress: AdminDownloadProgress[] = [];
    const result = await adminDownload(
      '/api/admin/logs/export',
      { format: 'csv' },
      { filename: 'logs.csv', onProgress: (p) => progress.push(p) }
    );

    expect(result).toEqual({ truncated: true, total: 5000, exported: 2000 });
    expect(clickSpy).toHaveBeenCalledTimes(1);
    // Determinate: percent climbs to 100 as bytes arrive.
    expect(progress.at(-1)?.percent).toBe(100);
    expect(progress.at(-1)?.receivedBytes).toBe(100);
    expect(progress.every((p) => p.totalBytes === 100)).toBe(true);
  });

  it('reports indeterminate progress when Content-Length is missing', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        makeResponse({ chunks: [new Uint8Array(10)], headers: {} })
      )
    );

    const progress: AdminDownloadProgress[] = [];
    const result = await adminDownload('/api/admin/audit/export', undefined, {
      onProgress: (p) => progress.push(p),
    });

    expect(result).toEqual({ truncated: false, total: null, exported: null });
    expect(progress.every((p) => p.percent === null)).toBe(true);
  });

  it('throws an ApiError on a non-ok response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        headers: { get: () => null },
        async json() {
          return { message: 'Not allowed' };
        },
      }))
    );

    await expect(adminDownload('/api/admin/errors/export')).rejects.toMatchObject({
      status: 403,
      message: 'Not allowed',
    });
  });
});
