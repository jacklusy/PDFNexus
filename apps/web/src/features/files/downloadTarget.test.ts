import { describe, it, expect } from 'vitest';
import { resolveDownloadTarget } from '@/features/files/api';

describe('resolveDownloadTarget', () => {
  it('prefers the in-memory blob URL', () => {
    expect(
      resolveDownloadTarget({
        localBlobUrl: 'blob:local',
        downloadUrl: 'https://api/files/1/download',
      })
    ).toBe('blob:local');
  });

  it('falls back to the resolved download URL', () => {
    expect(
      resolveDownloadTarget({ downloadUrl: 'https://api/files/1/download' })
    ).toBe('https://api/files/1/download');
  });

  it('returns null when neither is available', () => {
    expect(resolveDownloadTarget({})).toBeNull();
    expect(resolveDownloadTarget({ localBlobUrl: '', downloadUrl: '' })).toBeNull();
  });
});
