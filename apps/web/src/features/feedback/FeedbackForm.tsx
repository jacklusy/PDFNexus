'use client';

import React, { useState } from 'react';
import { Loader2, MessageSquareHeart, Send } from 'lucide-react';
import { apiPostJson, ApiError } from '@/lib/api';
import { useToast } from '@/shared/ui';
import type { FeedbackInput } from '@pdfnexus/shared';

export function FeedbackForm() {
  const toast = useToast();
  const [type, setType] = useState<FeedbackInput['type']>('comment');
  const [rating, setRating] = useState(5);
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const body: FeedbackInput = {
        type,
        message: message.trim(),
        email: email.trim() ? email.trim().toLowerCase() : null,
        ...(type === 'rating' ? { rating } : {}),
      };
      await apiPostJson('/api/feedback', body);
      toast.success('Thanks for the feedback');
      setMessage('');
      setEmail('');
    } catch (err) {
      toast.error(
        'Could not send feedback',
        err instanceof ApiError ? err.message : 'Please try again later.'
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      onSubmit={onSubmit}
      className="mx-auto w-full max-w-lg space-y-4 rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-6 shadow-sm"
    >
      <div className="flex items-center gap-2 text-[color:var(--color-ink)]">
        <MessageSquareHeart className="h-5 w-5 text-teal-700" />
        <h2 className="font-display text-xl">Share feedback</h2>
      </div>

      <label className="block text-xs font-semibold text-[color:var(--color-ink)]">
        Type
        <select
          value={type}
          onChange={(e) => setType(e.target.value as FeedbackInput['type'])}
          className="mt-1.5 w-full rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] px-3 py-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
        >
          <option value="comment">Comment</option>
          <option value="rating">Rating</option>
          <option value="bug">Bug report</option>
          <option value="feature">Feature request</option>
        </select>
      </label>

      {type === 'rating' && (
        <label className="block text-xs font-semibold">
          Rating (1–5)
          <input
            type="number"
            min={1}
            max={5}
            value={rating}
            onChange={(e) => setRating(Number(e.target.value))}
            className="mt-1.5 w-full rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] px-3 py-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
          />
        </label>
      )}

      <label className="block text-xs font-semibold">
        Message
        <textarea
          required
          rows={5}
          maxLength={5000}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="mt-1.5 w-full rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] px-3 py-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
          placeholder="What should we improve?"
        />
      </label>

      <label className="block text-xs font-semibold">
        Email (optional)
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1.5 w-full rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] px-3 py-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
          placeholder="you@example.com"
        />
      </label>

      <button
        type="submit"
        disabled={busy || !message.trim()}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-teal-700 px-4 py-2.5 text-xs font-bold text-white hover:bg-teal-800 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        Send feedback
      </button>
    </form>
  );
}
