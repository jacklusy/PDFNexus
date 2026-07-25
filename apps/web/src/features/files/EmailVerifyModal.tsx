'use client';

import React, { useState } from 'react';
import { CheckCircle2, Loader2, Mail, ShieldCheck } from 'lucide-react';
import { Dialog } from '@/shared/ui/Dialog';
import { trackEvent } from '@/lib/analytics';
import { ApiError } from '@/lib/api';

export interface EmailVerifyModalProps {
  open: boolean;
  onClose: () => void;
  /** Called with the email when the user submits — parent uploads & sends download email */
  onSubmitEmail: (email: string) => Promise<void>;
}

export function EmailVerifyModal({
  open,
  onClose,
  onSubmitEmail,
}: EmailVerifyModalProps) {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const reset = () => {
    setEmail('');
    setBusy(false);
    setError(null);
    setSent(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    trackEvent('verify_start');
    try {
      await onSubmitEmail(email.trim().toLowerCase());
      trackEvent('verify_success');
      setSent(true);
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : 'Could not send your download email. Please try again.';
      setError(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      title={sent ? 'Check your inbox' : 'Free download — verify your email'}
      description={
        sent
          ? 'We sent a professional download link to your email. Click the button in the message to get your file.'
          : 'Downloads are free. Enter your email once to unlock this file and all future downloads on this device.'
      }
      size="sm"
    >
      {!sent && (
        <div className="mb-4 space-y-2">
          <div className="flex items-start gap-2 rounded-xl border border-teal-200 bg-teal-50 px-3 py-2.5 text-[11px] font-medium text-teal-900">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-teal-700" />
            <span>
              <strong>100% free.</strong> No password, no credit card. We email you a secure
              download button — after that, downloads start instantly (cookie lasts up to 60 days).
            </span>
          </div>
        </div>
      )}

      {sent ? (
        <div className="space-y-4">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-emerald-100 bg-emerald-50 text-emerald-600">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <p className="text-center text-xs leading-relaxed text-[color:var(--color-muted)]">
            Sent to{' '}
            <strong className="text-[color:var(--color-ink)]">{email}</strong>. Open the email
            from <strong className="text-[color:var(--color-ink)]">PDFNexus</strong> and click{' '}
            <strong className="text-teal-800">Download your file</strong>.
          </p>
          <p className="text-center text-[10px] text-[color:var(--color-muted)]">
            Don&apos;t see it? Check spam or promotions. The link expires in 24 hours.
          </p>
          <button
            type="button"
            onClick={handleClose}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-teal-700 px-4 py-2.5 text-xs font-bold text-white hover:bg-teal-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
          >
            Got it
          </button>
        </div>
      ) : (
        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-3">
          <label className="block text-xs font-semibold text-[color:var(--color-ink)]">
            Email address
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] px-3 py-2.5 text-sm text-[color:var(--color-ink)] outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
              placeholder="you@example.com"
            />
          </label>
          {error && <p className="text-xs font-medium text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={busy || !email}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-teal-700 px-4 py-2.5 text-xs font-bold text-white hover:bg-teal-800 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
            Email me the download link
          </button>
        </form>
      )}
    </Dialog>
  );
}
