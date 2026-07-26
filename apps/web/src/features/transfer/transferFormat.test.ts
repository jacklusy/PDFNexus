import { describe, it, expect } from 'vitest';
import {
  formatElapsed,
  formatTransferBytes,
  formatTransferEta,
  formatTransferSpeed,
} from '@/features/transfer/transferFormat';
import {
  isActivePhase,
  isTerminalPhase,
} from '@/features/transfer/useTransferOperation';

describe('transferFormat', () => {
  it('formats byte magnitudes', () => {
    expect(formatTransferBytes(512)).toBe('512 B');
    expect(formatTransferBytes(2048)).toBe('2 KB');
    expect(formatTransferBytes(5 * 1024 * 1024)).toBe('5.0 MB');
    expect(formatTransferBytes(3 * 1024 * 1024 * 1024)).toBe('3.00 GB');
  });

  it('guards against invalid byte values', () => {
    expect(formatTransferBytes(-1)).toBe('—');
    expect(formatTransferBytes(Number.NaN)).toBe('—');
  });

  it('formats speed with a fallback', () => {
    expect(formatTransferSpeed(0)).toBe('—');
    expect(formatTransferSpeed(undefined)).toBe('—');
    expect(formatTransferSpeed(1024)).toBe('1 KB/s');
  });

  it('formats ETA across units', () => {
    expect(formatTransferEta(null)).toBe('—');
    expect(formatTransferEta(45)).toBe('45s');
    expect(formatTransferEta(90)).toBe('1m 30s');
    expect(formatTransferEta(3720)).toBe('1h 2m');
  });

  it('formats elapsed as m:ss', () => {
    expect(formatElapsed(0)).toBe('0:00');
    expect(formatElapsed(9000)).toBe('0:09');
    expect(formatElapsed(75_000)).toBe('1:15');
  });
});

describe('transfer phase helpers', () => {
  it('classifies active phases', () => {
    expect(isActivePhase('uploading')).toBe(true);
    expect(isActivePhase('processing')).toBe(true);
    expect(isActivePhase('finalizing')).toBe(true);
    expect(isActivePhase('cancelling')).toBe(true);
    expect(isActivePhase('idle')).toBe(false);
    expect(isActivePhase('completed')).toBe(false);
  });

  it('classifies terminal phases', () => {
    expect(isTerminalPhase('completed')).toBe(true);
    expect(isTerminalPhase('failed')).toBe(true);
    expect(isTerminalPhase('cancelled')).toBe(true);
    expect(isTerminalPhase('uploading')).toBe(false);
    expect(isTerminalPhase('idle')).toBe(false);
  });
});
