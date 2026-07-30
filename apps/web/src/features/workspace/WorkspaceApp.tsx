'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  UploadCloud,
  Loader2,
  Plus,
  Download,
  FilePlus2,
  FileType,
  ListOrdered,
  Layers,
  MoreHorizontal,
  ListTodo,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Link from 'next/link';
import { PDFFile, PDFPageItem, FileStore } from '@/lib/types';
import {
  ConfirmDialog,
  DropdownItem,
  DropdownMenu,
  useToast,
} from '@/shared/ui';
import {
  parseUploadedFile,
  renderThumbnailsForPages,
  renderPageThumbnailOnDemand,
  evictFileCaches,
  clearAllPdfCaches,
  persistWorkspaceManifest,
  onThumbnailCacheEvict,
} from '@/lib/pdf';
import { assignDistinctColors } from '@/lib/pdf/colorPalette';
import dynamic from 'next/dynamic';
import Sidebar from '@/components/Sidebar';
import BulkControls from '@/components/BulkControls';
import FullScreenPreviewModal from '@/components/FullScreenPreviewModal';
import { compileMergedPdf, MERGE_OUTPUT_NAME, PreviewOrderModal } from '@/features/merge';
import { navigateWorkspaceToTool } from '@/features/tools/navigateWorkspaceToTool';
import {
  EmailVerifyModal,
  useDownloadGate,
  createLocalExport,
  downloadLocalExport,
  revokeLocalUrl,
  type GatedDownloadResult,
  type LocalExportResult,
} from '@/features/files';
import type { UploadProgress } from '@/features/files';
import {
  TransferProgressModal,
  useTransferOperation,
  type TransferStageStep,
} from '@/features/transfer';
import type { FileKind } from '@pdfnexus/shared';
import { trackEvent } from '@/lib/analytics';
import VirtualizedPageGrid from '@/features/workspace/VirtualizedPageGrid';

const ConvertToWordModal = dynamic(
  () => import('@/features/conversion').then((m) => m.ConvertToWordModal),
  { ssr: false }
);

const BatchQueuePanel = dynamic(
  () =>
    import('@/features/workspace/BatchQueuePanel').then((m) => m.BatchQueuePanel),
  { ssr: false }
);

const MERGE_STEPS: TransferStageStep[] = [
  { key: 'processing', label: 'Compiling pages' },
  { key: 'completed', label: 'Ready locally' },
];

const CONVERT_STEPS: TransferStageStep[] = [
  { key: 'processing', label: 'Converting' },
  { key: 'completed', label: 'Ready locally' },
];

const UPLOAD_STEPS: TransferStageStep[] = [
  { key: 'preparing', label: 'Preparing upload' },
  { key: 'uploading', label: 'Uploading' },
  { key: 'finalizing', label: 'Finalizing' },
];

