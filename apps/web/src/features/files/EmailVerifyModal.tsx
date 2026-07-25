'use client';

import React, { useState } from 'react';
import { Loader2, Mail, ShieldCheck } from 'lucide-react';
import { Dialog } from '@/shared/ui/Dialog';
import { requestOtp, verifyOtp } from './api';
import { trackEvent } from '@/lib/analytics';
import { ApiError } from '@/lib/api';

export interface EmailVerifyModalProps {
  open: boolean;
  onClose: () => void;
  onVerified: (email: string) => void;
}

export function EmailVerifyModal({ open, onClose, onVerified }: EmailVerifyModalProps) {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setEmail('');
    setCode('');
    setStep('email');
    setBusy(false);
    setError(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    trackEvent('verify_start');
    try {
      await requestOtp(email.trim().toLowerCase());
      setStep('code');
    } catch (err) {
      const msg =
        err instanceof ApiError ? err.message : 'Could not send verification code. Try again.';
      setError(msg);
    } finally {
      setBusy(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await verifyOtp(email.trim().toLowerCase(), code.trim());
      trackEvent('verify_success');
      onVerified(result.email || email.trim().toLowerCase());
      reset();
    } catch (err) {
      const msg =
        err instanceof ApiError ? err.message : 'Invalid or expired code. Request a new one.';
      setError(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      title="Verify your email to download"
      description="We email your final file and unlock the download link. Source PDFs stay on your device."
      size="sm"
    >
      <div className="mb-4 flex items-center gap-2 rounded-xl border border-teal-200 bg-teal-50 px-3 py-2 text-[11px] font-medium text-teal-900">
        <ShieldCheck className="h-4 w-4 shrink-0 text-teal-700" />
        One-time code · no password · cookie lasts up to 60 days
      </div>

      {step === 'email' ? (
        <form onSubmit={handleRequest} className="space-y-3">
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
            Send verification code
          </button>
        </form>
      ) : (
        <form onSubmit={handleVerify} className="space-y-3">
          <p className="text-xs text-[color:var(--color-muted)]">
            Enter the 6-digit code sent to <strong className="text-[color:var(--color-ink)]">{email}</strong>
          </p>
          <label className="block text-xs font-semibold text-[color:var(--color-ink)]">
            Verification code
            <input
              type="text"
              inputMode="numeric"
              pattern="\d{6}"
              maxLength={6}
              required
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              className="mt-1.5 w-full rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] px-3 py-2.5 text-center font-mono text-lg tracking-[0.35em] text-[color:var(--color-ink)] outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
              placeholder="······"
              autoFocus
            />
          </label>
          {error && <p className="text-xs font-medium text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={busy || code.length !== 6}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-teal-700 px-4 py-2.5 text-xs font-bold text-white hover:bg-teal-800 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
            Verify & continue
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setStep('email');
              setCode('');
              setError(null);
            }}
            className="w-full text-center text-[11px] font-semibold text-teal-800 hover:underline"
          >
            Use a different email
          </button>
        </form>
      )}
    </Dialog>
  );
}
