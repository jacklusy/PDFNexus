import { describe, expect, it, vi } from 'vitest';
import { downloadWorkerOutputs } from './downloadWorkerOutputs';

describe('downloadWorkerOutputs', () => {
  it('skips download when cancelled before single file', async () => {
    const download = vi.fn();
    const zipOutputs = vi.fn();
    const outcome = await downloadWorkerOutputs({
      isCancelled: () => true,
      files: [{ fileName: 'a.pdf', blob: new Blob(['x']) }],
      zipName: 'out.zip',
      download,
      zipOutputs,
    });
    expect(outcome).toBe('cancelled');
    expect(download).not.toHaveBeenCalled();
    expect(zipOutputs).not.toHaveBeenCalled();
  });

  it('skips download when cancelled during zip', async () => {
    const download = vi.fn();
    let cancelled = false;
    const zipOutputs = vi.fn().mockImplementation(async () => {
      cancelled = true;
      return new Blob(['zip']);
    });
    const outcome = await downloadWorkerOutputs({
      isCancelled: () => cancelled,
      files: [
        { fileName: 'a.pdf', blob: new Blob(['a']) },
        { fileName: 'b.pdf', blob: new Blob(['b']) },
      ],
      zipName: 'out.zip',
      download,
      zipOutputs,
    });
    expect(outcome).toBe('cancelled');
    expect(download).not.toHaveBeenCalled();
  });

  it('downloads single file when not cancelled', async () => {
    const download = vi.fn();
    const blob = new Blob(['x']);
    const outcome = await downloadWorkerOutputs({
      isCancelled: () => false,
      files: [{ fileName: 'a.pdf', blob }],
      zipName: 'out.zip',
      download,
      zipOutputs: vi.fn(),
    });
    expect(outcome).toBe('downloaded');
    expect(download).toHaveBeenCalledWith(blob, 'a.pdf');
  });
});