export default function WorkspaceApp() {
  const toast = useToast();
  const [files, setFiles] = useState<PDFFile[]>([]);
  const [fileStore, setFileStore] = useState<FileStore>({});
  const [pages, setPages] = useState<PDFPageItem[]>([]);
  const [thumbnailsByPageId, setThumbnailsByPageId] = useState<Map<string, string>>(
    () => new Map()
  );
  const [selectedPageIds, setSelectedPageIds] = useState<Set<string>>(new Set());
  const [liveMessage, setLiveMessage] = useState('');
  const announce = useCallback((message: string) => {
    setLiveMessage('');
    requestAnimationFrame(() => setLiveMessage(message));
  }, []);

  const pagesRef = useRef(pages);
  pagesRef.current = pages;
  const thumbnailsRef = useRef(thumbnailsByPageId);
  thumbnailsRef.current = thumbnailsByPageId;
  const selectedPageIdsRef = useRef(selectedPageIds);
  selectedPageIdsRef.current = selectedPageIds;
  const fileStoreRef = useRef(fileStore);
  fileStoreRef.current = fileStore;
  const filesRef = useRef(files);
  filesRef.current = files;

  const setThumbnailUrl = useCallback((pageId: string, url: string) => {
    setThumbnailsByPageId((prev) => {
      if (prev.get(pageId) === url) return prev;
      const next = new Map(prev);
      next.set(pageId, url);
      return next;
    });
  }, []);

  const removeThumbnailIds = useCallback((ids: Iterable<string>) => {
    setThumbnailsByPageId((prev) => {
      let changed = false;
      const next = new Map(prev);
      for (const id of ids) {
        if (next.has(id)) {
          next.delete(id);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, []);

  useEffect(() => {
    return onThumbnailCacheEvict((url) => {
      setThumbnailsByPageId((prev) => {
        let changed = false;
        const next = new Map(prev);
        for (const [id, u] of prev) {
          if (u === url) {
            next.delete(id);
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    });
  }, []);

  const [isProcessing, setIsProcessing] = useState(false);
  const [isDragActive, setIsDragActive] = useState(false);
  const [isConvertToWordOpen, setIsConvertToWordOpen] = useState(false);
  const [batchOpen, setBatchOpen] = useState(false);
  const [isPreviewPageOrderOpen, setIsPreviewPageOrderOpen] = useState(false);
  const [fullscreenPageId, setFullscreenPageId] = useState<string | null>(null);
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [transferFile, setTransferFile] = useState<{
    name: string;
    kind: FileKind;
  } | null>(null);
  const [retryTransfer, setRetryTransfer] = useState<(() => void) | null>(null);
  const [localExport, setLocalExport] = useState<LocalExportResult | null>(null);
  const [emailingCopy, setEmailingCopy] = useState(false);

  const transfer = useTransferOperation();
  const verifyOpenRef = useRef(verifyOpen);
  verifyOpenRef.current = verifyOpen;

  // Map real upload progress onto the shared transfer state machine and, on the
  // first byte, hand off from the email-verify modal to the progress modal so
  // the two never stack.
  const handleUploadProgress = useCallback(
    (p: UploadProgress) => {
      if (verifyOpenRef.current) setVerifyOpen(false);
      const phase =
        p.stage === 'finalizing'
          ? 'finalizing'
          : p.stage === 'initiating'
            ? 'preparing'
            : 'uploading';
      const showParts = p.totalParts != null && p.totalParts > 1;
      transfer.update({
        phase,
        stageLabel:
          p.stage === 'finalizing'
            ? 'Finalizing on server…'
            : p.stage === 'initiating'
              ? 'Preparing secure upload…'
              : 'Uploading file',
        percent:
          p.stage === 'uploading'
            ? p.percent
            : p.stage === 'finalizing'
              ? 100
              : null,
        bytesSent: p.bytesSent,
        totalBytes: p.totalBytes,
        speedBps: p.speedBps,
        etaSeconds: p.etaSeconds,
        unitLabel: 'Parts',
        unitsDone: showParts ? p.completedParts : undefined,
        unitsTotal: showParts ? p.totalParts : undefined,
        canCancel: p.stage !== 'finalizing',
      });
    },
    [transfer]
  );

  const {
    gateDownload,
    submitEmailForDownload,
    cancelPending,
    cancelUpload,
    clearResult,
    downloadNow,
    result: gatedResult,
  } = useDownloadGate({
    onNeedVerify: () => setVerifyOpen(true),
    onError: (msg) => toast.error('Download failed', msg),
    onUploadProgress: handleUploadProgress,
  });

  const finishTransferSuccess = useCallback(
    (gated: GatedDownloadResult) => {
      transfer.succeed({
        stageLabel: gated.awaitingEmailLink ? 'Sent to your email' : 'Ready',
        percent: 100,
      });
    },
    [transfer]
  );

  const handleTransferError = useCallback(
    (err: unknown) => {
      if (err instanceof Error && err.message === 'Verification cancelled') {
        transfer.reset();
        return;
      }
      if (err instanceof Error && err.name === 'UploadCancelledError') {
        transfer.markCancelled({ stageLabel: 'Cancelled' });
        return;
      }
      console.error('Transfer failure:', err);
      transfer.fail(
        err instanceof Error && err.message
          ? err.message
          : 'The transfer failed. Please try again.'
      );
    },
    [transfer]
  );

  const closeTransfer = useCallback(() => {
    transfer.reset();
    clearResult();
    setTransferFile(null);
    setRetryTransfer(null);
    setEmailingCopy(false);
    setLocalExport((prev) => {
      if (prev?.localBlobUrl) revokeLocalUrl(prev.localBlobUrl);
      return null;
    });
  }, [transfer, clearResult]);

  const finishLocalExport = useCallback(
    (
      blob: Blob,
      fileName: string,
      kind: LocalExportResult['kind'],
      pageCount?: number
    ) => {
      const exported = createLocalExport(blob, fileName, kind, pageCount);
      setLocalExport((prev) => {
        if (prev?.localBlobUrl) revokeLocalUrl(prev.localBlobUrl);
        return exported;
      });
      downloadLocalExport(exported);
      trackEvent(kind === 'docx' ? 'convert' : 'merge', {
        tool: kind === 'docx' ? 'pdf-to-word' : 'merge',
      });
      transfer.succeed({
        stageLabel: 'Downloaded to your device',
        percent: 100,
        totalBytes: blob.size,
      });
    },
    [transfer]
  );

  useEffect(() => {
    const handle = window.setTimeout(() => {
      persistWorkspaceManifest(files, pages);
    }, 400);
    return () => window.clearTimeout(handle);
  }, [files, pages]);

  const handleOpenFullscreenPreview = useCallback((page: PDFPageItem) => {
    setFullscreenPageId(page.id);
  }, []);

  const handleCloseFullscreenPreview = useCallback(() => {
    setFullscreenPageId(null);
  }, []);

  const handleNavigateFullscreenPreview = useCallback((newIndex: number) => {
    const currentPages = pagesRef.current;
    if (newIndex >= 0 && newIndex < currentPages.length) {
      setFullscreenPageId(currentPages[newIndex].id);
    }
  }, []);

  const handleRequestThumbnail = useCallback(
    async (page: PDFPageItem) => {
      if (thumbnailsRef.current.has(page.id)) return;
      if (page.isBlank) return;
      if (page.isImage && page.thumbnailUrl !== undefined) {
        setThumbnailUrl(page.id, page.thumbnailUrl);
        return;
      }
      try {
        const url = await renderPageThumbnailOnDemand(page, fileStoreRef.current);
        setThumbnailUrl(page.id, url);
      } catch (err) {
        console.error(`Lazy thumbnail error for page ${page.id}:`, err);
        setThumbnailUrl(page.id, '');
      }
    },
    [setThumbnailUrl]
  );

  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInsertInputRef = useRef<HTMLInputElement>(null);
  const insertTargetRef = useRef<{ pageId: string; position: 'before' | 'after' } | null>(
    null
  );
  const lastSelectedIndexRef = useRef<number | null>(null);

  const loadThumbnails = async (newPages: PDFPageItem[], currentStore: FileStore) => {
    // Seed Map for images / blanks that already have thumbnailUrl
    setThumbnailsByPageId((prev) => {
      let changed = false;
      const next = new Map(prev);
      for (const p of newPages) {
        if (p.thumbnailUrl !== undefined && !next.has(p.id)) {
          next.set(p.id, p.thumbnailUrl);
          changed = true;
        }
      }
      return changed ? next : prev;
    });

    const initialSlice = newPages.slice(0, 20);
    await renderThumbnailsForPages(initialSlice, currentStore, (pageId, url) => {
      setThumbnailUrl(pageId, url);
    });
  };

  const handleFilesUpload = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setIsProcessing(true);

    const targetContext = insertTargetRef.current;
    insertTargetRef.current = null;

    const rawFilesList = Array.from(fileList);
    const validFiles = rawFilesList.filter((file) => {
      const isPdf =
        file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
      const isImg =
        file.type.startsWith('image/') ||
        /\.(jpg|jpeg|png|webp|gif|bmp|svg|tiff)$/i.test(file.name);
      return isPdf || isImg;
    });

    const existingColors = filesRef.current.map((f) => f.color);
    const colorsToAssign = assignDistinctColors(existingColors, validFiles.length);
    let assignedIndex = 0;

    const newFiles: PDFFile[] = [];
    const newPages: PDFPageItem[] = [];
    const newStoreEntries: FileStore = {};

    for (const file of rawFilesList) {
      const isPdf =
        file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
      const isImg =
        file.type.startsWith('image/') ||
        /\.(jpg|jpeg|png|webp|gif|bmp|svg|tiff)$/i.test(file.name);

      if (!isPdf && !isImg) {
        toast.error('Unsupported file', `"${file.name}" is not a PDF or image.`);
        continue;
      }

      try {
        const { fileInfo, pages: extractedPages, buffer } = await parseUploadedFile(file);
        const assignedColor = colorsToAssign[assignedIndex++] || 'indigo';
        fileInfo.color = assignedColor;

        const colorizedPages = extractedPages.map((page) => ({
          ...page,
          color: assignedColor,
        }));

        newFiles.push(fileInfo);
        newStoreEntries[fileInfo.id] = buffer;
        newPages.push(...colorizedPages);
      } catch (err) {
        console.error(`Failed to parse file "${file.name}":`, err);
        toast.error('Could not process file', `"${file.name}" may be invalid or protected.`);
      }
    }

    if (newFiles.length > 0) {
      setFiles((prev) => [...prev, ...newFiles]);
      setFileStore((prev) => ({ ...prev, ...newStoreEntries }));

      if (targetContext) {
        setPages((prev) => {
          const idx = prev.findIndex((p) => p.id === targetContext.pageId);
          if (idx === -1) return [...prev, ...newPages];
          const updated = [...prev];
          const insertIdx = targetContext.position === 'before' ? idx : idx + 1;
          updated.splice(insertIdx, 0, ...newPages);
          return updated;
        });
      } else {
        setPages((prev) => [...prev, ...newPages]);
      }

      trackEvent('upload_local', { tool: 'workspace' });
      void loadThumbnails(newPages, newStoreEntries);
    }

    setIsProcessing(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (imageInsertInputRef.current) imageInsertInputRef.current.value = '';
  };

  const handleTriggerInsertImage = useCallback(
    (pageId: string, position: 'before' | 'after') => {
      insertTargetRef.current = { pageId, position };
      imageInsertInputRef.current?.click();
    },
    []
  );

  const handleDragOverFile = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragActive(true);
  };
  const handleDragLeaveFile = () => setIsDragActive(false);
  const handleDropFile = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragActive(false);
    void handleFilesUpload(e.dataTransfer.files);
  };

  const handlePageSelect = useCallback((pageId: string, shiftKey: boolean) => {
    setSelectedPageIds((prev) => {
      const next = new Set(prev);
      const currentPages = pagesRef.current;

      if (shiftKey && currentPages.length > 0 && lastSelectedIndexRef.current !== null) {
        const lastIndex = lastSelectedIndexRef.current;
        const currentIndex = currentPages.findIndex((p) => p.id === pageId);
        if (currentIndex !== -1) {
          const start = Math.min(lastIndex, currentIndex);
          const end = Math.max(lastIndex, currentIndex);
          for (let i = start; i <= end; i++) next.add(currentPages[i].id);
          return next;
        }
      }

      if (next.has(pageId)) {
        next.delete(pageId);
      } else {
        next.add(pageId);
        const idx = currentPages.findIndex((p) => p.id === pageId);
        if (idx !== -1) lastSelectedIndexRef.current = idx;
      }
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    setSelectedPageIds(new Set(pagesRef.current.map((p) => p.id)));
  }, []);

  const handleDeselectAll = useCallback(() => {
    setSelectedPageIds(new Set());
  }, []);

  const handleCardDragStart = useCallback((e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', index.toString());
  }, []);

  const handleCardDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverIndex(index);
  }, []);

  const handleCardDragLeave = useCallback(() => setDragOverIndex(null), []);

  const handleCardDrop = useCallback((e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    const sourceIdx = parseInt(e.dataTransfer.getData('text/plain'), 10);
    const currentPages = pagesRef.current;
    const currentSelected = selectedPageIdsRef.current;

    if (!isNaN(sourceIdx) && sourceIdx >= 0 && sourceIdx < currentPages.length) {
      const draggedPage = currentPages[sourceIdx];
      if (draggedPage) {
        if (currentSelected.has(draggedPage.id)) {
          const selectedItems = currentPages.filter((p) => currentSelected.has(p.id));
          const remainingItems = currentPages.filter((p) => !currentSelected.has(p.id));
          const targetPage = currentPages[targetIndex];
          let insertIndex = remainingItems.findIndex((p) => p.id === targetPage?.id);
          if (insertIndex === -1) insertIndex = targetIndex;
          const updatedPages = [...remainingItems];
          updatedPages.splice(insertIndex, 0, ...selectedItems);
          setPages(updatedPages);
        } else if (sourceIdx !== targetIndex) {
          const updatedPages = [...currentPages];
          const [movedItem] = updatedPages.splice(sourceIdx, 1);
          updatedPages.splice(targetIndex, 0, movedItem);
          setPages(updatedPages);
        }
      }
    }
    setDraggedIndex(null);
    setDragOverIndex(null);
  }, []);

  const handlePageRotate = useCallback((pageId: string, degreesToAdd: number) => {
    setPages((prev) =>
      prev.map((p) =>
        p.id === pageId
          ? { ...p, rotation: (p.rotation + degreesToAdd + 360) % 360 }
          : p
      )
    );
  }, []);

  const handlePageDelete = useCallback(
    (pageId: string) => {
      removeThumbnailIds([pageId]);
      setPages((prev) => prev.filter((p) => p.id !== pageId));
      setSelectedPageIds((prev) => {
        const next = new Set(prev);
        next.delete(pageId);
        return next;
      });
    },
    [removeThumbnailIds]
  );

  const handlePageDuplicate = useCallback(
    (pageId: string) => {
      setPages((prev) => {
        const originalIndex = prev.findIndex((p) => p.id === pageId);
        if (originalIndex === -1) return prev;
        const original = prev[originalIndex];
        const duplicate: PDFPageItem = {
          ...original,
          id: `${original.originalFileId || 'blank'}-dup-${Math.random().toString(36).substring(2, 9)}`,
          thumbnailUrl: undefined,
        };
        const thumb = thumbnailsRef.current.get(pageId) ?? original.thumbnailUrl;
        if (thumb !== undefined) {
          setThumbnailUrl(duplicate.id, thumb);
        }
        const updated = [...prev];
        updated.splice(originalIndex + 1, 0, duplicate);
        return updated;
      });
    },
    [setThumbnailUrl]
  );

  const makeBlank = (): PDFPageItem => ({
    id: `blank-p-${Math.random().toString(36).substring(2, 9)}`,
    originalFileId: null,
    originalFileName: 'Blank page',
    originalPageNumber: 0,
    rotation: 0,
    isBlank: true,
    thumbnailUrl: '',
    color: 'slate',
  });

  const handleInsertBlankPage = useCallback(
    (pageId: string, position: 'before' | 'after') => {
      setPages((prev) => {
        const targetIdx = prev.findIndex((p) => p.id === pageId);
        if (targetIdx === -1) return prev;
        const updated = [...prev];
        updated.splice(position === 'before' ? targetIdx : targetIdx + 1, 0, makeBlank());
        return updated;
      });
    },
    []
  );

  const handleAddBlankPageEnd = useCallback(() => {
    setPages((prev) => [...prev, makeBlank()]);
  }, []);

  const handlePageMoveTo = useCallback((pageId: string, targetIndex: number) => {
    setPages((prev) => {
      const sourceIndex = prev.findIndex((p) => p.id === pageId);
      if (sourceIndex === -1 || targetIndex < 0 || targetIndex >= prev.length) return prev;
      const updated = [...prev];
      const [movedItem] = updated.splice(sourceIndex, 1);
      updated.splice(targetIndex, 0, movedItem);
      return updated;
    });
  }, []);

  const handleRotateSelected = useCallback((degreesToAdd: number) => {
    setPages((prev) =>
      prev.map((p) =>
        selectedPageIdsRef.current.has(p.id)
          ? { ...p, rotation: (p.rotation + degreesToAdd + 360) % 360 }
          : p
      )
    );
  }, []);

  const handleDeleteSelected = useCallback(() => {
    const selected = selectedPageIdsRef.current;
    const ids = pagesRef.current.filter((p) => selected.has(p.id)).map((p) => p.id);
    removeThumbnailIds(ids);
    setPages((prev) => prev.filter((p) => !selected.has(p.id)));
    setSelectedPageIds(new Set());
  }, [removeThumbnailIds]);

  const handleDuplicateSelected = useCallback(() => {
    setPages((prev) => {
      const updated: PDFPageItem[] = [];
      const currentSelected = selectedPageIdsRef.current;
      prev.forEach((p) => {
        updated.push(p);
        if (currentSelected.has(p.id)) {
          const dupId = `${p.originalFileId || 'blank'}-dup-${Math.random().toString(36).substring(2, 9)}`;
          const thumb = thumbnailsRef.current.get(p.id) ?? p.thumbnailUrl;
          if (thumb !== undefined) {
            setThumbnailUrl(dupId, thumb);
          }
          updated.push({
            ...p,
            id: dupId,
            thumbnailUrl: undefined,
          });
        }
      });
      return updated;
    });
  }, [setThumbnailUrl]);

  const handleMoveSelectedTo = useCallback((targetIndex: number) => {
    setPages((prev) => {
      const currentSelected = selectedPageIdsRef.current;
      const selectedItems = prev.filter((p) => currentSelected.has(p.id));
      const remainingItems = prev.filter((p) => !currentSelected.has(p.id));
      const clampedTarget = Math.max(0, Math.min(targetIndex, remainingItems.length));
      return [
        ...remainingItems.slice(0, clampedTarget),
        ...selectedItems,
        ...remainingItems.slice(clampedTarget),
      ];
    });
  }, []);

  const handleRemoveFile = (fileId: string) => {
    const pagesToDelete = pagesRef.current
      .filter((p) => p.originalFileId === fileId)
      .map((p) => p.id);
    removeThumbnailIds(pagesToDelete);
    evictFileCaches(fileId);
    setFiles((prev) => prev.filter((f) => f.id !== fileId));
    setFileStore((prev) => {
      const next = { ...prev };
      delete next[fileId];
      return next;
    });
    setPages((prev) => prev.filter((p) => p.originalFileId !== fileId));
    setSelectedPageIds((prev) => {
      const next = new Set(prev);
      pagesToDelete.forEach((id) => next.delete(id));
      return next;
    });
  };

  const handleUpdateFileColor = useCallback((fileId: string, newColor: string) => {
    setFiles((prev) => prev.map((f) => (f.id === fileId ? { ...f, color: newColor } : f)));
    setPages((prev) =>
      prev.map((p) => (p.originalFileId === fileId ? { ...p, color: newColor } : p))
    );
  }, []);

  const handleClearAll = () => setConfirmClearOpen(true);

  const confirmClearAll = () => {
    clearAllPdfCaches();
    setThumbnailsByPageId(new Map());
    setPages([]);
    setFiles([]);
    setFileStore({});
    setSelectedPageIds(new Set());
    clearResult();
    setConfirmClearOpen(false);
  };

  const handleMergeAndCompile = useCallback(async () => {
    const currentPages = pagesRef.current;
    const currentStore = fileStoreRef.current;
    if (currentPages.length === 0) return;
    const total = currentPages.length;
    setTransferFile({ name: MERGE_OUTPUT_NAME, kind: 'merged_pdf' });
    setRetryTransfer(() => () => void handleMergeAndCompile());
    setEmailingCopy(false);
    transfer.begin({
      phase: 'processing',
      stageLabel: `Compiling pages 0 / ${total}`,
      percent: 0,
      unitsTotal: total,
      unitsDone: 0,
      unitLabel: 'Pages',
      canCancel: false,
    });
    try {
      const { blob } = await compileMergedPdf(
        currentPages,
        currentStore,
        (current, t) => {
          transfer.update({
            phase: 'processing',
            stageLabel: `Compiling pages ${current} / ${t}`,
            percent: t ? Math.round((current / t) * 100) : null,
            unitsDone: current,
            unitsTotal: t,
            unitLabel: 'Pages',
          });
        }
      );
      finishLocalExport(blob, MERGE_OUTPUT_NAME, 'pdf', total);
    } catch (err) {
      handleTransferError(err);
    }
  }, [transfer, finishLocalExport, handleTransferError]);

  const handleExtractSelected = useCallback(async () => {
    const selected = selectedPageIdsRef.current;
    const currentPages = pagesRef.current.filter((p) => selected.has(p.id));
    const currentStore = fileStoreRef.current;
    if (currentPages.length === 0) return;
    const outName = 'extracted-pages.pdf';
    const total = currentPages.length;
    setTransferFile({ name: outName, kind: 'merged_pdf' });
    setRetryTransfer(() => () => void handleExtractSelected());
    setEmailingCopy(false);
    transfer.begin({
      phase: 'processing',
      stageLabel: `Extracting pages 0 / ${total}`,
      percent: 0,
      unitsTotal: total,
      unitsDone: 0,
      unitLabel: 'Pages',
      canCancel: false,
    });
    try {
      const { blob } = await compileMergedPdf(
        currentPages,
        currentStore,
        (current, t) => {
          transfer.update({
            phase: 'processing',
            stageLabel: `Extracting pages ${current} / ${t}`,
            percent: t ? Math.round((current / t) * 100) : null,
            unitsDone: current,
            unitsTotal: t,
            unitLabel: 'Pages',
          });
        }
      );
      finishLocalExport(blob, outName, 'pdf', total);
    } catch (err) {
      handleTransferError(err);
    }
  }, [transfer, finishLocalExport, handleTransferError]);

  const handleWordGatedDownload = useCallback(
    async (blob: Blob, fileName: string) => {
      setTransferFile({ name: fileName, kind: 'docx' });
      setRetryTransfer(null);
      setEmailingCopy(false);
      transfer.begin({
        phase: 'processing',
        stageLabel: 'Finalizing Word document…',
        percent: 100,
        canCancel: false,
      });
      try {
        finishLocalExport(blob, fileName, 'docx');
      } catch (err) {
        handleTransferError(err);
      }
    },
    [transfer, finishLocalExport, handleTransferError]
  );

  const handleEmailCopy = useCallback(async () => {
    if (!localExport) return;
    setEmailingCopy(true);
    transfer.update({
      phase: 'preparing',
      stageLabel: 'Preparing optional email delivery…',
      percent: null,
      canCancel: true,
    });
    transfer.setCancelHandler(cancelUpload);
    try {
      const gated = await gateDownload({
        blob: localExport.blob,
        fileName: localExport.fileName,
        kind: localExport.kind === 'docx' ? 'docx' : 'merged_pdf',
        pageCount: localExport.pageCount,
      });
      finishTransferSuccess(gated);
    } catch (err) {
      handleTransferError(err);
    }
  }, [
    localExport,
    transfer,
    cancelUpload,
    gateDownload,
    finishTransferSuccess,
    handleTransferError,
  ]);

  const handleLocalDownloadAgain = useCallback(() => {
    if (!localExport) return;
    downloadLocalExport(localExport);
  }, [localExport]);

  const handleTransferOpen = useCallback(() => {
    const url = localExport?.localBlobUrl || gatedResult?.localBlobUrl;
    if (url) window.open(url, '_blank', 'noopener');
  }, [localExport, gatedResult]);

  const handleSubmitVerifyEmail = useCallback(
    async (email: string) => {
      transfer.update({
        phase: 'preparing',
        stageLabel: 'Preparing optional email delivery…',
        canCancel: true,
      });
      transfer.setCancelHandler(cancelUpload);
      await submitEmailForDownload(email);
      transfer.succeed({
        stageLabel: 'Sent to your email',
        percent: 100,
      });
    },
    [transfer, cancelUpload, submitEmailForDownload]
  );

  const handleTriggerUpload = () => fileInputRef.current?.click();

  const activeFullscreenIndex = pages.findIndex((p) => p.id === fullscreenPageId);
  const activeFullscreenPage =
    activeFullscreenIndex !== -1
      ? {
          ...pages[activeFullscreenIndex],
          thumbnailUrl:
            thumbnailsByPageId.get(pages[activeFullscreenIndex].id) ??
            pages[activeFullscreenIndex].thumbnailUrl,
        }
      : null;

  return (
    <div
      onDragOver={handleDragOverFile}
      onDragLeave={handleDragLeaveFile}
      onDrop={handleDropFile}
      className="flex min-h-screen flex-col bg-[color:var(--color-canvas)] font-sans text-[color:var(--color-ink)]"
    >
      <input
        id="pdf-upload-input"
        type="file"
        ref={fileInputRef}
        onChange={(e) => void handleFilesUpload(e.target.files)}
        multiple
        accept="application/pdf,image/*,.pdf,.jpg,.jpeg,.png,.webp,.gif,.bmp,.tiff,.svg"
        className="hidden"
      />
      <input
        id="image-insert-input"
        type="file"
        ref={imageInsertInputRef}
        onChange={(e) => void handleFilesUpload(e.target.files)}
        multiple
        accept="image/*"
        className="hidden"
      />

      <AnimatePresence>
        {isDragActive && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="pointer-events-none fixed inset-0 z-50 flex flex-col items-center justify-center bg-teal-900/95 p-10 text-center text-white backdrop-blur-xs"
          >
            <UploadCloud className="mb-4 h-20 w-20 animate-bounce stroke-1 text-teal-100" />
            <h2 className="text-3xl font-extrabold tracking-tight">
              Drop your PDF & Image files here
            </h2>
            <p className="mt-2 max-w-sm text-sm text-teal-100/90">
              Release to import into the workspace. Merge runs locally on your device.
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      <header className="sticky top-0 z-30 border-b border-[color:var(--color-border)] bg-[color:var(--color-surface)]/90 shadow-xs backdrop-blur-md">
        <div className="flex min-h-14 items-center justify-between gap-2 px-3 py-2 sm:min-h-16 sm:gap-3 sm:px-6 sm:py-0">
          <Link
            href="/"
            className="flex min-w-0 shrink items-center gap-2 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 sm:gap-3"
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-teal-800 text-white shadow-md shadow-teal-900/20">
              <Layers className="h-4 w-4" />
            </div>
            <div className="flex min-w-0 items-center">
              <h1 className="font-display truncate text-base tracking-tight text-[color:var(--color-ink)] sm:text-lg">
                PDFNexus
              </h1>
              <span className="ml-2 hidden rounded-full border border-teal-200 bg-teal-50 px-2 py-0.5 text-[11px] font-bold text-teal-800 sm:inline">
                Local Engine
              </span>
            </div>
          </Link>

          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2.5">
            <div className="hidden items-center gap-1.5 rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1.5 text-[11px] font-bold text-emerald-700 lg:flex">
              <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              <span>Privacy Shield Active</span>
            </div>

            <button
              type="button"
              onClick={handleTriggerUpload}
              className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-slate-800 px-2.5 py-1.5 text-xs font-semibold text-white transition-all hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 sm:px-3.5"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Add</span>
              <span className="hidden sm:inline"> Files</span>
            </button>

            {pages.length > 0 && (
              <>
                {/* Desktop / tablet action strip */}
                <div className="hidden items-center gap-2 border-l border-slate-200 pl-2 md:flex lg:pl-3">
                  <button
                    type="button"
                    onClick={() => setIsPreviewPageOrderOpen(true)}
                    className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 transition-all hover:bg-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
                  >
                    <ListOrdered className="h-3.5 w-3.5 text-teal-700" />
                    <span className="hidden lg:inline">Preview Order</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsConvertToWordOpen(true)}
                    className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-teal-200 bg-teal-50 px-3 py-1.5 text-xs font-bold text-teal-800 transition-all hover:bg-teal-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
                  >
                    <FileType className="h-3.5 w-3.5 text-teal-700" />
                    <span className="hidden lg:inline">Convert to Word</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setBatchOpen(true)}
                    className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 transition-all hover:bg-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
                  >
                    <ListTodo className="h-3.5 w-3.5 text-teal-700" />
                    <span className="hidden lg:inline">Batch queue</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleClearAll}
                    className="cursor-pointer rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50 hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
                  >
                    Reset
                  </button>
                </div>

                {/* Mobile overflow menu for secondary actions */}
                <div className="md:hidden">
                  <DropdownMenu
                    align="end"
                    trigger={
                      <button
                        type="button"
                        aria-label="More workspace actions"
                        className="flex cursor-pointer items-center justify-center rounded-lg border border-slate-200 bg-white p-1.5 text-slate-600 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </button>
                    }
                  >
                    <DropdownItem onClick={() => setIsPreviewPageOrderOpen(true)}>
                      <ListOrdered className="h-3.5 w-3.5 text-teal-700" />
                      Preview Order
                    </DropdownItem>
                    <DropdownItem onClick={() => setIsConvertToWordOpen(true)}>
                      <FileType className="h-3.5 w-3.5 text-teal-700" />
                      Convert to Word
                    </DropdownItem>
                    <DropdownItem onClick={() => setBatchOpen(true)}>
                      <ListTodo className="h-3.5 w-3.5 text-teal-700" />
                      Batch queue
                    </DropdownItem>
                    <DropdownItem
                      onClick={() => {
                        window.location.href = '/pdf-to-excel';
                      }}
                    >
                      PDF to Excel
                    </DropdownItem>
                    <DropdownItem
                      onClick={() => {
                        window.location.href = '/pdf-to-pptx';
                      }}
                    >
                      PDF to PPTX
                    </DropdownItem>
                    <DropdownItem
                      onClick={() => {
                        window.location.href = '/bates-numbering';
                      }}
                    >
                      Bates numbering
                    </DropdownItem>
                    <DropdownItem
                      onClick={() => {
                        window.location.href = '/redact-pdf';
                      }}
                    >
                      Redact PDF
                    </DropdownItem>
                    <DropdownItem
                      onClick={() => {
                        window.location.href = '/create-pdf-form';
                      }}
                    >
                      Create PDF form
                    </DropdownItem>
                    <DropdownItem
                      onClick={() => {
                        window.location.href = '/pdf-to-html';
                      }}
                    >
                      PDF to HTML
                    </DropdownItem>
                    <DropdownItem
                      onClick={() => {
                        window.location.href = '/office-to-pdf';
                      }}
                    >
                      Office to PDF
                    </DropdownItem>
                    <DropdownItem
                      onClick={() => {
                        window.location.href = '/cert-sign-pdf';
                      }}
                    >
                      Cert sign PDF
                    </DropdownItem>
                    <DropdownItem danger onClick={handleClearAll}>
                      Reset workspace
                    </DropdownItem>
                  </DropdownMenu>
                </div>

                <button
                  type="button"
                  onClick={() => void handleMergeAndCompile()}
                  disabled={transfer.isActive}
                  className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-teal-700 px-2.5 py-1.5 text-xs font-bold text-white shadow-sm transition-all hover:bg-teal-800 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 sm:px-4.5"
                >
                  {transfer.isActive ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span className="hidden sm:inline">Compiling...</span>
                    </>
                  ) : (
                    <>
                      <Download className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">Merge & Download</span>
                      <span className="sm:hidden">Merge</span>
                    </>
                  )}
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-[1400px] flex-1 flex-col items-start gap-6 px-4 py-6 md:px-6 lg:flex-row">
        <Sidebar
          files={files}
          onRemoveFile={handleRemoveFile}
          onClearAll={handleClearAll}
          onAddBlankEnd={handleAddBlankPageEnd}
          onUploadClick={handleTriggerUpload}
          onConvertToWord={() => setIsConvertToWordOpen(true)}
          currentWorkspacePages={pages.length}
          onUpdateFileColor={handleUpdateFileColor}
        />

        <div className="relative flex min-h-[500px] flex-1 flex-col rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] shadow-sm">
          {isProcessing && (
            <div className="absolute inset-0 z-20 flex items-center justify-center rounded-2xl bg-white/70 backdrop-blur-sm">
              <Loader2 className="h-8 w-8 animate-spin text-teal-700" />
            </div>
          )}

          {pages.length === 0 ? (
            <div
              onClick={handleTriggerUpload}
              className="group flex flex-1 cursor-pointer flex-col items-center justify-center p-8 text-center transition-colors hover:bg-slate-50/50"
            >
              <div className="mb-4 rounded-2xl border border-teal-100/50 bg-teal-50 p-5 text-teal-700 transition-transform duration-200 group-hover:scale-105">
                <UploadCloud className="h-10 w-10 stroke-1" />
              </div>
              <h2 className="font-display text-xl tracking-tight text-slate-900">
                Merge PDFs & Images locally
              </h2>
              <p className="mt-1.5 max-w-sm text-xs leading-relaxed text-slate-500">
                Drag & drop PDFs and images. Arrange pages, insert images, rotate, and merge —
                all on your device until you download.
              </p>
              <button
                type="button"
                className="mt-5 flex items-center gap-1.5 rounded-xl bg-teal-700 px-5 py-2.5 text-xs font-bold text-white shadow-md transition-all hover:bg-teal-800"
              >
                <FilePlus2 className="h-3.5 w-3.5" /> Select Files / Images From Device
              </button>
              <p className="mt-4 max-w-xs text-[10px] leading-normal text-slate-400">
                No quality loss. Processed 100% locally — download your PDF anytime without email verification.
              </p>
            </div>
          ) : (
            <div className="flex flex-1 flex-col p-5">
              <div className="mb-5 flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400">
                    Assemble Page Order
                  </h2>
                  <button
                    type="button"
                    onClick={() => setIsPreviewPageOrderOpen(true)}
                    className="flex cursor-pointer items-center gap-1 rounded-md border border-teal-100 bg-teal-50 px-2 py-0.5 text-[11px] font-bold text-teal-700 transition-colors hover:bg-teal-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
                  >
                    <ListOrdered className="h-3 w-3" /> Preview List ({pages.length})
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSelectAll}
                    className="cursor-pointer rounded-lg px-2.5 py-1 text-[11px] font-bold text-slate-500 transition-colors hover:bg-slate-50 hover:text-teal-700"
                  >
                    Select All
                  </button>
                  {selectedPageIds.size > 0 && (
                    <button
                      type="button"
                      onClick={handleDeselectAll}
                      className="cursor-pointer rounded-lg px-2.5 py-1 text-[11px] font-bold text-slate-500 transition-colors hover:bg-slate-50 hover:text-red-500"
                    >
                      Deselect ({selectedPageIds.size})
                    </button>
                  )}
                </div>
              </div>

              <div className="sr-only" aria-live="polite" aria-atomic="true">
                {liveMessage}
              </div>
              <VirtualizedPageGrid
                pages={pages}
                selectedPageIds={selectedPageIds}
                thumbnailsByPageId={thumbnailsByPageId}
                onSelect={handlePageSelect}
                onRotate={handlePageRotate}
                onDelete={handlePageDelete}
                onDuplicate={handlePageDuplicate}
                onInsertBlank={handleInsertBlankPage}
                onInsertImage={handleTriggerInsertImage}
                onPreview={handleOpenFullscreenPreview}
                onMoveTo={handlePageMoveTo}
                onDragStart={handleCardDragStart}
                onDragOver={handleCardDragOver}
                onDragLeave={handleCardDragLeave}
                onDrop={handleCardDrop}
                draggedIndex={draggedIndex}
                dragOverIndex={dragOverIndex}
                onRequestThumbnail={handleRequestThumbnail}
                onAnnounce={announce}
              />
              <div className="h-24 shrink-0" />
            </div>
          )}
        </div>
      </div>

      <BulkControls
        selectedCount={selectedPageIds.size}
        totalCount={pages.length}
        onRotateSelected={handleRotateSelected}
        onDeleteSelected={handleDeleteSelected}
        onDuplicateSelected={handleDuplicateSelected}
        onDeselectAll={handleDeselectAll}
        onSelectAll={handleSelectAll}
        onMoveSelectedTo={handleMoveSelectedTo}
        onConvertToWord={() => setIsConvertToWordOpen(true)}
        onExtractSelected={() => void handleExtractSelected()}
        onCropSelected={() => {
          void (async () => {
            try {
              await navigateWorkspaceToTool({
                path: '/crop-pdf',
                pages,
                fileStore: fileStoreRef.current,
                selectedPageIds,
                includePageRange: true,
              });
            } catch (e) {
              announce(
                e instanceof Error ? e.message : 'Could not open Crop tool'
              );
            }
          })();
        }}
        onResizeSelected={() => {
          void (async () => {
            try {
              await navigateWorkspaceToTool({
                path: '/resize-pdf',
                pages,
                fileStore: fileStoreRef.current,
                selectedPageIds,
                includePageRange: true,
              });
            } catch (e) {
              announce(
                e instanceof Error ? e.message : 'Could not open Resize tool'
              );
            }
          })();
        }}
        onFlattenSelected={() => {
          void (async () => {
            try {
              await navigateWorkspaceToTool({
                path: '/flatten-pdf',
                pages,
                fileStore: fileStoreRef.current,
                selectedPageIds,
              });
            } catch (e) {
              announce(
                e instanceof Error ? e.message : 'Could not open Flatten tool'
              );
            }
          })();
        }}
        onExcelSelected={() => {
          void (async () => {
            try {
              await navigateWorkspaceToTool({
                path: '/pdf-to-excel',
                pages,
                fileStore: fileStoreRef.current,
                selectedPageIds,
              });
            } catch (e) {
              announce(
                e instanceof Error ? e.message : 'Could not open Excel tool'
              );
            }
          })();
        }}
        onPptxSelected={() => {
          void (async () => {
            try {
              await navigateWorkspaceToTool({
                path: '/pdf-to-pptx',
                pages,
                fileStore: fileStoreRef.current,
                selectedPageIds,
              });
            } catch (e) {
              announce(
                e instanceof Error ? e.message : 'Could not open PPTX tool'
              );
            }
          })();
        }}
        onBatesSelected={() => {
          void (async () => {
            try {
              await navigateWorkspaceToTool({
                path: '/bates-numbering',
                pages,
                fileStore: fileStoreRef.current,
                selectedPageIds,
              });
            } catch (e) {
              announce(
                e instanceof Error ? e.message : 'Could not open Bates tool'
              );
            }
          })();
        }}
        onRedactSelected={() => {
          void (async () => {
            try {
              await navigateWorkspaceToTool({
                path: '/redact-pdf',
                pages,
                fileStore: fileStoreRef.current,
                selectedPageIds,
              });
            } catch (e) {
              announce(
                e instanceof Error ? e.message : 'Could not open Redact tool'
              );
            }
          })();
        }}
        onFormSelected={() => {
          void (async () => {
            try {
              await navigateWorkspaceToTool({
                path: '/create-pdf-form',
                pages,
                fileStore: fileStoreRef.current,
                selectedPageIds,
              });
            } catch (e) {
              announce(
                e instanceof Error ? e.message : 'Could not open Form tool'
              );
            }
          })();
        }}
        onHtmlSelected={() => {
          void (async () => {
            try {
              await navigateWorkspaceToTool({
                path: '/pdf-to-html',
                pages,
                fileStore: fileStoreRef.current,
                selectedPageIds,
              });
            } catch (e) {
              announce(
                e instanceof Error ? e.message : 'Could not open HTML tool'
              );
            }
          })();
        }}
        onOfficeSelected={() => {
          window.location.href = '/office-to-pdf';
        }}
        onCertSignSelected={() => {
          void (async () => {
            try {
              await navigateWorkspaceToTool({
                path: '/cert-sign-pdf',
                pages,
                fileStore: fileStoreRef.current,
                selectedPageIds,
              });
            } catch (e) {
              announce(
                e instanceof Error ? e.message : 'Could not open Cert sign tool'
              );
            }
          })();
        }}
      />

      <BatchQueuePanel open={batchOpen} onClose={() => setBatchOpen(false)} />

      <ConvertToWordModal
        isOpen={isConvertToWordOpen}
        onClose={() => setIsConvertToWordOpen(false)}
        files={files}
        pages={pages}
        selectedPageIds={selectedPageIds}
        fileStore={fileStore}
        onRequestGatedDownload={handleWordGatedDownload}
      />

      <PreviewOrderModal
        open={isPreviewPageOrderOpen}
        pages={pages}
        thumbnailsByPageId={thumbnailsByPageId}
        onClose={() => setIsPreviewPageOrderOpen(false)}
        onMerge={() => {
          setIsPreviewPageOrderOpen(false);
          void handleMergeAndCompile();
        }}
      />

      <TransferProgressModal
        open={transfer.state.phase !== 'idle' && !verifyOpen}
        state={transfer.state}
        fileName={
          transferFile?.name ??
          localExport?.fileName ??
          gatedResult?.fileName ??
          'Your file'
        }
        fileKind={
          transferFile?.kind === 'docx' || localExport?.kind === 'docx'
            ? 'Word'
            : 'PDF'
        }
        steps={
          emailingCopy
            ? UPLOAD_STEPS
            : transferFile?.kind === 'docx'
              ? CONVERT_STEPS
              : MERGE_STEPS
        }
        activeStepKey={
          transfer.state.phase === 'cancelling' ? undefined : transfer.state.phase
        }
        emailNote={
          gatedResult?.awaitingEmailLink
            ? 'Check your email — click “Download your file” in the message to finish.'
            : gatedResult?.emailQueued
              ? 'A copy was also sent to your verified email.'
              : localExport && !emailingCopy
                ? 'File is ready on your device. Email delivery is optional.'
                : null
        }
        onCancel={() => transfer.requestCancel()}
        onClose={closeTransfer}
        onDownload={
          gatedResult?.awaitingEmailLink
            ? undefined
            : localExport
              ? handleLocalDownloadAgain
              : downloadNow
        }
        onOpen={gatedResult?.awaitingEmailLink ? undefined : handleTransferOpen}
        onEmailCopy={
          localExport && !gatedResult?.awaitingEmailLink && !emailingCopy
            ? () => void handleEmailCopy()
            : undefined
        }
        onRetry={retryTransfer ?? undefined}
        downloadDisabled={Boolean(gatedResult?.awaitingEmailLink)}
      />

      <EmailVerifyModal
        open={verifyOpen}
        onClose={() => {
          setVerifyOpen(false);
          cancelPending();
        }}
        onSubmitEmail={handleSubmitVerifyEmail}
      />

      <ConfirmDialog
        open={confirmClearOpen}
        title="Reset workspace?"
        message="This will clear all uploaded files and progress from this session."
        confirmLabel="Reset"
        danger
        onConfirm={confirmClearAll}
        onCancel={() => setConfirmClearOpen(false)}
      />

      <AnimatePresence>
        {fullscreenPageId && activeFullscreenPage && (
          <FullScreenPreviewModal
            page={activeFullscreenPage}
            pageIndex={activeFullscreenIndex}
            totalPages={pages.length}
            fileStore={fileStore}
            onClose={handleCloseFullscreenPreview}
            onNavigate={handleNavigateFullscreenPreview}
            onRotate={handlePageRotate}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
