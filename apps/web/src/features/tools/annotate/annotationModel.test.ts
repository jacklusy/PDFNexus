import { describe, it, expect } from 'vitest';
import {
  createId,
  type HighlightOverlay,
  type StickyNoteOverlay,
  type PageCommentOverlay,
  type LinkOverlay,
  type OverlayItem,
} from '../overlays/types';

describe('annotation overlay model', () => {
  it('creates highlight overlay with color and optional quads', () => {
    const highlight: HighlightOverlay = {
      id: createId(),
      kind: 'highlight',
      page: 1,
      x: 40,
      y: 100,
      width: 200,
      height: 16,
      rotation: 0,
      opacity: 1,
      color: '#facc15',
      quads: [
        { x: 40, y: 100, width: 100, height: 16 },
        { x: 40, y: 80, width: 80, height: 16 },
      ],
    };
    expect(highlight.kind).toBe('highlight');
    expect(highlight.quads).toHaveLength(2);
    const asItem: OverlayItem = highlight;
    expect(asItem.kind).toBe('highlight');
  });

  it('creates sticky note and page comment overlays', () => {
    const sticky: StickyNoteOverlay = {
      id: createId(),
      kind: 'stickyNote',
      page: 2,
      x: 50,
      y: 700,
      width: 120,
      height: 24,
      rotation: 0,
      opacity: 1,
      text: 'Review this',
      color: '#facc15',
      author: 'Ada',
    };
    const comment: PageCommentOverlay = {
      id: createId(),
      kind: 'pageComment',
      page: 2,
      x: 40,
      y: 40,
      width: 200,
      height: 40,
      rotation: 0,
      opacity: 1,
      text: 'Page-level note',
    };
    expect(sticky.author).toBe('Ada');
    expect(comment.text).toContain('Page-level');
  });

  it('creates link overlay with URI', () => {
    const link: LinkOverlay = {
      id: createId(),
      kind: 'link',
      page: 1,
      x: 72,
      y: 720,
      width: 160,
      height: 18,
      rotation: 0,
      opacity: 1,
      uri: 'https://example.com',
    };
    expect(link.uri).toMatch(/^https:/);
  });
});
