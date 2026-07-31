/**
 * PDF helpers — FileStore is the sole binary owner.
 * Self-hosted pdf.js worker; isEvalSupported: false; cache eviction APIs.
 */

import { PDFDocument, degrees } from 'pdf-lib';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { PDFPageItem, PDFFile, FileStore } from '@/lib/types';
import { ensurePdfJsWorker } from './ensurePdfJsWorker';

type PdfjsModule = typeof import('pdfjs-dist');

let pdfjsLib: PdfjsModule | null = null;

async function getPdfjs(): Promise<PdfjsModule> {
  if (typeof window === 'undefined') {
    throw new Error('PDF.js is only available in the browser');
  }
  if (!pdfjsLib) {
    pdfjsLib = await import('pdfjs-dist');
  }
  ensurePdfWorker(pdfjsLib);
  return pdfjsLib;
}

export function ensurePdfWorker(lib?: PdfjsModule): void {
  ensurePdfJsWorker(lib || pdfjsLib);
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 11);
}

/** Shared pdf.js document proxies — seeded during parsePDFFile, reused by thumbnails. */
const pdfDocTaskCache = new Map<string, Promise<PDFDocumentProxy>>();

async function convertImageToPngBuffer(
  imageBuffer: ArrayBuffer,
  mimeType?: string
): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const safeBuffer = imageBuffer.slice(0);
    const blob = new Blob([safeBuffer], { type: mimeType || 'image/png' });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth || img.width || 800;
      canvas.height = img.naturalHeight || img.height || 600;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        URL.revokeObjectURL(url);
        return reject(new Error('Canvas context unavailable'));
      }
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      canvas.toBlob(
        (convertedBlob) => {
          if (!convertedBlob) return reject(new Error('Failed to convert image blob'));
          convertedBlob.arrayBuffer().then(resolve).catch(reject);
        },
        'image/png',
        0.95
      );
    };
    img.onerror = (err) => {
      URL.revokeObjectURL(url);
      reject(err);
    };
    img.src = url;
  });
}

/**
 * Parses an image file into a PDF page item. Binary lives only in returned store entry.
 */
export async function parseImageFile(
  file: File
): Promise<{ fileInfo: PDFFile; pages: PDFPageItem[]; buffer: ArrayBuffer }> {
  const rawBuffer = await file.arrayBuffer();
  const arrayBuffer = rawBuffer.slice(0);
  const fileId = generateId();
  const mimeType = file.type || 'image/png';

  const fileInfo: PDFFile = {
    id: fileId,
    name: file.name,
    size: file.size,
    pageCount: 1,
    fileType: 'image',
    mimeType,
  };

  const blob = new Blob([arrayBuffer.slice(0)], { type: mimeType });
  const thumbnailUrl = trackObjectUrl(URL.createObjectURL(blob));

  const pageItem: PDFPageItem = {
    id: `${fileId}-img-${generateId()}`,
    originalFileId: fileId,
    originalFileName: file.name,
    originalPageNumber: 1,
    rotation: 0,
    isBlank: false,
    isImage: true,
    mimeType,
    thumbnailUrl,
  };

  return { fileInfo, pages: [pageItem], buffer: arrayBuffer };
}

export async function parsePDFFile(
  file: File
): Promise<{ fileInfo: PDFFile; pages: PDFPageItem[]; buffer: ArrayBuffer }> {
  const rawBuffer = await file.arrayBuffer();
  const arrayBuffer = rawBuffer.slice(0);

  const pdfLibDoc = await PDFDocument.load(rawBuffer.slice(0));
  const pdfLibCount = pdfLibDoc.getPageCount();
  const fileId = generateId();

  // pdf.js is authoritative for thumbnail/render page count — clamp so we never
  // request getPage(N) when pdf.js reports fewer pages than pdf-lib.
  let pageCount = pdfLibCount;
  try {
    const pdfjs = await getPdfjs();
    const uint8 = new Uint8Array(arrayBuffer.slice(0));
    const loadingTask = pdfjs.getDocument({
      data: uint8,
      isEvalSupported: false,
    });
    const docPromise = loadingTask.promise.catch((err: unknown) => {
      pdfDocTaskCache.delete(fileId);
      throw err;
    });
    pdfDocTaskCache.set(fileId, docPromise);
    const pdfjsDoc = await docPromise;
    pageCount = Math.min(pdfLibCount, pdfjsDoc.numPages);
    if (pageCount < pdfLibCount) {
      console.warn(
        `PDF "${file.name}": pdf-lib reports ${pdfLibCount} pages, pdf.js reports ${pdfjsDoc.numPages}; using ${pageCount}`
      );
    }
  } catch (err) {
    console.warn(
      `PDF "${file.name}": pdf.js probe failed, falling back to pdf-lib count (${pdfLibCount})`,
      err
    );
    pageCount = pdfLibCount;
  }

  const fileInfo: PDFFile = {
    id: fileId,
    name: file.name,
    size: file.size,
    pageCount,
    fileType: 'pdf',
    mimeType: 'application/pdf',
  };

  const pages: PDFPageItem[] = [];
  for (let i = 1; i <= pageCount; i++) {
    pages.push({
      id: `${fileId}-p${i}-${generateId()}`,
      originalFileId: fileId,
      originalFileName: file.name,
      originalPageNumber: i,
      rotation: 0,
      isBlank: false,
      isImage: false,
      mimeType: 'application/pdf',
    });
  }

  return { fileInfo, pages, buffer: arrayBuffer };
}

