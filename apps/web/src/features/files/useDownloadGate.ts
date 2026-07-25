'use client';

import { useCallback, useRef, useState } from 'react';
import type { FileKind } from '@pdfnexus/shared';
import { trackEvent } from '@/lib/analytics';
import { revokeObjectUrl, trackObjectUrl } from '@/lib/pdf/pdfHelpers';
import {
  getAuthMe,
  triggerBrowserDownload,
  uploadAndEmailDownload,
  uploadFinalFile,
  type UploadFinalResponse,
} from './api';

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
 * 3. If verified → POST /api/files → immediate browser download
 */
export function useDownloadGate({ onNeedVerify, onError }: UseDownloadGateOptions) {
  const pendingRef = useRef<PendingUpload | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [result, setResult] = useState<GatedDownloadResult | null>(null);

  const clearResult = useCallback(() => {
    setResult((prev) => {
      if (prev?.localBlobUrl) revokeObjectUrl(prev.localBlobUrl);
      return null;
    });
  }, []);

  const uploadAndFinish = useCallback(
    async (
      blob: Blob,
      fileName: string,
      kind: FileKind,
      pageCount?: number
    ): Promise<GatedDownloadResult> => {
      setIsUploading(true);
      try {
        const uploaded: UploadFinalResponse = await uploadFinalFile(blob, {
          fileName,
          kind,
        });
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
      } finally {
        setIsUploading(false);
      }
    },
    []
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
  const submitEmailForDownload = useCallback(async (email: string) => {
    const pending = pendingRef.current;
    if (!pending) {
      throw new Error('No pending download');
    }

    setIsUploading(true);
    try {
      await uploadAndEmailDownload(pending.blob, {
        email,
        fileName: pending.fileName,
        kind: pending.kind,
      });
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
      const error = err instanceof Error ? err : new Error('Email delivery failed');
      onError?.(error.message);
      throw error;
    } finally {
      setIsUploading(false);
    }
  }, [onError]);

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

  const downloadNow = useCallback(() => {
    if (!result || result.awaitingEmailLink) return;
    triggerBrowserDownload(result.downloadUrl || result.localBlobUrl, result.fileName);
    trackEvent('download', { tool: result.kind });
  }, [result]);

  return {
    gateDownload,
    submitEmailForDownload,
    resumeAfterVerify,
    cancelPending,
    clearResult,
    downloadNow,
    isUploading,
    result,
  };
}
