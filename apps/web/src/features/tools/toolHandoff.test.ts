import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { clearProject } from '@/features/workspace/projectStore';
import { consumeToolHandoff, saveToolHandoff } from './toolHandoff';

describe('toolHandoff', () => {
  afterEach(async () => {
    try {
      await clearProject();
    } catch {
      // ignore
    }
  });

  it('saves and consumes a PDF handoff once', async () => {
    const blob = new Blob([new Uint8Array([37, 80, 68, 70])], {
      type: 'application/pdf',
    });
    await saveToolHandoff({
      blob,
      fileName: 'workspace.pdf',
      pages: '1,3',
      targetPath: '/crop-pdf',
    });
    const first = await consumeToolHandoff();
    expect(first).toBeTruthy();
    expect(first!.file.name).toBe('workspace.pdf');
    expect(first!.pages).toBe('1,3');
    expect(await first!.file.arrayBuffer()).toEqual(await blob.arrayBuffer());

    const second = await consumeToolHandoff();
    expect(second).toBeNull();
  });
});