export async function parseUploadedFile(
  file: File
): Promise<{ fileInfo: PDFFile; pages: PDFPageItem[]; buffer: ArrayBuffer }> {
  const isPdf =
    file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
  if (isPdf) {
    return await parsePDFFile(file);
  }
  return await parseImageFile(file);
}

export async function renderPageThumbnail(
  source: ArrayBuffer | PDFDocumentProxy,
  pageNumber: number
): Promise<string> {
  const pdfjs = await getPdfjs();
  let createdPdfDoc: PDFDocumentProxy | null = null;
  try {
    let pdfDoc: PDFDocumentProxy;
    if (source instanceof ArrayBuffer) {
      if (source.byteLength === 0) {
        throw new Error('ArrayBuffer is detached');
      }
      const uint8 = new Uint8Array(source.slice(0));
      const loadingTask = pdfjs.getDocument({
        data: uint8,
        isEvalSupported: false,
      });
      pdfDoc = await loadingTask.promise;
      createdPdfDoc = pdfDoc;
    } else {
      pdfDoc = source;
    }

    if (pageNumber < 1 || pageNumber > pdfDoc.numPages) {
      console.warn(
        `Skipping thumbnail for page ${pageNumber}: document has ${pdfDoc.numPages} pages`
      );
      if (createdPdfDoc) {
        try {
          await createdPdfDoc.destroy();
        } catch {
          // ignore
        }
      }
      return '';
    }

    const page = await pdfDoc.getPage(pageNumber);
    const unscaledViewport = page.getViewport({ scale: 1.0 });
    const scale = 180 / unscaledViewport.width;
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Canvas context not available');
    }

    canvas.width = viewport.width;
    canvas.height = viewport.height;

    await page.render({
      canvasContext: context,
      viewport,
      canvas,
    }).promise;

    const blobUrl = await canvasToBlobUrl(canvas, 0.8);
    page.cleanup();

    if (createdPdfDoc) {
      try {
        await createdPdfDoc.destroy();
      } catch {
        // ignore
      }
    }

    return blobUrl;
  } catch (error) {
    console.error(`Error rendering thumbnail for page ${pageNumber}:`, error);
    if (createdPdfDoc) {
      try {
        await createdPdfDoc.destroy();
      } catch {
        // ignore
      }
    }
    return '';
  }
}

const THUMB_LRU_MAX = 250;
const HIGHRES_LRU_MAX = 20;
const THUMB_CONCURRENCY = 3;

const thumbnailDataCache = new Map<string, string>();
const inFlightPromises = new Map<string, Promise<string>>();
const highResCache = new Map<string, string>();
const objectUrls = new Set<string>();

type ThumbnailEvictListener = (url: string, cacheKey: string) => void;
const thumbnailEvictListeners = new Set<ThumbnailEvictListener>();

/** Subscribe to thumbnail LRU / file-eviction URL revokes (keyed by cache fileId-pageNumber). */
export function onThumbnailCacheEvict(listener: ThumbnailEvictListener): () => void {
  thumbnailEvictListeners.add(listener);
  return () => thumbnailEvictListeners.delete(listener);
}

function notifyThumbnailEvict(url: string, cacheKey: string): void {
  for (const listener of thumbnailEvictListeners) {
    try {
      listener(url, cacheKey);
    } catch {
      // ignore listener errors
    }
  }
}

function canvasToBlobUrl(canvas: HTMLCanvasElement, quality: number): Promise<string> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('canvas.toBlob failed'));
          return;
        }
        resolve(trackObjectUrl(URL.createObjectURL(blob)));
      },
      'image/jpeg',
      quality
    );
  });
}

