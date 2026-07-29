import type { Metadata } from 'next';
import { ContentPage, ReviewRequired } from '@/components/ContentPage';
import { JsonLd } from '@/components/JsonLd';
import { getAppUrl, pageMetadata } from '@/lib/seo';

export const metadata: Metadata = pageMetadata({
  title: 'Privacy',
  description:
    'PDFNexus privacy practices for local processing, OCR, and verified downloads.',
  path: '/privacy',
});

export default function PrivacyPage() {
  return (
    <>
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Home', item: getAppUrl() },
            {
              '@type': 'ListItem',
              position: 2,
              name: 'Privacy',
              item: `${getAppUrl()}/privacy`,
            },
          ],
        }}
      />
      <ContentPage
        title="Privacy"
        description="Effective date: 2026-01-01 · Last updated: 2026-07-26"
        toc={[
          { id: 'local', label: 'Local processing' },
          { id: 'ocr', label: 'OCR' },
          { id: 'verified', label: 'Verified final files' },
          { id: 'cookies', label: 'Cookies' },
          { id: 'analytics', label: 'Analytics' },
          { id: 'retention', label: 'Retention' },
          { id: 'contact', label: 'Contact' },
        ]}
      >
        <section id="local">
          <h2 className="font-display text-xl text-[var(--color-ink)]">
            Local processing
          </h2>
          <p>
            Merge, organize, preview, and Word conversion run in your browser.
            Source PDF and image binaries are held in memory and are not uploaded
            during editing.
          </p>
        </section>
        <section id="ocr" className="pt-4">
          <h2 className="font-display text-xl text-[var(--color-ink)]">OCR</h2>
          <p>
            For scanned or sparse pages, conversion may send a rendered page
            image to{' '}
            <code className="rounded bg-[var(--color-surface-2)] px-1">
              /api/pdf-to-docx/analyze-ocr
            </code>{' '}
            for layout analysis. Payloads are not written to analytics logs.
          </p>
        </section>
        <section id="verified" className="pt-4">
          <h2 className="font-display text-xl text-[var(--color-ink)]">
            Verified final files
          </h2>
          <p>
            Local tool outputs download immediately from your browser and are not
            uploaded unless you choose optional email delivery. If you opt in,
            after email OTP verification the final PDF or DOCX may be stored
            temporarily for download and email delivery, then expire per retention
            policy.
          </p>
        </section>
        <section id="cookies" className="pt-4">
          <h2 className="font-display text-xl text-[var(--color-ink)]">Cookies</h2>
          <p>
            A signed HttpOnly cookie records that your email is verified. There
            are no passwords or traditional accounts for product users.
          </p>
        </section>
        <section id="analytics" className="pt-4">
          <h2 className="font-display text-xl text-[var(--color-ink)]">
            Analytics
          </h2>
          <p>
            We collect privacy-safe events (pageviews, feature use,
            verify/download) without filenames or document content.
          </p>
        </section>
        <section id="retention" className="pt-4">
          <h2 className="font-display text-xl text-[var(--color-ink)]">
            Retention
          </h2>
          <p>
            <ReviewRequired>
              exact retention windows for stored finals, logs, and analytics
            </ReviewRequired>
          </p>
        </section>
        <section id="contact" className="pt-4">
          <h2 className="font-display text-xl text-[var(--color-ink)]">Contact</h2>
          <p>
            Operator identity:{' '}
            <ReviewRequired>legal entity name</ReviewRequired>
          </p>
          <p>
            Privacy contact:{' '}
            <ReviewRequired>privacy@example.com / postal address</ReviewRequired>
          </p>
        </section>
      </ContentPage>
    </>
  );
}
