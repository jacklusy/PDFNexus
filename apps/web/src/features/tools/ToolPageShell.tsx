import type { ReactNode } from 'react';
import Link from 'next/link';
import { SiteHeader, SiteFooter } from '@/components/SiteChrome';
import { JsonLd } from '@/components/JsonLd';
import { getAppUrl } from '@/lib/seo';

export interface ToolFaq {
  question: string;
  answer: string;
}

export interface RelatedTool {
  href: string;
  label: string;
}

export interface ToolPageShellProps {
  title: string;
  description: string;
  path: string;
  howItWorks: string[];
  privacyNote?: string;
  limits?: string[];
  faqs?: ToolFaq[];
  related?: RelatedTool[];
  children: ReactNode;
}

export function ToolPageShell({
  title,
  description,
  path,
  howItWorks,
  privacyNote = 'This tool runs in your browser. Your PDF is not uploaded to process the file.',
  limits = [],
  faqs = [],
  related = [],
  children,
}: ToolPageShellProps) {
  const url = `${getAppUrl()}${path}`;
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: title,
    applicationCategory: 'UtilitiesApplication',
    operatingSystem: 'Web',
    url,
    description,
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  };
  const faqLd =
    faqs.length > 0
      ? {
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          mainEntity: faqs.map((f) => ({
            '@type': 'Question',
            name: f.question,
            acceptedAnswer: { '@type': 'Answer', text: f.answer },
          })),
        }
      : null;

  return (
    <div className="min-h-screen atmosphere-light">
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-6 py-10 md:px-10">
        <JsonLd data={jsonLd} />
        {faqLd ? <JsonLd data={faqLd} /> : null}
        <JsonLd
          data={{
            '@context': 'https://schema.org',
            '@type': 'BreadcrumbList',
            itemListElement: [
              {
                '@type': 'ListItem',
                position: 1,
                name: 'Home',
                item: getAppUrl(),
              },
              {
                '@type': 'ListItem',
                position: 2,
                name: 'Tools',
                item: `${getAppUrl()}/tools`,
              },
              {
                '@type': 'ListItem',
                position: 3,
                name: title,
                item: url,
              },
            ],
          }}
        />

        <nav aria-label="Breadcrumb" className="mb-4 text-sm text-[var(--color-muted)]">
          <ol className="flex flex-wrap items-center gap-1.5">
            <li>
              <Link href="/" className="hover:text-[var(--color-accent)]">
                Home
              </Link>
            </li>
            <li aria-hidden>/</li>
            <li>
              <Link href="/tools" className="hover:text-[var(--color-accent)]">
                Tools
              </Link>
            </li>
            <li aria-hidden>/</li>
            <li className="font-medium text-[var(--color-ink)]" aria-current="page">
              {title}
            </li>
          </ol>
        </nav>

        <header className="max-w-2xl">
          <p className="text-xs font-bold uppercase tracking-wide text-[var(--color-accent)]">
            PDFNexus tool
          </p>
          <h1 className="mt-2 font-display text-4xl text-[var(--color-ink)] md:text-5xl">
            {title}
          </h1>
          <p className="mt-3 text-base text-[var(--color-muted)]">{description}</p>
        </header>

        <div className="mt-8">{children}</div>

        <section className="mt-12 space-y-3" aria-labelledby="how-heading">
          <h2 id="how-heading" className="font-display text-2xl text-[var(--color-ink)]">
            How it works
          </h2>
          <ol className="list-decimal space-y-2 pl-5 text-sm text-[var(--color-muted)]">
            {howItWorks.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </section>

        <section className="mt-10 space-y-2" aria-labelledby="privacy-heading">
          <h2 id="privacy-heading" className="font-display text-2xl text-[var(--color-ink)]">
            Privacy
          </h2>
          <p className="text-sm text-[var(--color-muted)]">{privacyNote}</p>
        </section>

        {limits.length > 0 ? (
          <section className="mt-10 space-y-2" aria-labelledby="limits-heading">
            <h2 id="limits-heading" className="font-display text-2xl text-[var(--color-ink)]">
              Limits
            </h2>
            <ul className="list-disc space-y-1.5 pl-5 text-sm text-[var(--color-muted)]">
              {limits.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
        ) : null}

        {faqs.length > 0 ? (
          <section className="mt-10 space-y-4" aria-labelledby="faq-heading">
            <h2 id="faq-heading" className="font-display text-2xl text-[var(--color-ink)]">
              FAQ
            </h2>
            <dl className="space-y-4">
              {faqs.map((f) => (
                <div key={f.question}>
                  <dt className="text-sm font-semibold text-[var(--color-ink)]">{f.question}</dt>
                  <dd className="mt-1 text-sm text-[var(--color-muted)]">{f.answer}</dd>
                </div>
              ))}
            </dl>
          </section>
        ) : null}

        {related.length > 0 ? (
          <section className="mt-10 space-y-3" aria-labelledby="related-heading">
            <h2 id="related-heading" className="font-display text-2xl text-[var(--color-ink)]">
              Related tools
            </h2>
            <ul className="flex flex-wrap gap-2">
              {related.map((r) => (
                <li key={r.href}>
                  <Link
                    href={r.href}
                    className="inline-flex rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-sm font-medium text-[var(--color-ink)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
                  >
                    {r.label}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </main>
      <SiteFooter />
    </div>
  );
}