function lruGet(cache: Map<string, string>, key: string): string | undefined {
  if (!cache.has(key)) return undefined;
  const value = cache.get(key)!;
  cache.delete(key);
  cache.set(key, value);
  return value;
}

function lruSet(
  cache: Map<string, string>,
  key: string,
  url: string,
  max: number,
  notifyEvict: boolean
): void {
  if (cache.has(key)) {
    const prev = cache.get(key)!;
    cache.delete(key);
    if (prev !== url) {
      revokeObjectUrl(prev);
      if (notifyEvict) notifyThumbnailEvict(prev, key);
    }
  }
  cache.set(key, url);
  while (cache.size > max) {
    const oldestKey = cache.keys().next().value as string | undefined;
    if (oldestKey === undefined) break;
    const evicted = cache.get(oldestKey)!;
    cache.delete(oldestKey);
    revokeObjectUrl(evicted);
    if (notifyEvict) notifyThumbnailEvict(evicted, oldestKey);
  }
}

let thumbSlotsActive = 0;
const thumbSlotWaiters: Array<() => void> = [];

async function withThumbnailSlot<T>(fn: () => Promise<T>): Promise<T> {
  if (thumbSlotsActive >= THUMB_CONCURRENCY) {
    await new Promise<void>((resolve) => thumbSlotWaiters.push(resolve));
  }
  thumbSlotsActive += 1;
  try {
    return await fn();
  } finally {
    thumbSlotsActive -= 1;
    const next = thumbSlotWaiters.shift();
    if (next) next();
  }
}

export function revokeObjectUrl(url: string | undefined | null): void {
  if (!url || !url.startsWith('blob:')) return;
  try {
    URL.revokeObjectURL(url);
  } catch {
    // ignore
  }
  objectUrls.delete(url);
}

export function trackObjectUrl(url: string): string {
  if (url.startsWith('blob:')) objectUrls.add(url);
  return url;
}

/** Evict PDF.js document proxy + thumbnail/high-res caches for a file. */
export function evictFileCaches(fileId: string): void {
  const docPromise = pdfDocTaskCache.get(fileId);
  pdfDocTaskCache.delete(fileId);
  if (docPromise) {
    void docPromise
      .then((doc) => doc.destroy())
      .catch(() => {
        // ignore
      });
  }

  for (const key of [...thumbnailDataCache.keys()]) {
    if (key.startsWith(`${fileId}-`)) {
      const url = thumbnailDataCache.get(key);
      thumbnailDataCache.delete(key);
      if (url) {
        revokeObjectUrl(url);
        notifyThumbnailEvict(url, key);
      }
    }
  }
  for (const key of [...highResCache.keys()]) {
    if (key.includes(fileId)) {
      const url = highResCache.get(key);
      highResCache.delete(key);
      revokeObjectUrl(url);
    }
  }
  for (const [pageId, promise] of [...inFlightPromises.entries()]) {
    if (pageId.includes(fileId)) {
      inFlightPromises.delete(pageId);
      void promise;
    }
  }
}

/** Clear all PDF caches and revoke tracked blob URLs. */
export function clearAllPdfCaches(): void {
  for (const [fileId] of [...pdfDocTaskCache.keys()]) {
    evictFileCaches(fileId);
  }
  pdfDocTaskCache.clear();
  for (const [key, url] of [...thumbnailDataCache.entries()]) {
    revokeObjectUrl(url);
    notifyThumbnailEvict(url, key);
  }
  thumbnailDataCache.clear();
  inFlightPromises.clear();
  for (const url of highResCache.values()) {
    revokeObjectUrl(url);
  }
  highResCache.clear();
  for (const url of [...objectUrls]) {
    revokeObjectUrl(url);
  }
  objectUrls.clear();
}

export function getPDFDocumentProxy(
  fileId: string,
  fileStore: FileStore
): Promise<PDFDocumentProxy> | null {
  if (pdfDocTaskCache.has(fileId)) {
    return pdfDocTaskCache.get(fileId)!;
  }

  const buffer = fileStore[fileId];
  if (!buffer || buffer.byteLength === 0) {
    return null;
  }

  const docPromise = (async () => {
    const pdfjs = await getPdfjs();
    const uint8 = new Uint8Array(buffer.slice(0));
    const loadingTask = pdfjs.getDocument({
      data: uint8,
      isEvalSupported: false,
    });
    return loadingTask.promise;
  })().catch((err) => {
    pdfDocTaskCache.delete(fileId);
    console.error(`Failed to load PDF doc for ${fileId}:`, err);
    throw err;
  });

  pdfDocTaskCache.set(fileId, docPromise);
  return docPromise;
}

