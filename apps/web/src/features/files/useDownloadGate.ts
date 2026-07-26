'use client';

import { useCallback, useRef, useState } from 'react';
import type { CompleteUploadResponse, FileKind } from '@pdfnexus/shared';
import { trackEvent } from '@/lib/analytics';
import { revokeObjectUrl, trackObjectUrl } from '@/lib/pdf/pdfHelpers';
import {
  getAuthMe,
  mimeTypeForKind,
  resolveDownloadTarget,
  triggerBrowserDownload,
} from './api';
import {
  uploadFileDirect,
  UploadCancelledError,
  type DirectUploadHandle,
  type UploadProgress,
} from './multipartUpload';

export interface GatedDownloadResult {
  localBlobUrl: string;
  downloadUrl: string;
  fileName: string;
  size: number;
  pageCount?: number;
  emailQueued: boolean;
  kind: FileKind;
  /** True when user must open the email link (first-time verify) */
  awaitingEmailLink?: boolean;
}

export interface UseDownloadGateOptions {
  onNeedVerify: () => void;
  onError?: (message: string) => void;
  /** Streamed real upload progress (initiating → uploading → finalizing). */
  onUploadProgress?: (progress: UploadProgress) => void;
}

type PendingUpload = {
  blob: Blob;
  fileName: string;
  kind: FileKind;
  pageCount?: number;
  resolve: (result: GatedDownloadResult) => void;
  reject: (err: Error) => void;
};

/**
 * Download gate:
 * 1. Client creates final blob
 * 2. If not verified → EmailVerifyModal (email only) → branded download email
 * 3. If verified → direct-to-storage multipart upload → immediate download
 */
export function useDownloadGate({
  onNeedVerify,
  onError,
  onUploadProgress,
}: UseDownloadGateOptions) {
  const pendingRef = useRef<PendingUpload | null>(null);
  const uploadHandleRef = useRef<DirectUploadHandle | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);
  const [result, setResult] = useState<GatedDownloadResult | null>(null);

  const clearResult = useCallback(() => {
    setResult((prev) => {
      if (prev?.localBlobUrl) revokeObjectUrl(prev.localBlobUrl);
      return null;
    });
  }, []);

  const runDirectUpload = useCallback(
    async (
      blob: Blob,
      fileName: string,
      kind: FileKind,
      email?: string
    ): Promise<CompleteUploadResponse> => {
      setIsUploading(true);
      setUploadProgress(null);
      const handle = uploadFileDirect(blob, {
        fileName,
        mimeType: mimeTypeForKind(kind),
        ...(email ? { email, sendEmail: true } : {}),
        onProgress: (p) => {
          setUploadProgress(p);
          onUploadProgress?.(p);
        },
      });
      uploadHandleRef.current = handle;
      try {
        return await handle.promise;
      } finally {
        uploadHandleRef.current = null;
        setIsUploading(false);
        setUploadProgress(null);
      }
    },
    [onUploadProgress]
  );

  const uploadAndFinish = useCallback(
    async (
      blob: Blob,
      fileName: string,
      kind: FileKind,
      pageCount?: number
    ): Promise<GatedDownloadResult> => {
      const uploaded = await runDirectUpload(blob, fileName, kind);
      const localBlobUrl = trackObjectUrl(URL.createObjectURL(blob));
      const gated: GatedDownloadResult = {
        localBlobUrl,
        downloadUrl: uploaded.downloadUrl || '',
        fileName,
        size: blob.size,
        pageCount,
        emailQueued: false,
        kind,
      };
      setResult(gated);
      trackEvent(kind === 'docx' ? 'convert' : 'merge', {
        tool: kind === 'docx' ? 'pdf-to-word' : 'merge',
      });
      return gated;
    },
    [runDirectUpload]
  );

  const gateDownload = useCallback(
    (input: {
      blob: Blob;
      fileName: string;
      kind: FileKind;
      pageCount?: number;
    }): Promise<GatedDownloadResult> => {
      return new Promise<GatedDownloadResult>((resolve, reject) => {
        void (async () => {
          try {
            const me = await getAuthMe();
            if (!me.verified) {
              pendingRef.current = { ...input, resolve, reject };
              onNeedVerify();
              return;
            }
            const gated = await uploadAndFinish(
              input.blob,
              input.fileName,
              input.kind,
              input.pageCount
            );
            resolve(gated);
          } catch (err) {
            if (err instanceof UploadCancelledError) {
              reject(err);
              return;
            }
            const message =
              err instanceof Error ? err.message : 'Download gate failed. Please try again.';
            onError?.(message);
            reject(err instanceof Error ? err : new Error(message));
          }
        })();
      });
    },
    [onNeedVerify, onError, uploadAndFinish]
  );

  /** First-time path: upload under email and send branded download-link email. */
  const submitEmailForDownload = useCallback(
    async (email: string) => {
      const pending = pendingRef.current;
      if (!pending) {
        throw new Error('No pending download');
      }

      try {
        await runDirectUpload(pending.blob, pending.fileName, pending.kind, email);
        const localBlobUrl = trackObjectUrl(URL.createObjectURL(pending.blob));
        const gated: GatedDownloadResult = {
          localBlobUrl,
          downloadUrl: '',
          fileName: pending.fileName,
          size: pending.blob.size,
          pageCount: pending.pageCount,
          emailQueued: true,
          awaitingEmailLink: true,
          kind: pending.kind,
        };
        trackEvent(pending.kind === 'docx' ? 'convert' : 'merge', {
          tool: pending.kind === 'docx' ? 'pdf-to-word' : 'merge',
        });
        pending.resolve(gated);
        pendingRef.current = null;
        return gated;
      } catch (err) {
        if (err instanceof UploadCancelledError) {
          pending.reject(err);
          pendingRef.current = null;
          throw err;
        }
        const error = err instanceof Error ? err : new Error('Email delivery failed');
        onError?.(error.message);
        throw error;
      }
    },
    [onError, runDirectUpload]
  );

  const resumeAfterVerify = useCallback(async () => {
    const pending = pendingRef.current;
    if (!pending) return null;
    pendingRef.current = null;
    try {
      const gated = await uploadAndFinish(
        pending.blob,
        pending.fileName,
        pending.kind,
        pending.pageCount
      );
      pending.resolve(gated);
      return gated;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Upload failed');
      pending.reject(error);
      throw error;
    }
  }, [uploadAndFinish]);

  const cancelPending = useCallback(() => {
    const pending = pendingRef.current;
    if (pending) {
      pending.reject(new Error('Verification cancelled'));
      pendingRef.current = null;
    }
  }, []);

  /** Abort the in-flight direct upload (all parts + server session). */
  const cancelUpload = useCallback(() => {
    uploadHandleRef.current?.abort();
  }, []);

  const downloadNow = useCallback(() => {
    if (!result || result.awaitingEmailLink) return;
    // The compiled blob is always in memory here, so it downloads instantly and
    // reliably; the presigned URL is only a fallback if the blob was revoked.
    const url = resolveDownloadTarget(result);
    if (!url) return;
    triggerBrowserDownload(url, result.fileName);
    trackEvent('download', { tool: result.kind });
  }, [result]);

  return {
    gateDownload,
    submitEmailForDownload,
    resumeAfterVerify,
    cancelPending,
    cancelUpload,
    clearResult,
    downloadNow,
    isUploading,
    uploadProgress,
    result,
  };
}
