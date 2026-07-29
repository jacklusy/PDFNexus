import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import {
  clearProject,
  loadFileBlob,
  loadProject,
  saveFileBlob,
  saveProject,
} from './projectStore';

describe('projectStore blob roundtrip', () => {
  afterEach(async () => {
    try {
      await clearProject('test-phase3');
    } catch {
      // ignore
    }
  });

  it('persists and restores a file blob', async () => {
    const projectId = 'test-phase3';
    const blobId = `${projectId}:input:0`;
    const blob = new Blob([new Uint8Array([1, 2, 3, 4])], {
      type: 'application/pdf',
    });
    await saveProject({
      id: projectId,
      name: 'test',
      settings: { jobs: [{ id: 'j1', blobId }] },
      updatedAt: Date.now(),
    });
    await saveFileBlob(blobId, blob, projectId);
    const meta = await loadProject(projectId);
    expect(meta?.settings).toBeTruthy();
    const restored = await loadFileBlob(blobId);
    expect(restored).toBeTruthy();
    expect(new Uint8Array(await restored!.arrayBuffer())).toEqual(
      new Uint8Array(await blob.arrayBuffer())
    );
  });
});