export async function renderPageThumbnailOnDemand(
  pageItem: PDFPageItem,
  fileStore: FileStore
): Promise<string> {
  if (pageItem.isBlank) return '';
  if (pageItem.isImage) return pageItem.thumbnailUrl || '';
  if (!pageItem.originalFileId) return '';

  const cacheKey = `${pageItem.originalFileId}-${pageItem.originalPageNumber}`;
  const cached = lruGet(thumbnailDataCache, cacheKey);
  if (cached !== undefined) {
    return cached;
  }

  if (inFlightPromises.has(pageItem.id)) {
    return inFlightPromises.get(pageItem.id)!;
  }

  const renderPromise = withThumbnailSlot(async () => {
    try {
      const hit = lruGet(thumbnailDataCache, cacheKey);
      if (hit !== undefined) return hit;

      const docPromise = getPDFDocumentProxy(pageItem.originalFileId!, fileStore);
      if (!docPromise) return '';

      const pdfDoc = await docPromise;
      const url = await renderPageThumbnail(pdfDoc, pageItem.originalPageNumber);
      if (url) {
        lruSet(thumbnailDataCache, cacheKey, url, THUMB_LRU_MAX, true);
      }
      return url;
    } catch (err) {
      console.error(`Error in renderPageThumbnailOnDemand for page ${pageItem.id}:`, err);
      return '';
    } finally {
      inFlightPromises.delete(pageItem.id);
    }
  });

  inFlightPromises.set(pageItem.id, renderPromise);
  return renderPromise;
}

export async function renderPageHighResPreview(
  pageItem: PDFPageItem,
  fileStore: FileStore
): Promise<string> {
  if (pageItem.isBlank) return '';
  if (pageItem.isImage) {
    if (!pageItem.originalFileId || !fileStore[pageItem.originalFileId]) {
      return pageItem.thumbnailUrl || '';
    }
    const buffer = fileStore[pageItem.originalFileId];
    const blob = new Blob([buffer.slice(0)], { type: pageItem.mimeType || 'image/png' });
    return trackObjectUrl(URL.createObjectURL(blob));
  }
  if (!pageItem.originalFileId) return '';

  const cacheKey = `highres-${pageItem.originalFileId}-${pageItem.originalPageNumber}`;
  const cached = lruGet(highResCache, cacheKey);
  if (cached !== undefined) {
    return cached;
  }

  try {
    await getPdfjs();
    const docPromise = getPDFDocumentProxy(pageItem.originalFileId, fileStore);
    if (!docPromise) return pageItem.thumbnailUrl || '';

    const pdfDoc = await docPromise;
    const pageNumber = pageItem.originalPageNumber;
    if (pageNumber < 1 || pageNumber > pdfDoc.numPages) {
      console.warn(
        `Skipping high-res preview for page ${pageNumber}: document has ${pdfDoc.numPages} pages`
      );
      return pageItem.thumbnailUrl || '';
    }

    const page = await pdfDoc.getPage(pageNumber);
    const unscaled = page.getViewport({ scale: 1.0 });
    const scale = Math.min(3.0, Math.max(1.5, 1600 / unscaled.width));
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) return pageItem.thumbnailUrl || '';

    canvas.width = viewport.width;
    canvas.height = viewport.height;

    await page.render({
      canvasContext: context,
      viewport,
      canvas,
    }).promise;

    const blobUrl = await canvasToBlobUrl(canvas, 0.92);
    page.cleanup();

    lruSet(highResCache, cacheKey, blobUrl, HIGHRES_LRU_MAX, false);
    return blobUrl;
  } catch (err) {
    console.error(`Failed high res preview for page ${pageItem.id}:`, err);
    return pageItem.thumbnailUrl || '';
  }
}

