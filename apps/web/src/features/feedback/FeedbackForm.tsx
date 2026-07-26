'use client';

import React, { useMemo, useState } from 'react';
import { MessageSquareHeart, Send } from 'lucide-react';
import { feedbackSchema, type FeedbackInput } from '@pdfnexus/shared';
import { apiPostJson, ApiError } from '@/lib/api';
import { Button, Input, Select, Textarea, useToast } from '@/shared/ui';

export function FeedbackForm() {
  const toast = useToast();
  const [type, setType] = useState<FeedbackInput['type']>('comment');
  const [subject, setSubject] = useState('');
  const [rating, setRating] = useState(5);
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const remaining = 5000 - message.length;

  const body = useMemo(
    () => ({
      type,
      subject: subject.trim() || undefined,
      message: message.trim(),
      email: email.trim() ? email.trim().toLowerCase() : null,
      ...(type === 'rating' ? { rating } : {}),
    }),
    [type, subject, message, email, rating],
  );

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFieldErrors({});
    const parsed = feedbackSchema.safeParse(body);
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] || 'message');
        if (!errs[key]) errs[key] = issue.message;
      }
      setFieldErrors(errs);
      return;
    }
    setBusy(true);
    try {
      await apiPostJson('/api/feedback', parsed.data);
      toast.success('Thanks for the feedback');
      setSent(true);
      setMessage('');
      setSubject('');
      setEmail('');
    } catch (err) {
      toast.error(
        'Could not send feedback',
        err instanceof ApiError ? err.message : 'Please try again later.',
      );
    } finally {
      setBusy(false);
    }
  };

  if (sent) {
    return (
      <div className="mx-auto w-full max-w-lg rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-8 text-center shadow-sm">
        <MessageSquareHeart className="mx-auto h-8 w-8 text-[var(--color-accent)]" />
        <h2 className="mt-3 font-display text-2xl text-[var(--color-ink)]">
          Message received
        </h2>
        <p className="mt-2 text-sm text-[var(--color-muted)]">
          Thanks for helping improve PDFNexus. We read every submission.
        </p>
        <Button className="mt-6" variant="outline" onClick={() => setSent(false)}>
          Send another
        </Button>
      </div>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="mx-auto w-full max-w-lg space-y-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-sm"
      noValidate
    >
      <div className="flex items-center gap-2 text-[var(--color-ink)]">
        <MessageSquareHeart className="h-5 w-5 text-[var(--color-accent)]" />
        <h2 className="font-display text-xl">Share feedback</h2>
      </div>
      <p className="text-xs text-[var(--color-muted)]">
        We use your message to improve the product. Do not include confidential
        document contents. Contact email is optional.
      </p>

      <Select
        label="Category"
        value={type}
        onChange={(e) => setType(e.target.value as FeedbackInput['type'])}
        options={[
          { value: 'comment', label: 'Comment' },
          { value: 'rating', label: 'Rating' },
          { value: 'bug', label: 'Bug report' },
          { value: 'feature', label: 'Feature request' },
        ]}
        error={fieldErrors.type}
      />

      <Input
        label="Subject"
        value={subject}
        onChange={(e) => setSubject(e.target.value)}
        maxLength={120}
        placeholder="Short summary"
        error={fieldErrors.subject}
      />

      {type === 'rating' ? (
        <Input
          label="Rating (1–5)"
          type="number"
          min={1}
          max={5}
          value={rating}
          onChange={(e) => setRating(Number(e.target.value))}
          error={fieldErrors.rating}
        />
      ) : null}

      <div>
        <Textarea
          label="Message"
          required
          rows={5}
          maxLength={5000}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="What should we improve?"
          error={fieldErrors.message}
        />
        <p className="mt-1 text-right text-[11px] text-[var(--color-muted)]">
          {remaining} characters left
        </p>
      </div>

      <Input
        label="Contact email (optional)"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@example.com"
        error={fieldErrors.email}
        hint="Only used if we need to follow up on your report."
      />

      <Button
        type="submit"
        className="w-full"
        loading={busy}
        disabled={busy || !message.trim()}
      >
        <Send className="h-4 w-4" />
        Send feedback
      </Button>
    </form>
  );
}
