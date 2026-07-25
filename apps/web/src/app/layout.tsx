import type { Metadata } from 'next';
import { DM_Sans, Instrument_Serif } from 'next/font/google';
import { ToastProvider } from '@/shared/ui';
import { AnalyticsListener } from '@/components/AnalyticsListener';
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

const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: {
    default: 'PDFNexus — Merge & organize PDFs locally',
    template: '%s · PDFNexus',
  },
  description:
    'Merge, organize, rotate, and convert PDFs entirely in your browser. Only final files leave your device after email verification.',
  openGraph: {
    title: 'PDFNexus',
    description: 'Local PDF merge & organize with verified delivery.',
    url: appUrl,
    siteName: 'PDFNexus',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'PDFNexus',
    description: 'Local PDF merge & organize with verified delivery.',
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${dmSans.variable} ${instrument.variable}`}>
      <body className="font-sans antialiased">
        <ToastProvider>
          <AnalyticsListener />
          {children}
        </ToastProvider>
      </body>
    </html>
  );
}