export async function renderThumbnailsForPages(
  newPages: PDFPageItem[],
  fileStore: FileStore,
  onThumbnailReady: (pageId: string, url: string) => void
): Promise<void> {
  const pagesByFile: { [fileId: string]: PDFPageItem[] } = {};
  for (const page of newPages) {
    if (page.isBlank || page.isImage || !page.originalFileId) continue;
    if (!pagesByFile[page.originalFileId]) {
      pagesByFile[page.originalFileId] = [];
    }
    pagesByFile[page.originalFileId].push(page);
  }

  for (const [fileId, pagesList] of Object.entries(pagesByFile)) {
    const buffer = fileStore[fileId];
    if (!buffer || buffer.byteLength === 0) continue;

    try {
      const docPromise = getPDFDocumentProxy(fileId, fileStore);
      if (!docPromise) continue;
      const pdfDoc = await docPromise;

      await Promise.all(
        pagesList.map((pageItem) =>
          withThumbnailSlot(async () => {
            try {
              const cacheKey = `${fileId}-${pageItem.originalPageNumber}`;
              const cached = lruGet(thumbnailDataCache, cacheKey);
              if (cached !== undefined) {
                onThumbnailReady(pageItem.id, cached);
                return;
              }
              const url = await renderPageThumbnail(pdfDoc, pageItem.originalPageNumber);
              if (url) {
                lruSet(thumbnailDataCache, cacheKey, url, THUMB_LRU_MAX, true);
              }
              onThumbnailReady(pageItem.id, url);
            } catch (err) {
              console.error(`Failed thumbnail for page ${pageItem.originalPageNumber}:`, err);
              onThumbnailReady(pageItem.id, '');
            }
          })
        )
      );
    } catch (err) {
      console.error(`Failed to load PDF document for thumbnails (fileId: ${fileId}):`, err);
    }
  }
}

export async function mergePDFPages(
  pages: PDFPageItem[],
  fileStore: FileStore,
  onProgress?: (current: number, total: number) => void
): Promise<Uint8Array> {
  const mergedPdf = await PDFDocument.create();
  const loadedDocs: { [fileId: string]: PDFDocument } = {};

  for (let i = 0; i < pages.length; i++) {
    const pageItem = pages[i];
    onProgress?.(i, pages.length);
    if (pageItem.isBlank) {
      mergedPdf.addPage([595.28, 841.89]);
      continue;
    }

    if (!pageItem.originalFileId) continue;

    if (pageItem.isImage) {
      const rawBuffer = fileStore[pageItem.originalFileId];
      if (!rawBuffer || rawBuffer.byteLength === 0) {
        throw new Error(`File binary missing or detached for image ID: ${pageItem.originalFileId}`);
      }
      const fileBuffer = rawBuffer.slice(0);

      let embeddedImage;
      const type = (pageItem.mimeType || '').toLowerCase();

      try {
        if (type.includes('png')) {
          embeddedImage = await mergedPdf.embedPng(fileBuffer.slice(0));
        } else if (type.includes('jpg') || type.includes('jpeg')) {
          embeddedImage = await mergedPdf.embedJpg(fileBuffer.slice(0));
        } else {
          const pngBuffer = await convertImageToPngBuffer(fileBuffer, pageItem.mimeType);
          embeddedImage = await mergedPdf.embedPng(pngBuffer);
        }
      } catch (err) {
        console.warn(
          `Direct embed failed for image "${pageItem.originalFileName}". Falling back to canvas re-encoding:`,
          err
        );
        const pngBuffer = await convertImageToPngBuffer(fileBuffer, pageItem.mimeType);
        embeddedImage = await mergedPdf.embedPng(pngBuffer);
      }

      const imgWidth = embeddedImage.width;
      const imgHeight = embeddedImage.height;

      const imagePage = mergedPdf.addPage([imgWidth, imgHeight]);
      imagePage.drawImage(embeddedImage, {
        x: 0,
        y: 0,
        width: imgWidth,
        height: imgHeight,
      });

      if (pageItem.rotation !== 0) {
        imagePage.setRotation(degrees((pageItem.rotation + 360) % 360));
      }

      continue;
    }

    if (!loadedDocs[pageItem.originalFileId]) {
      const rawBuffer = fileStore[pageItem.originalFileId];
      if (!rawBuffer || rawBuffer.byteLength === 0) {
        throw new Error(`File binary missing or detached for ID: ${pageItem.originalFileId}`);
      }
      loadedDocs[pageItem.originalFileId] = await PDFDocument.load(rawBuffer.slice(0));
    }

    const srcDoc = loadedDocs[pageItem.originalFileId];
    const [copiedPage] = await mergedPdf.copyPages(srcDoc, [pageItem.originalPageNumber - 1]);

    const currentRot = copiedPage.getRotation().angle || 0;
    const finalRotation = (currentRot + pageItem.rotation) % 360;
    copiedPage.setRotation(degrees(finalRotation));

    mergedPdf.addPage(copiedPage);
  }

  onProgress?.(pages.length, pages.length);

  const actualPageCount = mergedPdf.getPageCount();
  if (actualPageCount !== pages.length) {
    throw new Error(
      `PDF assembly validation error: Expected ${pages.length} pages, but created ${actualPageCount} pages.`
    );
  }

  return await mergedPdf.save();
}
