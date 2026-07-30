'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { CloudUpload, Link2 } from 'lucide-react';
import { Button } from '@/shared/ui/Button';
import { ApiError, apiFetch } from '@/lib/api';
import { canUseDriveExport, CONSENT_LABEL } from './driveConsent';

export interface DriveExportButtonProps {
  file: File | Blob | null;
  fileName?: string;
  disabled?: boolean;
  className?: string;
}

/**
 * Compact “export to Google Drive” control for use after a local download.
 * Offers OAuth connect when no Drive session exists yet.
 */
export function DriveExportButton({
  file,
  fileName = 'document.pdf',
  disabled = false,
  className,
}: DriveExportButtonProps) {
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [connected, setConnected] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refreshStatus = useCallback(async () => {
    try {
      const status = await apiFetch<{ connected: boolean }>(
        '/api/cloud/drive/status'
      );
      setConnected(Boolean(status.connected));
    } catch {
      setConnected(false);
    }
  }, []);

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

  const connect = async () => {
    setBusy(true);
    setError(null);
    try {
      const { url } = await apiFetch<{ url: string }>(
        '/api/cloud/drive/auth-url'
      );
      window.location.href = url;
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
      setBusy(false);
    }
  };

  const run = async () => {
    if (!file || !canUseDriveExport(consent)) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const form = new FormData();
      const upload =
        file instanceof File
          ? file
          : new File([file], fileName, {
              type: file.type || 'application/pdf',
            });
      form.append('file', upload, upload.name);
      const result = await apiFetch<{
        id: string;
        name: string;
        webViewLink: string;
      }>('/api/cloud/drive/export', {
        method: 'POST',
        body: form,
      });
      setConnected(true);
      setMessage(
        result.webViewLink
          ? `Saved to Drive: ${result.name}`
          : `Saved to Drive (${result.id})`
      );
    } catch (e) {
      if (e instanceof ApiError) {
        setError(
          e.status === 401
            ? 'Connect Google Drive first, then try again.'
            : e.message
        );
        if (e.status === 401) setConnected(false);
      } else {
        setError(e instanceof Error ? e.message : String(e));
      }
    } finally {
      setBusy(false);
    }
  };

  if (!file) return null;

  return (
    <div className={className ?? 'space-y-2'}>
      {!connected ? (
        <Button
          variant="outline"
          size="sm"
          disabled={disabled || busy}
          loading={busy}
          onClick={() => void connect()}
        >
          <Link2 className="h-4 w-4" aria-hidden />
          Connect Google Drive
        </Button>
      ) : (
        <>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-1"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              disabled={busy || disabled}
            />
            <span>{CONSENT_LABEL}</span>
          </label>
          <Button
            variant="outline"
            size="sm"
            disabled={disabled || busy || !canUseDriveExport(consent)}
            loading={busy}
            onClick={() => void run()}
          >
            <CloudUpload className="h-4 w-4" aria-hidden />
            Save to Google Drive
          </Button>
        </>
      )}
      {message ? (
        <p className="text-sm text-[var(--color-muted)]">{message}</p>
      ) : null}
      {error ? (
        <p className="text-sm text-[var(--color-danger)]" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
