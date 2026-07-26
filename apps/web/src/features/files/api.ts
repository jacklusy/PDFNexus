'use client';

import { apiFetch, apiPostJson } from '@/lib/api';
import type { FileKind } from '@pdfnexus/shared';

export interface AuthMeResponse {
  verified: boolean;
  authenticated?: boolean;
  email?: string | null;
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

/** MIME type sent to the upload API so the server can classify the file. */
export function mimeTypeForKind(kind: FileKind): string {
  return kind === 'docx'
    ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    : 'application/pdf';
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
