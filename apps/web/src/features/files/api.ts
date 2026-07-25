'use client';

import { apiFetch, apiPostJson } from '@/lib/api';
import type { FileKind } from '@pdfnexus/shared';

export interface AuthMeResponse {
  verified: boolean;
  authenticated?: boolean;
  email?: string | null;
}

export interface UploadFinalResponse {
  id: string;
  downloadUrl: string;
  emailQueued?: boolean;
  originalName?: string;
  kind?: FileKind;
}

export async function getAuthMe(): Promise<AuthMeResponse> {
  try {
    const me = await apiFetch<AuthMeResponse & { authenticated?: boolean }>(
      '/api/auth/me'
    );
    return {
      verified: Boolean(me.verified ?? me.authenticated),
      authenticated: Boolean(me.authenticated ?? me.verified),
      email: me.email,
    };
  } catch (err: unknown) {
    const status = (err as { status?: number })?.status;
    if (status === 401 || status === 403) {
      return { verified: false, email: null };
    }
    throw err;
  }
}

export async function requestOtp(email: string): Promise<void> {
  await apiPostJson('/api/auth/request-otp', { email });
}

export async function verifyOtp(email: string, code: string): Promise<AuthMeResponse> {
  return apiPostJson<AuthMeResponse>('/api/auth/verify', { email, code });
}

export async function uploadFinalFile(
  blob: Blob,
  options: {
    fileName: string;
    kind: FileKind;
  }
): Promise<UploadFinalResponse> {
  const form = new FormData();
  form.append('file', blob, options.fileName);
  form.append('kind', options.kind);
  form.append('originalName', options.fileName);

  return apiFetch<UploadFinalResponse>('/api/files', {
    method: 'POST',
    body: form,
  });
}

/** First-time download: upload + branded email with claim/download button (no cookie yet). */
export async function uploadAndEmailDownload(
  blob: Blob,
  options: {
    email: string;
    fileName: string;
    kind: FileKind;
  }
): Promise<UploadFinalResponse> {
  const form = new FormData();
  form.append('file', blob, options.fileName);
  form.append('kind', options.kind);
  form.append('originalName', options.fileName);
  form.append('email', options.email);

  return apiFetch<UploadFinalResponse>('/api/files/email-delivery', {
    method: 'POST',
    body: form,
  });
}

export function triggerBrowserDownload(url: string, fileName: string): void {
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
