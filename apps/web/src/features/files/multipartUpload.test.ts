import { describe, it, expect, vi, beforeEach } from 'vitest';

const apiFetchMock = vi.fn();

vi.mock('@/lib/api', () => ({
  apiFetch: (...args: unknown[]) => apiFetchMock(...args),
}));

import {
  uploadFileDirect,
  UploadCancelledError,
} from '@/features/files/multipartUpload';

describe('uploadFileDirect', () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
  });

  it('emits an initiating stage before any bytes are sent', () => {
    apiFetchMock.mockImplementation(() => new Promise(() => {}));
    const onProgress = vi.fn();
    const handle = uploadFileDirect(new Blob([new Uint8Array(8)]), {
      fileName: 'a.pdf',
      onProgress,
    });

    expect(onProgress).toHaveBeenCalledTimes(1);
    expect(onProgress).toHaveBeenCalledWith(
      expect.objectContaining({ stage: 'initiating', percent: 0, totalBytes: 8 })
    );

    handle.abort();
  });

  it('cancels cleanly right after initiate, before uploading parts', async () => {
    apiFetchMock.mockResolvedValue({
      sessionId: 'sess-1',
      sessionToken: 'tok-1',
      totalParts: 1,
      partSize: 5,
      fileId: 'file-1',
      mode: 'multipart',
    });

    const handle = uploadFileDirect(new Blob([new Uint8Array(8)]), {
      fileName: 'a.pdf',
    });
    handle.abort();

    await expect(handle.promise).rejects.toBeInstanceOf(UploadCancelledError);
  });
});
