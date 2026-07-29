import type { Metadata } from 'next';
import Link from 'next/link';
import { ContentPage } from '@/components/ContentPage';
import { WorkflowIllustration } from '@/components/Illustrations';
import { JsonLd } from '@/components/JsonLd';
import { pageMetadata, getAppUrl } from '@/lib/seo';

export const metadata: Metadata = pageMetadata({
  title: 'Guide',
  description:
    'Step-by-step guide to merging, organizing, converting, and downloading PDFs with PDFNexus.',
  path: '/guide',
});

const toc = [
  { id: 'getting-started', label: 'Getting started' },
  { id: 'merge', label: 'Merge & organize' },
  { id: 'convert', label: 'Convert to Word' },
  { id: 'download', label: 'Download & optional email' },
  { id: 'troubleshooting', label: 'Troubleshooting' },
  { id: 'faq', label: 'FAQ' },
];

const faqs = [
  {
    q: 'Can I work offline?',
    a: 'Local tools run in your browser after the app loads. Optional OCR and email delivery need network access.',
  },
  {
    q: 'What file types can I add?',
    a: 'PDF documents and common image formats supported by the workspace dropzone.',
  },
];

export default function GuidePage() {
  return (
    <>
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          mainEntity: faqs.map((f) => ({
            '@type': 'Question',
            name: f.q,
            acceptedAnswer: { '@type': 'Answer', text: f.a },
          })),
        }}
      />
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Home', item: getAppUrl() },
            {
              '@type': 'ListItem',
              position: 2,
              name: 'Guide',
              item: `${getAppUrl()}/guide`,
            },
          ],
        }}
      />
      <ContentPage
        title="PDFNexus guide"
        description="Learn how to assemble documents locally, convert when needed, and download finals securely."
        toc={toc}
      >
        <section id="getting-started">
          <h2 className="font-display text-xl text-[var(--color-ink)]">
            Getting started
          </h2>
          <p>
            Open the workspace, drop one or more PDFs or images, and use the
            page grid to arrange your packet. Nothing is uploaded during this
            stage.
          </p>
          <WorkflowIllustration step={1} className="mt-4 h-28 w-40" />
        </section>

        <section id="merge" className="pt-6">
          <h2 className="font-display text-xl text-[var(--color-ink)]">
            Merge & organize
          </h2>
          <ol className="list-decimal space-y-2 pl-5">
            <li>Add files from your device.</li>
            <li>Drag thumbnails to reorder pages.</li>
            <li>Rotate, duplicate, delete, or insert blank pages as needed.</li>
            <li>Preview before generating the final PDF.</li>
          </ol>
          <WorkflowIllustration step={2} className="mt-4 h-28 w-40" />
        </section>

        <section id="convert" className="pt-6">
          <h2 className="font-display text-xl text-[var(--color-ink)]">
            Convert to Word
          </h2>
          <p>
            Use convert when you need an editable DOCX. Scanned pages can use
            optional OCR, which may send rendered page images to the API for
            layout analysis.
          </p>
        </section>

        <section id="download" className="pt-6">
          <h2 className="font-display text-xl text-[var(--color-ink)]">
            Download & optional email
          </h2>
          <p>
            Browser-processed PDFs and Word files download immediately to your
            device — no account required. If you want temporary cloud storage or
            a branded download email, you can optionally verify your email once.
          </p>
          <WorkflowIllustration step={3} className="mt-4 h-28 w-40" />
        </section>

        <section id="troubleshooting" className="pt-6">
          <h2 className="font-display text-xl text-[var(--color-ink)]">
            Troubleshooting
          </h2>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <strong>Large files feel slow:</strong> close unused tabs and
              process fewer pages at once.
            </li>
            <li>
              <strong>OTP not arriving:</strong> check spam, wait a minute, then
              request a new code.
            </li>
            <li>
              <strong>Download expired:</strong> regenerate the final file and
              verify again.
            </li>
          </ul>
        </section>

        <section id="faq" className="pt-6">
          <h2 className="font-display text-xl text-[var(--color-ink)]">FAQ</h2>
          {faqs.map((f) => (
            <div key={f.q} className="mt-3">
              <p className="font-semibold text-[var(--color-ink)]">{f.q}</p>
              <p>{f.a}</p>
            </div>
          ))}
        </section>

        <nav
          className="mt-10 flex flex-wrap justify-between gap-3 border-t border-[var(--color-border)] pt-6"
          aria-label="Guide pagination"
        >
          <Link
            href="/"
            className="text-sm font-semibold text-[var(--color-accent)]"
          >
            ← Home
          </Link>
          <Link
            href="/workspace"
            className="text-sm font-semibold text-[var(--color-accent)]"
          >
            Open workspace →
          </Link>
        </nav>
      </ContentPage>
    </>
  );
}
