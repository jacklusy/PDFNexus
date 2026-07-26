import type { Metadata } from 'next';
import { ContentPage, ReviewRequired } from '@/components/ContentPage';
import { JsonLd } from '@/components/JsonLd';
import { getAppUrl, pageMetadata } from '@/lib/seo';

export const metadata: Metadata = pageMetadata({
  title: 'Terms',
  description: 'Terms of use for PDFNexus.',
  path: '/terms',
});

export default function TermsPage() {
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
              name: 'Terms',
              item: `${getAppUrl()}/terms`,
            },
          ],
        }}
      />
      <ContentPage
        title="Terms of use"
        description="Effective date: 2026-01-01 · Last updated: 2026-07-26"
        toc={[
          { id: 'acceptance', label: 'Acceptance' },
          { id: 'use', label: 'Acceptable use' },
          { id: 'storage', label: 'Temporary storage' },
          { id: 'liability', label: 'Liability' },
          { id: 'law', label: 'Governing law' },
        ]}
      >
        <section id="acceptance">
          <h2 className="font-display text-xl text-[var(--color-ink)]">
            Acceptance
          </h2>
          <p>
            PDFNexus is provided as-is for merging and organizing documents. You
            are responsible for ensuring you have rights to process any files you
            upload or convert.
          </p>
        </section>
        <section id="use" className="pt-4">
          <h2 className="font-display text-xl text-[var(--color-ink)]">
            Acceptable use
          </h2>
          <p>
            Do not use the service to process illegal content or to abuse
            verification, OCR, or upload endpoints. We may rate-limit or block
            abusive traffic.
          </p>
        </section>
        <section id="storage" className="pt-4">
          <h2 className="font-display text-xl text-[var(--color-ink)]">
            Temporary storage
          </h2>
          <p>
            Final file storage is temporary. Keep your own copies of important
            documents. Features may change as the product evolves.
          </p>
        </section>
        <section id="liability" className="pt-4">
          <h2 className="font-display text-xl text-[var(--color-ink)]">
            Liability
          </h2>
          <p>
            <ReviewRequired>
              limitation of liability and warranty disclaimer language
            </ReviewRequired>
          </p>
        </section>
        <section id="law" className="pt-4">
          <h2 className="font-display text-xl text-[var(--color-ink)]">
            Governing law
          </h2>
          <p>
            <ReviewRequired>governing law and venue</ReviewRequired>
          </p>
          <p>
            Operator:{' '}
            <ReviewRequired>legal entity name and contact address</ReviewRequired>
          </p>
        </section>
      </ContentPage>
    </>
  );
}
