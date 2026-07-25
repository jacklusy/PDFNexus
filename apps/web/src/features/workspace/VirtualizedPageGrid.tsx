'use client';

import React, { useRef, useEffect } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { PDFPageItem } from '@/lib/types';
import PageCardSlot from '@/components/PageCardSlot';

const CARD_ESTIMATE = 320;
const GAP = 16;

interface VirtualizedPageGridProps {
  pages: PDFPageItem[];
  selectedPageIds: Set<string>;
  thumbnailsByPageId: Map<string, string>;
  onSelect: (id: string, shiftKey: boolean) => void;
  onRotate: (id: string, degrees: number) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
  onInsertBlank: (id: string, position: 'before' | 'after') => void;
  onInsertImage?: (pageId: string, position: 'before' | 'after') => void;
  onPreview?: (page: PDFPageItem) => void;
  onMoveTo: (id: string, targetIndex: number) => void;
  onDragStart: (e: React.DragEvent, index: number) => void;
  onDragOver: (e: React.DragEvent, index: number) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent, targetIndex: number) => void;
  draggedIndex: number | null;
  dragOverIndex: number | null;
  onRequestThumbnail: (page: PDFPageItem) => void;
  onAnnounce?: (message: string) => void;
  columns?: number;
}

function useColumnCount(): number {
  const [cols, setCols] = React.useState(4);
  React.useEffect(() => {
    const update = () => {
      const w = window.innerWidth;
      if (w < 640) setCols(2);
      else if (w < 768) setCols(3);
      else if (w < 1280) setCols(4);
      else setCols(5);
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);
  return cols;
}

function resolveThumb(
  page: PDFPageItem,
  thumbnailsByPageId: Map<string, string>
): string | undefined {
  if (thumbnailsByPageId.has(page.id)) return thumbnailsByPageId.get(page.id);
  return page.thumbnailUrl;
}

export default function VirtualizedPageGrid(props: VirtualizedPageGridProps) {
  const {
    pages,
    selectedPageIds,
    thumbnailsByPageId,
    columns: columnsProp,
    onAnnounce,
    onRequestThumbnail,
    ...cardProps
  } = props;

  const parentRef = useRef<HTMLDivElement>(null);
  const measuredCols = useColumnCount();
  const columns = columnsProp ?? measuredCols;

  const rowCount = Math.ceil(pages.length / columns) || 0;

  const rowVirtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => parentRef.current,
    estimateSize: () => CARD_ESTIMATE + GAP,
    overscan: 4,
  });

  const virtualItems = rowVirtualizer.getVirtualItems();
  const rangeKey =
    virtualItems.length > 0
      ? `${virtualItems[0]!.index}-${virtualItems[virtualItems.length - 1]!.index}`
      : 'empty';

  // Drive thumbnail loads from visible + overscan rows (not IntersectionObserver)
  useEffect(() => {
    for (const virtualRow of virtualItems) {
      const start = virtualRow.index * columns;
      for (let col = 0; col < columns; col++) {
        const page = pages[start + col];
        if (!page || page.isBlank) continue;
        if (resolveThumb(page, thumbnailsByPageId) !== undefined) continue;
        onRequestThumbnail(page);
      }
    }
    // rangeKey captures visible window; avoid depending on virtualItems array identity
    // eslint-disable-next-line react-hooks/exhaustive-deps -- virtualItems read from latest render
  }, [rangeKey, pages, columns, thumbnailsByPageId, onRequestThumbnail]);

  // Small lists: skip virtualization overhead
  if (pages.length <= 24) {
    return (
      <div
        role="grid"
        aria-label="Page assembly grid"
        aria-rowcount={rowCount}
        aria-colcount={columns}
        className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5"
      >
        {pages.map((page, index) => (
          <div key={page.id} role="gridcell" aria-selected={selectedPageIds.has(page.id)}>
            <PageCardSlot
              page={page}
              index={index}
              isSelected={selectedPageIds.has(page.id)}
              totalPages={pages.length}
              thumbnailUrl={resolveThumb(page, thumbnailsByPageId)}
              onAnnounce={onAnnounce}
              onRequestThumbnail={onRequestThumbnail}
              {...cardProps}
            />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div
      ref={parentRef}
      className="max-h-[calc(100vh-220px)] overflow-auto custom-scrollbar"
      role="grid"
      aria-label="Page assembly grid"
      aria-rowcount={rowCount}
      aria-colcount={columns}
    >
      <div
        style={{
          height: `${rowVirtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualItems.map((virtualRow) => {
          const start = virtualRow.index * columns;
          const rowItems: { page: PDFPageItem; index: number }[] = [];
          for (let col = 0; col < columns; col++) {
            const page = pages[start + col];
            if (page) rowItems.push({ page, index: start + col });
          }
          return (
            <div
              key={virtualRow.key}
              role="row"
              aria-rowindex={virtualRow.index + 1}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start}px)`,
                display: 'grid',
                gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
                gap: `${GAP}px`,
                paddingBottom: `${GAP}px`,
              }}
            >
              {rowItems.map(({ page, index }) => (
                <div
                  key={page.id}
                  role="gridcell"
                  aria-colindex={(index % columns) + 1}
                  aria-selected={selectedPageIds.has(page.id)}
                >
                  <PageCardSlot
                    page={page}
                    index={index}
                    isSelected={selectedPageIds.has(page.id)}
                    totalPages={pages.length}
                    thumbnailUrl={resolveThumb(page, thumbnailsByPageId)}
                    onAnnounce={onAnnounce}
                    onRequestThumbnail={onRequestThumbnail}
                    scrollRootRef={parentRef}
                    skipIntersectionObserver
                    {...cardProps}
                  />
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
