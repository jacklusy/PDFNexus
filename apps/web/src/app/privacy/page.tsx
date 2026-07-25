import type { Metadata } from 'next';
import { ContentPage } from '@/components/ContentPage';

export const metadata: Metadata = {
  title: 'Privacy',
  description: 'PDFNexus privacy practices for local processing, OCR, and verified downloads.',
};

export default function PrivacyPage() {
  return (
    <ContentPage title="Privacy">
      <h2 className="font-display text-xl text-[color:var(--color-ink)]">Local processing</h2>
      <p>
        Merge, organize, preview, and Word conversion run in your browser. Source PDF and image
        binaries are held in memory (FileStore) and are not uploaded during editing.
      </p>
      <h2 className="mt-6 font-display text-xl text-[color:var(--color-ink)]">OCR</h2>
      <p>
        For scanned or sparse pages, conversion may send a rendered page image to{' '}
        <code className="rounded bg-[color:var(--color-surface-2)] px-1">
          /api/pdf-to-docx/analyze-ocr
        </code>{' '}
        for layout analysis. Payloads are not written to analytics logs.
      </p>
      <h2 className="mt-6 font-display text-xl text-[color:var(--color-ink)]">
        Verified final files
      </h2>
      <p>
        After email OTP verification, the final PDF or DOCX you generate may be stored temporarily
        for download and email delivery, then expire per retention policy.
      </p>
      <h2 className="mt-6 font-display text-xl text-[color:var(--color-ink)]">Cookies</h2>
      <p>
        A signed HttpOnly cookie records that your email is verified. There are no passwords or
        traditional accounts.
      </p>
      <h2 className="mt-6 font-display text-xl text-[color:var(--color-ink)]">Analytics</h2>
      <p>
        We collect privacy-safe events (pageviews, feature use, verify/download) without filenames
        or document content.
      </p>
    </ContentPage>
  );
}
