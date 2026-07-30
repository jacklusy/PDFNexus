import type { Metadata } from 'next';
import Link from 'next/link';
import { ContentPage } from '@/components/ContentPage';
import { JsonLd } from '@/components/JsonLd';
import { getAppUrl, pageMetadata } from '@/lib/seo';

export const metadata: Metadata = pageMetadata({
  title: 'About',
  description:
    'About PDFNexus — local PDF merge and organize with verified delivery.',
  path: '/about',
});

export default function AboutPage() {
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
              name: 'About',
              item: `${getAppUrl()}/about`,
            },
          ],
        }}
      />
      <ContentPage
        title="About PDFNexus"
        description="A privacy-minded toolkit for assembling PDFs locally."
        toc={[
          { id: 'purpose', label: 'Purpose' },
          { id: 'problem', label: 'The problem' },
          { id: 'vision', label: 'Vision' },
          { id: 'principles', label: 'Principles' },
        ]}
      >
        <section id="purpose">
          <h2 className="font-display text-xl text-[var(--color-ink)]">Purpose</h2>
          <p>
            PDFNexus helps you merge, reorder, rotate, duplicate, insert blanks
            and images, preview, and convert to Word entirely in your browser.
          </p>
        </section>
        <section id="problem" className="pt-4">
          <h2 className="font-display text-xl text-[var(--color-ink)]">
            The problem
          </h2>
          <p>
            Most online PDF tools upload every source page before you can edit.
            That is inconvenient for confidential packets and unnecessary for
            basic assembly work.
          </p>
        </section>
        <section id="vision" className="pt-4">
          <h2 className="font-display text-xl text-[var(--color-ink)]">Vision</h2>
          <p>
            Keep drafting local. Finished PDFs from local tools download
            immediately — no account required. Email verification is optional if
            you want temporary cloud storage or a branded download link.
          </p>
        </section>
        <section id="principles" className="pt-4">
          <h2 className="font-display text-xl text-[var(--color-ink)]">
            Principles
          </h2>
          <ul className="list-disc space-y-2 pl-5">
            <li>Source files stay on-device during editing.</li>
            <li>Optional OCR is explicit and limited to page images.</li>
            <li>Analytics avoid filenames and document contents.</li>
            <li>Verification is for delivery — not a password account.</li>
          </ul>
        </section>
        <div className="pt-8">
          <Link
            href="/workspace"
            className="inline-flex rounded-xl bg-[var(--color-accent)] px-5 py-2.5 text-sm font-bold text-white"
          >
            Try the workspace
          </Link>
        </div>
      </ContentPage>
    </>
  );
}
