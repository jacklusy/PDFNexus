import { describe, expect, it, vi } from 'vitest';
import { deliverBatesOutputs } from './deliverBatesOutputs';

describe('deliverBatesOutputs', () => {
  it('persists next only after a successful single download', async () => {
    const writeNext = vi.fn();
    const download = vi.fn();
    const zipOutputs = vi.fn();
    const blob = new Blob(['pdf'], { type: 'application/pdf' });

    await deliverBatesOutputs({
      outputs: [{ fileName: 'a-bates.pdf', blob }],
      next: 42,
      writeNext,
      download,
      zipOutputs,
    });

    expect(download).toHaveBeenCalledWith(blob, 'a-bates.pdf');
    expect(zipOutputs).not.toHaveBeenCalled();
    expect(writeNext).toHaveBeenCalledWith(42);
  });

  it('does not persist next when zip fails', async () => {
    const writeNext = vi.fn();
    const download = vi.fn();
    const zipOutputs = vi.fn().mockRejectedValue(new Error('zip failed'));
    const blob = new Blob(['pdf'], { type: 'application/pdf' });

    await expect(
      deliverBatesOutputs({
        outputs: [
          { fileName: 'a-bates.pdf', blob },
          { fileName: 'b-bates.pdf', blob },
        ],
        next: 99,
        writeNext,
        download,
        zipOutputs,
      })
    ).rejects.toThrow('zip failed');

    expect(writeNext).not.toHaveBeenCalled();
    expect(download).not.toHaveBeenCalled();
  });
});
