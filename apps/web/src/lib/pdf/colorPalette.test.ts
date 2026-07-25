import { describe, it, expect } from 'vitest';
import { assignDistinctColors } from '@/lib/pdf/colorPalette';
import { buildWorkspaceManifest } from '@/lib/pdf/workspaceRecovery';

describe('colorPalette', () => {
  it('assigns unused colors first', () => {
    const assigned = assignDistinctColors(['black', 'navy'], 2);
    expect(assigned).toHaveLength(2);
    expect(assigned).not.toContain('black');
    expect(assigned).not.toContain('navy');
  });
});

describe('workspaceRecovery', () => {
  it('builds manifest without binaries', () => {
    const manifest = buildWorkspaceManifest(
      [
        {
          id: 'f1',
          name: 'a.pdf',
          size: 10,
          pageCount: 1,
          fileType: 'pdf',
        },
      ],
      [
        {
          id: 'p1',
          originalFileId: 'f1',
          originalFileName: 'a.pdf',
          originalPageNumber: 1,
          rotation: 90,
          isBlank: false,
        },
      ]
    );
    expect(manifest.version).toBe(1);
    expect(manifest.files[0]).not.toHaveProperty('arrayBuffer');
    expect(manifest.pages[0].rotation).toBe(90);
  });
});
