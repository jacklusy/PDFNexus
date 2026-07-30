import type { Metadata, Viewport } from 'next';
import { DM_Sans, Instrument_Serif } from 'next/font/google';
import { ToastProvider } from '@/shared/ui';
import { AnalyticsListener } from '@/components/AnalyticsListener';
import { ThemeProvider } from '@/components/ThemeProvider';
import { getAppUrl } from '@/lib/seo';
import './globals.css';

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-dm-sans',
  display: 'swap',
});

const instrument = Instrument_Serif({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-instrument',
  display: 'swap',
});

const appUrl = getAppUrl();

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: {
    default: 'PDFNexus — Merge & organize PDFs locally',
    template: '%s · PDFNexus',
  },
  description:
    'Merge, organize, rotate, and convert PDFs entirely in your browser. Local tools download immediately — no account required.',
  openGraph: {
    title: 'PDFNexus',
    description:
      'Local PDF toolkit with immediate downloads. Email and Drive are optional.',
    url: appUrl,
    siteName: 'PDFNexus',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'PDFNexus',
    description:
      'Local PDF toolkit with immediate downloads. Email and Drive are optional.',
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#eef4f4' },
    { media: '(prefers-color-scheme: dark)', color: '#0f172a' },
  ],
  colorScheme: 'light dark',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${dmSans.variable} ${instrument.variable}`}
      suppressHydrationWarning
    >
      <body className="font-sans antialiased">
        <ThemeProvider>
          <ToastProvider>
            <AnalyticsListener />
            {children}
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
