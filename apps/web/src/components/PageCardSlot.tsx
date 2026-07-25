'use client';

import React, { useEffect, useRef, type RefObject } from 'react';
import PageCard from '@/components/PageCard';
import { PDFPageItem } from '@/lib/types';

interface PageCardSlotProps {
  page: PDFPageItem;
  index: number;
  isSelected: boolean;
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
  totalPages: number;
  /** Resolved thumbnail for this card (from Map); overrides page.thumbnailUrl when set */
  thumbnailUrl?: string;
  onRequestThumbnail?: (page: PDFPageItem) => void;
  onAnnounce?: (message: string) => void;
  /** Scroll container for IntersectionObserver (virtualized grid parent) */
  scrollRootRef?: RefObject<HTMLElement | null>;
  /** When true, parent drives thumbnail requests (skip IntersectionObserver) */
  skipIntersectionObserver?: boolean;
}

export const PageCardSlot: React.FC<PageCardSlotProps> = (props) => {
  const {
    thumbnailUrl,
    scrollRootRef,
    skipIntersectionObserver,
    onRequestThumbnail,
    page,
    ...cardProps
  } = props;

  const containerRef = useRef<HTMLDivElement>(null);
  const requestedRef = useRef(false);

  const resolvedThumb =
    thumbnailUrl !== undefined ? thumbnailUrl : page.thumbnailUrl;

  useEffect(() => {
    if (resolvedThumb !== undefined) {
      requestedRef.current = false;
    }
  }, [resolvedThumb]);

  useEffect(() => {
    if (skipIntersectionObserver) return;
    if (resolvedThumb !== undefined || page.isBlank) return;

    const el = containerRef.current;
    if (!el || !onRequestThumbnail) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && !requestedRef.current) {
            requestedRef.current = true;
            onRequestThumbnail(page);
          }
        }
      },
      {
        root: scrollRootRef?.current ?? null,
        rootMargin: '400px 0px 400px 0px',
        threshold: 0,
      }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [
    page,
    page.id,
    page.isBlank,
    resolvedThumb,
    onRequestThumbnail,
    scrollRootRef,
    skipIntersectionObserver,
  ]);

  return (
    <div ref={containerRef} className="h-full w-full">
      <PageCard {...cardProps} page={page} thumbnailUrl={resolvedThumb} />
    </div>
  );
};

export default React.memo(PageCardSlot);
