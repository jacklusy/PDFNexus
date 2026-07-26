import type { Metadata } from 'next';
import { SiteHeader, SiteFooter } from '@/components/SiteChrome';
import { FeedbackForm } from '@/features/feedback';
import { JsonLd } from '@/components/JsonLd';
import { getAppUrl, pageMetadata } from '@/lib/seo';

export const metadata: Metadata = pageMetadata({
  title: 'Feedback',
  description: 'Send feedback to the PDFNexus team.',
  path: '/feedback',
});

export default function FeedbackPage() {
  return (
    <div className="min-h-screen atmosphere-light">
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Home', item: getAppUrl() },
            {
              '@type': 'ListItem',
              position: 2,
              name: 'Feedback',
              item: `${getAppUrl()}/feedback`,
            },
          ],
        }}
      />
      <SiteHeader />
      <main className="px-6 py-12 md:px-10">
        <div className="mx-auto mb-8 max-w-lg text-center">
          <h1 className="font-display text-4xl text-[var(--color-ink)]">
            Feedback
          </h1>
          <p className="mt-2 text-sm text-[var(--color-muted)]">
            Tell us what works, what breaks, and what you want next.
          </p>
        </div>
        <FeedbackForm />
      </main>
      <SiteFooter />
    </div>
  );
}
