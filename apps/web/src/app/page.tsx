import type { Metadata } from 'next';
import Link from 'next/link';
import { SiteFooter, SiteHeader } from '@/components/SiteChrome';
import {
  HeroIllustration,
  PrivacyIllustration,
  WorkflowIllustration,
} from '@/components/Illustrations';
import { AdSlot } from '@/shared/ui';
import { JsonLd } from '@/components/JsonLd';
import { pageMetadata } from '@/lib/seo';

export const metadata: Metadata = pageMetadata({
  title: 'Merge & organize PDFs locally',
  description:
    'Merge, organize, rotate, and convert PDFs entirely in your browser. Local tools download immediately — no account required. Email and Drive are optional.',
  path: '/',
});

const faqs = [
  {
    q: 'Do my source PDFs get uploaded while I edit?',
    a: 'No. Merge, reorder, rotate, and Word conversion run in your browser. Source files stay on your device. Downloads of local results are immediate — no account required.',
  },
  {
    q: 'Why would I verify my email?',
    a: 'Email verification is optional. Use it only if you want temporary cloud storage or a branded download link emailed to you. Local tools never require it.',
  },
  {
    q: 'Is OCR private?',
    a: 'Optional OCR for scanned pages may send rendered page images to our API for layout analysis. We do not log document contents or filenames in analytics.',
  },
];

export default function HomePage() {
  return (
    <div className="min-h-screen">
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@graph': [
            {
              '@type': 'WebSite',
              name: 'PDFNexus',
              url: process.env.NEXT_PUBLIC_APP_URL || 'https://pdfnexus.app',
            },
            {
              '@type': 'SoftwareApplication',
              name: 'PDFNexus',
              applicationCategory: 'BusinessApplication',
              operatingSystem: 'Web',
              description:
                'Browser-local PDF toolkit with immediate downloads and optional cloud delivery.',
            },
            {
              '@type': 'FAQPage',
              mainEntity: faqs.map((f) => ({
                '@type': 'Question',
                name: f.q,
                acceptedAnswer: { '@type': 'Answer', text: f.a },
              })),
            },
          ],
        }}
      />

      <div className="atmosphere text-white">
        <SiteHeader variant="dark" />
        <section className="mx-auto grid max-w-6xl items-center gap-10 px-6 pb-20 pt-6 md:grid-cols-2 md:px-10">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-teal-200">
              Privacy-first PDF toolkit
            </p>
            <h1 className="mt-3 font-display text-4xl leading-tight md:text-5xl">
              Merge & organize PDFs without uploading your drafts
            </h1>
            <p className="mt-4 max-w-xl text-sm leading-relaxed text-white/80 md:text-base">
              Assemble multi-document packs in your browser. Source files stay
              local while you edit, and finished PDFs download immediately — no
              account required. Optional email delivery or Google Drive is only
              used when you choose it.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/workspace"
                className="rounded-xl bg-teal-400 px-5 py-3 text-sm font-bold text-teal-950 hover:bg-teal-300"
              >
                Open workspace
              </Link>
              <Link
                href="/guide"
                className="rounded-xl border border-white/30 px-5 py-3 text-sm font-semibold text-white hover:bg-white/10"
              >
                Read the guide
              </Link>
            </div>
          </div>
          <HeroIllustration className="mx-auto w-full max-w-md" />
        </section>
      </div>

      <section className="atmosphere-light px-6 py-16 md:px-10">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-center font-display text-3xl text-[var(--color-ink)]">
            Everything you need to assemble documents
          </h2>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              ['Merge locally', 'Combine PDFs and images in-browser with full page control.'],
              ['Organize pages', 'Reorder, rotate, duplicate, delete, and insert blanks.'],
              ['Convert to Word', 'Export structured DOCX with optional OCR for scans.'],
              ['Instant local download', 'Browser-processed files download immediately — no sign-up.'],
              ['Optional email delivery', 'Verify once only if you want a cloud copy or emailed link.'],
              ['Privacy-minded analytics', 'Feature events without filenames or document content.'],
            ].map(([title, body]) => (
              <div
                key={title}
                className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-sm"
              >
                <h3 className="text-sm font-bold text-[var(--color-ink)]">{title}</h3>
                <p className="mt-2 text-sm text-[var(--color-muted)]">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-6 py-16 md:px-10">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-center font-display text-3xl text-[var(--color-ink)]">
            How it works
          </h2>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {(
              [
                {
                  step: 1 as const,
                  title: 'Add files',
                  body: 'Drop PDFs or images into the workspace. They stay in browser memory.',
                },
                {
                  step: 2 as const,
                  title: 'Arrange',
                  body: 'Reorder thumbnails, rotate pages, and preview the result.',
                },
                {
                  step: 3 as const,
                  title: 'Download instantly',
                  body: 'Save the result to your device right away. Email a copy only if you want to.',
                },
              ] as const
            ).map(({ step, title, body }) => (
              <div key={title} className="text-center">
                <WorkflowIllustration step={step} className="mx-auto h-28 w-40" />
                <h3 className="mt-4 text-sm font-bold text-[var(--color-ink)]">
                  {step}. {title}
                </h3>
                <p className="mt-2 text-sm text-[var(--color-muted)]">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="atmosphere-light px-6 py-16 md:px-10">
        <div className="mx-auto grid max-w-5xl items-center gap-10 md:grid-cols-2">
          <div>
            <h2 className="font-display text-3xl text-[var(--color-ink)]">
              Built for private, high-fidelity assembly
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-[var(--color-muted)]">
              Use PDFNexus for contract packs, onboarding binders, scanned form
              cleanup, and client deliverables — without uploading every draft
              page to the cloud while you edit.
            </p>
            <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-[var(--color-muted)]">
              <li>Legal and ops teams assembling multi-PDF packets</li>
              <li>Teams converting scans to editable Word drafts</li>
              <li>Anyone who wants local control before sharing finals</li>
            </ul>
          </div>
          <PrivacyIllustration className="mx-auto w-full max-w-sm" />
        </div>
      </section>

      <section className="px-6 py-16 md:px-10">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-center font-display text-3xl text-[var(--color-ink)]">
            FAQ
          </h2>
          <div className="mt-8 space-y-3">
            {faqs.map((f) => (
              <details
                key={f.q}
                className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3"
              >
                <summary className="cursor-pointer text-sm font-semibold text-[var(--color-ink)]">
                  {f.q}
                </summary>
                <p className="mt-2 text-sm text-[var(--color-muted)]">{f.a}</p>
              </details>
            ))}
          </div>
          <div className="mt-12 rounded-2xl bg-[var(--color-accent)] px-6 py-8 text-center text-white">
            <h2 className="font-display text-2xl">Ready to assemble?</h2>
            <p className="mt-2 text-sm text-white/85">
              Open the workspace and start merging — no install required.
            </p>
            <Link
              href="/workspace"
              className="mt-5 inline-flex rounded-xl bg-white px-5 py-2.5 text-sm font-bold text-[var(--color-accent)]"
            >
              Open workspace
            </Link>
          </div>
          <div className="mt-10">
            <AdSlot slotId="home-below-fold" height={90} />
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
