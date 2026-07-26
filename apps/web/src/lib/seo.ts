import type { Metadata } from 'next';

const FALLBACK_PRODUCTION = 'https://pdfnexus.app';

export function getAppUrl(): string {
  const raw = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!raw) {
    if (process.env.NODE_ENV === 'production') return FALLBACK_PRODUCTION;
    return 'http://localhost:3000';
  }
  if (
    process.env.NODE_ENV === 'production' &&
    /localhost|127\.0\.0\.1/i.test(raw)
  ) {
    return FALLBACK_PRODUCTION;
  }
  return raw.replace(/\/$/, '');
}

export function pageMetadata({
  title,
  description,
  path,
  noIndex = false,
}: {
  title: string;
  description: string;
  path: string;
  noIndex?: boolean;
}): Metadata {
  const base = getAppUrl();
  const url = `${base}${path === '/' ? '' : path}`;
  const fullTitle = title.includes('PDFNexus')
    ? title
    : undefined;
  return {
    title: fullTitle || title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title: fullTitle || `${title} · PDFNexus`,
      description,
      url,
      siteName: 'PDFNexus',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: fullTitle || `${title} · PDFNexus`,
      description,
    },
    robots: noIndex
      ? { index: false, follow: false }
      : { index: true, follow: true },
  };
}
